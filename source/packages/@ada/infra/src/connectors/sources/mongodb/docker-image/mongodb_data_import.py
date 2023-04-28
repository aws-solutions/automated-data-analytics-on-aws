###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import os
from datetime import datetime
from typing import Any
import pandas as pd
import awswrangler as wr
from pymongo import MongoClient
import boto3
import urllib.parse
import requests
import time
from functools import wraps
from pymongo.errors import AutoReconnect

_CA_CERT = "/tmp/ca.pem"
_CLIENT_CERT = "/tmp/client.pem"
_TLS = "tls"
_TLS_CA_FILE = "tlsCAFile"
_TLS_CERT_KEY_FILE = "tlsCertificateKeyFile"
_BATCH_SIZE = 5000

# These are the Required Environment Variables input into the State
# Machine. Values are input into the MongoDBImportDataStateMachine
# class as taskEnv object

DB_ENDPOINT = os.environ.get("DB_ENDPOINT")
DB_PORT = os.environ.get("DB_PORT")
DB_NAME = os.environ.get("DB_NAME")
COLLECTION_NAME = os.environ.get("COLLECTION_NAME")
USERNAME = os.environ.get("USERNAME")
PASSWORD = os.environ.get("PASSWORD")
TABLE_NAME = os.environ.get("TABLE_NAME")
DOMAIN_ID = os.environ.get("DOMAIN_ID")
DATA_PRODUCT_ID = os.environ.get("DATA_PRODUCT_ID")
S3_OUTPUT_BUCKET_URI = os.environ.get("S3_OUTPUT_BUCKET_URI")
TRIGGER_TYPE = os.environ.get("TRIGGER_TYPE")
SCHEDULE_RATE = os.environ.get("SCHEDULE_RATE")
TLS = os.environ.get("TLS")
TLS_CA_ID = os.environ.get("TLS_CA_ID")
TLS_CLIENT_CERT_ID = os.environ.get("TLS_CLIENT_CERT_ID")
EXTRA_PARAMS = os.environ.get("EXTRA_PARAMS")
INCREMENT_UPDATE_COLUMN = os.environ.get("INCREMENT_UPDATE_COLUMN")
BOOKMARK_FIELD = os.environ.get("BOOKMARK_FIELD")
BOOKMARK_FIELD_TYPE = os.environ.get("BOOKMARK_FIELD_TYPE")


class MissingParameterException(Exception):
    pass


class SecretsManagerException(Exception):
    pass


class CADownloaderException(Exception):
    pass


class MongoDBImportException(Exception):
    pass


class CADownloader:
    """Download file from s3, https, http uri"""

    def __init__(self, uri: str, session: boto3.session = None) -> None:
        """Initialize class with uri and boto session

        Args:
            uri (str): uri of file to download
            session (boto3.session, optional): AWS boto3 session. Defaults to None
        """
        self.uri = uri
        self.session = session

    def download_to_file(self, filename: str) -> None:
        """Download file from s3/http to filename

        Args:
            filename (str): filename and path to write file
        """
        if self.uri.startswith("s3://"):
            self._download_from_s3(filename)
        else:
            self._download_from_http(filename)

    def _download_from_s3(self, filename: str) -> None:
        """Download file from s3

        Args:
            filename (str): filename and path to write file

        Raises:
            CADownloaderException: Unable to download file from s3
        """
        s3_session = self.session or boto3.Session()
        s3 = s3_session.client("s3")
        try:
            bucket, key = self.uri[5:].split("/", 1)
            s3.download_file(bucket, key, filename)
        except Exception as e:
            raise CADownloaderException(f"Error downloading from S3: {e}")

    def _download_from_http(self, filename: str) -> None:
        """Download file from http

        Args:
            filename (str): filename and path to write file

        Raises:
            CADownloaderException: Unable to download file from http location
        """
        try:
            response = requests.get(self.uri)
            response.raise_for_status()
            with open(filename, "w") as f:
                f.write(response.content)
        except requests.exceptions.RequestException as e:
            raise CADownloaderException(f"Error downloading from {self.uri}: {e}")
        except IOError as e:
            raise CADownloaderException(f"Error writing to file {filename}: {e}")


