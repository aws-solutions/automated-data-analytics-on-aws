###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import urllib.parse
import datetime
import pandas as pd
from pymongo import MongoClient
import boto3
import urllib.parse
import requests
from botocore.exceptions import ClientError
from handlers.common import *  # NOSONAR
from handlers.sampling.common import SamplingUtils  # NOSONAR
from handlers.sampling.common import SecretsManager  # NOSONAR


_CA_CERT = "/tmp/ca.pem"
_CLIENT_CERT = "/tmp/client.pem"
_TLS = "tls"
_TLS_CA_FILE = "tlsCAFile"
_TLS_CERT_KEY_FILE = "tlsCertificateKeyFile"


SOURCEDETAILS_CREDENTIAL_FIELD_NAME = 'password'
SOURCEDETAILS_CREDENTIAL_SECRET_NAME = 'dbCredentialSecretName'
SOURCEDETAILS_TLS_CA_FIELD_NAME = 'tlsCA'
SOURCEDETAILS_CLIENT_CERT_FIELD_NAME = 'tlsClientCert'
SOURCEDETAILS_CLIENT_CERT_SECRET_NAME = 'tlsClientCertSecretName'
SOURCEDETAILS_EXTRA_PARAMS_FIELD_NAME = 'extraParams'
SOURCEDETAILS_BOOKMARK_FIELD_FIELD_NAME = 'bookmarkField'
SOURCEDETAILS_BOOKMARK_FIELD_TYPE_FIELD_NAME = 'bookmarkFieldType'


class CADownloaderException(Exception):
    pass

class StringToFileException(Exception):
    pass

class PullSampleExeption(Exception):
    pass

class SourceNotExistException(Exception):
    pass

class MissingParameterException(Exception):
    pass


class CADownloader:
    """Download file from s3, https, http uri"""

    def __init__(self, uri: str, session: boto3.session = None) -> None:
        """Initialize class with uri and boto session

        Args:
            uri (str): uri of file to download
            session (boto3.session, optional): AWS boto3 session. Defaults to None.
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


class StringToFile:
    """Wrtie string to file"""

    def __init__(self, file_path: str) -> None:
        """Initialize class with file path and name

        Args:
            file_path (str): file path and name
        """
        self.file_path = file_path

    def write_to_file(self, content: str):
        """Write content to file

        Args:
            content (str): string content to write to file
        """
        try:
            with open(self.file_path, "w") as file:
                file.write(content)
            print(f"The string was successfully written to {self.file_path}")
        except Exception as e:
            raise StringToFileException(
                f"An error occurred while writing the string to {self.file_path}: {e}"
            )


def check_data_type(field_type, value):
    if field_type == "integer":
        if type(value) == int:
            return True
        if type(value) == float:
            return True

    elif field_type == "string":
        if type(value) == str:
            return True

    elif field_type == "timestamp" and type(value) == datetime.datetime:
        return True


def pull_samples(
    input: IPullSamplesInput,
) -> IPullSamplesReturn:  # NOSONAR (python:S3776) - false positive
    """
    Pull data samples from data source
    """
    query_params = {}
    source_details = input.source_details
    db_endpoint = source_details["databaseEndpoint"]
    db_port = source_details["databasePort"]
    db_name = source_details["databaseName"]
    collection_name = source_details["collectionName"]
    username = urllib.parse.quote_plus(source_details["username"])
    tls = source_details["tls"]

    # retrieve password from source details
    password = urllib.parse.quote_plus(SecretsManager.get_credentials_from_source( 
        source_details, 
        SOURCEDETAILS_CREDENTIAL_FIELD_NAME, 
        SOURCEDETAILS_CREDENTIAL_SECRET_NAME
    ))

    # secret manager should use default session which is the lambda exec role to read Ada managed secrets
    secrets_manager = SecretsManager(boto3)

    if tls == "true":
        query_params[_TLS] = tls

        if SOURCEDETAILS_TLS_CA_FIELD_NAME in source_details:
            if source_details[SOURCEDETAILS_TLS_CA_FIELD_NAME] is not None and source_details[SOURCEDETAILS_TLS_CA_FIELD_NAME] != "":
                CADownloader(
                    source_details[SOURCEDETAILS_TLS_CA_FIELD_NAME], input.boto3_session
                ).download_to_file(_CA_CERT)
                query_params[_TLS_CA_FILE] = _CA_CERT

        if SOURCEDETAILS_CLIENT_CERT_FIELD_NAME in source_details:
            if (
                source_details[SOURCEDETAILS_CLIENT_CERT_FIELD_NAME] is not None
                and source_details[SOURCEDETAILS_CLIENT_CERT_FIELD_NAME] != ""
            ):
                StringToFile(_CLIENT_CERT).write_to_file(
                    urllib.parse.unquote(source_details[SOURCEDETAILS_CLIENT_CERT_FIELD_NAME])
                )
                query_params[_TLS_CERT_KEY_FILE] = _CLIENT_CERT

        elif SOURCEDETAILS_CLIENT_CERT_SECRET_NAME in source_details:
            secrets_manager.write_secret_to_file(
                _CLIENT_CERT, 
                source_details[SOURCEDETAILS_CLIENT_CERT_SECRET_NAME]
            )
            query_params[_TLS_CERT_KEY_FILE] = _CLIENT_CERT

    if (
        SOURCEDETAILS_EXTRA_PARAMS_FIELD_NAME in source_details
        and source_details[SOURCEDETAILS_EXTRA_PARAMS_FIELD_NAME] is not None
        and type(source_details[SOURCEDETAILS_EXTRA_PARAMS_FIELD_NAME]) is str
        and source_details[SOURCEDETAILS_EXTRA_PARAMS_FIELD_NAME] != ""
    ):
        for param in source_details[SOURCEDETAILS_EXTRA_PARAMS_FIELD_NAME].split(","):
            kv = param.split("=")
            query_params[kv[0]] = kv[1]

    mongo_conn_uri = "mongodb://%s:%s@%s:%s" % (
        username,
        password,
        db_endpoint,
        db_port,
    )

    if len(query_params) > 0:
        mongo_conn_uri = "%s/?%s" % (
            mongo_conn_uri,
            urllib.parse.urlencode(query_params),
        )

    print(f"Mongodb connection uri: {mongo_conn_uri}")

    try:

        with MongoDBContextManager(mongo_conn_uri) as mongo:
            collection = mongo[db_name][collection_name]

            if SOURCEDETAILS_BOOKMARK_FIELD_FIELD_NAME in source_details:
                if SOURCEDETAILS_BOOKMARK_FIELD_TYPE_FIELD_NAME not in source_details:
                    raise MissingParameterException("Update Index Field Type not provided")

                exists = collection.count_documents(
                    {source_details[SOURCEDETAILS_BOOKMARK_FIELD_FIELD_NAME]: {"$exists": True}}
                )

                if exists == 0:
                    raise SourceNotExistException(
                        f"{source_details[SOURCEDETAILS_BOOKMARK_FIELD_FIELD_NAME]} does not exist in collection"
                    )

                check_value_type = collection.find({}).limit(1)

                if (
                    check_data_type(
                        source_details[SOURCEDETAILS_BOOKMARK_FIELD_TYPE_FIELD_NAME],
                        check_value_type[0][source_details[SOURCEDETAILS_BOOKMARK_FIELD_FIELD_NAME]],
                    )
                ) != True:
                    raise PullSampleExeption("Incorrect Bookmark Field type")

            cursor = collection.find({}).limit(10)
            all_docs = list(cursor)
            df = pd.DataFrame(all_docs)

            # convert ObjectId type to string; required for converting to pandas dataframe
            df = df.astype({"_id": str})
            
        return [Sample(DEFAULT_DATASET_ID, df, "parquet")]

    except PullSampleExeption as e:
        print("Failed to retrieve MongoDB Data: {}", e)
        