class SecretsManager:
    """Retrieve secrets from AWS SecretsManager"""

    def __init__(self, secret_id: str) -> None:
        """Initialise class

        Args:
            secret_id (str): AWS secretsmanager secret id
        """
        self.secret_id = secret_id
        self.client = boto3.client("secretsmanager")

    def get_secret(self) -> None:
        """Get secret

        Raises:
            SecretsManagerException: Error retreiving secret

        Returns:
            str: Secret retrieved from AWS SecretsManager
        """
        try:
            response = self.client.get_secret_value(SecretId=self.secret_id)
        except self.client.exceptions.ResourceNotFoundException:
            raise SecretsManagerException(f"Secret '{self.secret_id}' not found")
        except self.client.exceptions.InvalidRequestException as e:
            raise SecretsManagerException(f"Invalid request: {e}")
        except self.client.exceptions.InvalidParameterException as e:
            raise SecretsManagerException(f"Invalid parameter: {e}")
        except Exception as e:
            raise SecretsManagerException(f"Failed to retrieve secret: {e}")
        return response["SecretString"]

    def write_secret_to_file(self, filename: str) -> None:
        """Retrieve and write secret to file

        Args:
            filename (str): path and name of file to write

        Raises:
            SecretsManagerException: Error retrieving secret or writing to file
        """
        try:
            secret = self.get_secret()
            with open(filename, "w") as file:
                file.write(urllib.parse.unquote(secret))
        except Exception as e:
            raise SecretsManagerException(f"Failed to write secret to file: {e}")


class MongoDBContextManager:
    """ContextManager for MongoDB connection"""

    def __init__(self, uri: str) -> None:
        """Set MongoDB uri

        Args:
            uri (str): MongoDB connection string
        """
        self.connection_uri = uri
        self.connection = None

    def __enter__(self):
        """Create the connection to MongoDB

        Returns:
            pymongo.mongo_client.MongoClient: Pymongo client object
        """
        self.connection = MongoClient(self.connection_uri)
        return self.connection

    def __exit__(self, exc_type, exc_value, exc_traceback):
        """Close the MongoDB connection"""
        self.connection.close()


def pymongo_autoreconnect_retry(func):
    """Retry decorator to handle pymongo AutoReconnect exceptions"""

    @wraps(func)
    def wrapper(*args, **kwargs):
        max_tries = 3
        tries = 0
        while True:
            try:
                return func(*args, **kwargs)
            except AutoReconnect as e:
                tries += 1
                if tries > max_tries:
                    raise e
                delay = 2**tries
                print(f"AutoReconnect error: {e}. Retrying in {delay} seconds...")
                time.sleep(delay)

    return wrapper


class MongoDBImport:
    """MongoDB data importer"""

    def __init__(
        self,
        db_endpoint: str,
        db_port: str,
        db_name: str,
        collection_name: str,
        username: str,
        password: str,
        s3_output_uri: str,
        table_name: str,
        data_product_id: str,
        domain_id: str,
        trigger_type: str,
        tls: str,
        tls_ca: str,
        tls_cert_key: str,
        extra_params: str,
        bookmark_field: str,
        bookmark_field_type: str,
    ) -> None:
        """_summary_

        Args:
            db_endpoint (str): MongoDB URL
            db_port (str): MongoDB port
            db_name (str): Database Name
            collection_name (str): Database Collection
            username (str): Database username
            password (str): Database password
            s3_output_uri (str): S3 location to write imported data
            table_name (str): Dynamodb table name to store last updated values
            data_product_id (str): Id of the data product
            domain_id (str): Id of the domain containing the data product
            trigger_type (str): Data update trigger type
            tls (str): Is tls enabled "true" | "false"
            tls_ca (str): Uri to the tls CA file (S3 or https)
            tls_cert_key (str): Secret Id for the client cert stored in SecretsManager
            extra_params (str): Extra parameters to apply to the mongo connection string
            bookmark_field (str): The field that will be used to bookmark data updates
            bookmark_field_type (str): The data type of the bookmark field (integer, str, timestamp)

        Raises:
            MissingParameterException: Required parameter not supplied
        """

        if db_endpoint is None or db_endpoint == "":
            raise MissingParameterException("Database Endpoint is missing")
        if db_port is None or db_port == "":
            raise MissingParameterException("Database Port is missing")
        if db_name is None or db_name == "":
            raise MissingParameterException("Database Name is missing")
        if collection_name is None or collection_name == "":
            raise MissingParameterException("Database Collection Name is missing")
        if username is None or username == "":
            raise MissingParameterException("Database Username is missing")
        if password is None or password == "":
            raise MissingParameterException("Database Password is missing")
        if s3_output_uri is None or s3_output_uri == "":
            raise MissingParameterException("S3 Bucket URI is missing")
        if table_name is None or table_name == "":
            raise MissingParameterException("Last Updated Detail Table Name is missing")
        if data_product_id is None or data_product_id == "":
            raise MissingParameterException("Data Product ID is missing")
        if domain_id is None or domain_id == "":
            raise MissingParameterException("Domain Id is missing")
        if trigger_type is None or trigger_type == "":
            raise MissingParameterException("Trigger Type is missing")
        if bookmark_field is not None and bookmark_field != "":
            self._bookmark_field = bookmark_field
            if bookmark_field_type is None or bookmark_field_type == "":
                raise MissingParameterException(
                    "Bookmark Field Type is required when Bookmark Field is specified"
                )
            self._bookmark_field_type = bookmark_field_type
        else:
            self._bookmark_field = None
            self._bookmark_field_type = None

        self._db_name = db_name
        self._collection_name = collection_name

        self._username = urllib.parse.quote_plus(username)
        self._password = urllib.parse.quote_plus(SecretsManager(password).get_secret())
        self._mongo_conn_uri = "mongodb://%s:%s@%s:%s" % (
            self._username,
            self._password,
            db_endpoint,
            db_port,
        )

        self._s3_output_uri = s3_output_uri.rstrip("/")
        self._last_updated_table_name = table_name
        self._data_product_id = data_product_id
        self._domain_id = domain_id
        self._trigger_type = trigger_type
        self._ddb_client = boto3.client("dynamodb")
        self._current_timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        self._query_params = {}

        if tls == "true":
            self._query_params[_TLS] = tls

            if tls_ca is not None and tls_ca != "":
                CADownloader(tls_ca).download_to_file(_CA_CERT)
                self._query_params[_TLS_CA_FILE] = _CA_CERT

            if tls_cert_key is not None and tls_cert_key != "":
                SecretsManager(tls_cert_key).write_secret_to_file(_CLIENT_CERT)
                self._query_params[_TLS_CERT_KEY_FILE] = _CLIENT_CERT

        if (
            extra_params is not None
            and type(extra_params) is str
            and extra_params != ""
        ):
            for param in extra_params.split(","):
                kv = param.split("=")
                self._query_params[kv[0]] = kv[1]

        if len(self._query_params) > 0:
            self._mongo_conn_uri = "%s/?%s" % (
                self._mongo_conn_uri,
                urllib.parse.urlencode(self._query_params),
            )

        print(f"Mongodb connection uri: {self._mongo_conn_uri}")

    def execute(self) -> None:
        if self._bookmark_field is None:
            self._query = {}
        else:
            print(f"Bookmark Field is set as: {self._bookmark_field}")
            last_update_metadata = self._get_last_updated_timestamp()
            if last_update_metadata is None:
                self._query = {}
            else:
                self._query = {
                    self._bookmark_field: {
                        "$gt": self._convert_data_type(
                            last_update_metadata["max_index_value"]["S"]
                        )
                    }
                }

        self._import_data()

    def _import_data(self) -> None:
        """Setup MongoDB connections and retrive data"""
        try:
            print("Importing Data")
            with MongoDBContextManager(self._mongo_conn_uri) as mongo:
                collection = mongo[self._db_name][self._collection_name]
                total_documents = collection.count_documents(self._query)
            
                if self._bookmark_field is not None:
                    max_value = (
                        collection.find().sort(self._bookmark_field, -1).limit(1)
                    )
                    print(f"Bookmark Field max_value: {max_value[0]}")

                    if (
                        self._check_data_type(max_value[0][self._bookmark_field])
                    ) != True:
                        raise MongoDBImportException("Incorrect Bookmark Field type")
                    
            # Initialize batch count and start index
            batch_count = 0
            start_index = 0

            # Loop through batches
            while start_index < total_documents:
                print("iteration")
                print(batch_count)
                print(start_index)
                # Get next batch of documents
                batched_df = self._get_batch(start_index, _BATCH_SIZE)
                
                # Write DataFrame to Parquet file on S3
                self._write_data(batched_df, start_index)

                # Increment batch count and start index
                batch_count += 1
                start_index += _BATCH_SIZE
            
            if self._bookmark_field is not None:
                self._update_last_updated_timestamp(
                    total_documents, max_value[0][self._bookmark_field]
                )
            else:
                self._update_last_updated_timestamp(total_documents)

        except MongoDBImportException as e:
            print(f"Exception: {e}")

    @pymongo_autoreconnect_retry
    def _get_batch(self, start, size):
        with MongoDBContextManager(self._mongo_conn_uri) as mongo:
            cursor = (
                mongo[self._db_name][self._collection_name]
                .find(self._query)
                .skip(start)
                .limit(size)
            )
            documents = list(cursor)

        # Convert documents to pandas DataFrame
        df = pd.DataFrame(documents)

        print(f"size of documents: {df.shape[0]}")
        if df.shape[0] > 0:
            df = df.astype({"_id": str})

        return df

    def _convert_data_type(self, value):
        if self._bookmark_field_type == "integer":
            return int(value)
        elif self._bookmark_field_type == "string":
            return str(value)
        elif self._bookmark_field_type == "timestamp":
            return datetime.fromisoformat(value)

    def _check_data_type(self, value):
        if self._bookmark_field_type == "integer":
            if type(value) == int:
                return True
            if type(value) == float:
                return True

        elif self._bookmark_field_type == "string":
            if type(value) == str:
                return True

        elif self._bookmark_field_type == "timestamp":
            if type(value) == datetime:
                return True

    def _write_data(self, data: pd.DataFrame, batch_number: int) -> None:
        """Write the retrieved data to s3

        Args:
            data (pd.DataFrame): pandas representation of MongoDB data
            batch_number (int): the batch number for the subset of data to be written

        """
        print(f"writing batch number: {batch_number}")
        result = wr.s3.to_parquet(
            df=data,
            path=f"{self._s3_output_uri}/",
            index=False,
            dataset=True,
            mode='append',
            filename_prefix=f"{self._data_product_id}_{batch_number}_",
        )
        print(result)

    def _get_last_updated_timestamp(self) -> str or None:
        print("Retrieving last updated timestamp")
        response = self._ddb_client.get_item(
            TableName=self._last_updated_table_name,
            Key={
                "dataProductId": {"S": self._data_product_id},
                "domainId": {"S": self._domain_id},
            },
        )
        if "Item" in response:
            print("Last update timestamp exists")
            return response["Item"]
        else:
            print("Last update timestamp does not exists")
            return None

    def _update_last_updated_timestamp(
        self, result_count: int, max_index_value: Any = None
    ) -> None:
        """Update the last updated table with details about the
           latest retrieved data

        Args:
            result_count (int): Number of items retrieved
        """
        print(
            f"Updating last update timestamp with: {self._current_timestamp}"
            f"and number of rows retrieved with: {result_count}"
        )

        item = {
            "dataProductId": {"S": self._data_product_id},
            "domainId": {"S": self._domain_id},
            "timestamp": {"S": str(self._current_timestamp)},
            "num_rows": {"S": str(result_count)},
        }

        if max_index_value is not None:
            if self._bookmark_field_type == "timestamp":
                converted_max_index_value = max_index_value.isoformat()
            else:
                converted_max_index_value = str(max_index_value)

            item["max_index_value"] = {"S": converted_max_index_value}

        self._ddb_client.put_item(
            TableName=self._last_updated_table_name,
            Item=item,
        )


if __name__ == "__main__":
    mdbi = MongoDBImport(
        db_endpoint=DB_ENDPOINT,
        db_port=DB_PORT,
        db_name=DB_NAME,
        collection_name=COLLECTION_NAME,
        username=USERNAME,
        password=PASSWORD,
        s3_output_uri=S3_OUTPUT_BUCKET_URI,
        table_name=TABLE_NAME,
        data_product_id=DATA_PRODUCT_ID,
        domain_id=DOMAIN_ID,
        trigger_type=TRIGGER_TYPE,
        tls=TLS,
        tls_ca=TLS_CA_ID,
        tls_cert_key=TLS_CLIENT_CERT_ID,
        extra_params=EXTRA_PARAMS,
        bookmark_field=BOOKMARK_FIELD,
        bookmark_field_type=BOOKMARK_FIELD_TYPE,
    )

    print("Executing MongoDBImport")
    mdbi.execute()
