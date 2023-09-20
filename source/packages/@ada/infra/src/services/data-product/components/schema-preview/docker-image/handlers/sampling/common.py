###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import awswrangler as wr
import io
import os
import csv
import boto3
import time
import urllib.parse
import hashlib
import uuid
from datetime import datetime, date
from dateutil import parser as dateparser
from dateutil.relativedelta import relativedelta
import re
import regex
from typing import Tuple
from google.oauth2 import service_account
from apiclient.discovery import build as buildGoogleApiClient

from handlers.common import *  # NOSONAR

TEMP_BUCKET_NAME = os.environ['TEMP_BUCKET_NAME']
KEY_ID = os.environ['KEY_ID']
kms = boto3.client('kms')
sts = boto3.client('sts')

class SecretsManagerException(Exception):
    pass

class MissCredentialException(Exception):
    pass


class SecretsManager:
    """Retrieve secrets from AWS SecretsManager"""

    def __init__(self, session: boto3.session) -> None:
        """Initialise class

        Args:
            session (boto3.session, optional): AWS boto3 session. Defaults to None
        """
        self.client = session.client("secretsmanager")

    def get_secret(self, secret_id: str) -> None:
        """Get secret

        Args:
            secret_id (str): AWS secretsmanager secret id
    
        Raises:
            SecretsManagerException: Error retreiving secret

        Returns:
            str: Secret retrieved from AWS SecretsManager
        """
        try:
            response = self.client.get_secret_value(SecretId=secret_id)
        except self.client.exceptions.ResourceNotFoundException:
            raise SecretsManagerException(f"Secret '{secret_id}' not found")
        except self.client.exceptions.InvalidRequestException as e:
            raise SecretsManagerException(f"Invalid request: {e}")
        except self.client.exceptions.InvalidParameterException as e:
            raise SecretsManagerException(f"Invalid parameter: {e}")
        except Exception as e:
            raise SecretsManagerException(f"Failed to retrieve secret: {e}")
        return response["SecretString"]

    def write_secret_to_file(self, filename: str, secret_id) -> None:
        """Retrieve and write secret to file

        Args:
            filename (str): path and name of file to write
            secret_id (str): AWS secretsmanager secret id

        Raises:
            SecretsManagerException: Error retrieving secret or writing to file
        """
        try:
            secret = urllib.parse.unquote(self.get_secret(secret_id))
            with open(filename, "w") as file:
                file.write(secret)
        except Exception as e:
            raise SecretsManagerException(f"Failed to write secret to file: {e}")

    @staticmethod
    def get_credentials_from_source(source_details, credential_field_name, credential_secret_field_name):
        if credential_field_name in source_details:
            print("read credential from source details")
            credential_value = source_details[credential_field_name]
        elif credential_secret_field_name in source_details:
            print("read credential from secret. {}".format(source_details[credential_secret_field_name]))
            # create secret manager to use default boto session which should be lambda exec role
            secrets_manager = SecretsManager(boto3)
            credential_value = secrets_manager.get_secret(source_details[credential_secret_field_name])
            
        else:
            raise MissCredentialException("Access credentials are not specified in the source details")
        return credential_value

class SamplingUtils:
    @staticmethod
    def to_s3_path(s3_location: IS3Location) -> str:
        return 's3://{}/{}'.format(s3_location['bucket'], s3_location['key'])

    @staticmethod
    def from_s3_path(path: str) -> IS3Location:
        start_part = 's3://'
        if not path.startswith(start_part):
            raise InternalError(
                'S3 path {} does not start with {}'.format(path, start_part))
        parts = path[len('s3://'):].split('/')
        return {'bucket': parts[0], 'key': '/'.join(parts[1:])}

    @staticmethod
    def get_hashed_and_sanitized_user_id(calling_user: ICallingUser) -> ICallingUserProcessed:
        """
        Returns hashed and sanitized user_id from the calling user based on session_name and tags constraint
        https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
        Role session Name Length Constraints: Minimum length of 2. Maximum length of 64. Pattern: [\\w+=,.@-]*
        Tags values need to follow the pattern: [\\p{L}\\p{Z}\\p{N}_.:/=+\\-@]+
        """
        user_id = calling_user.get('userId')

        hashed_user_id = hashlib.sha256(
            'AssumeAsCaller-{}-{}'.format(user_id, round(time.time() * 1000)).encode('utf-8')).hexdigest()

        sanitized_user_id = regex.sub(
            r"[^\p{L}\p{Z}\p{N}_.:/=+\-]*", "", user_id, flags=regex.IGNORECASE)

        return {'hashed': hashed_user_id, 'sanitized': sanitized_user_id}

    @staticmethod
    def assume_pull_data_sample_role(calling_user: ICallingUser):
        """
        Assume the pull data sample role as the calling user. Returns a boto3 session
        Should be kept up to date with assume-role-as-caller.ts
        """
        user_id = SamplingUtils.get_hashed_and_sanitized_user_id(calling_user)
        assumed_role = sts.assume_role(
            RoleArn=os.environ['PULL_DATA_SAMPLE_ROLE_ARN'],
            RoleSessionName=user_id.get('hashed'),
            Tags=[
                {'Key': 'ada:service', 'Value': 'data-product'},
                {'Key': 'ada:user', 'Value': user_id.get('sanitized')},
                {'Key': 'ada:groups', 'Value': ':{}:'.format(
                    ':'.join(calling_user['groups']))},
            ]
        )
        credentials = assumed_role['Credentials']
        return boto3.session.Session(
            aws_access_key_id=credentials['AccessKeyId'],
            aws_secret_access_key=credentials['SecretAccessKey'],
            aws_session_token=credentials['SessionToken'],
        )

    @staticmethod
    def add_data_ingress_network_info_to_source(source_details: ISourceDetails) -> ISourceDetails:
        source_details['subnetIds'] = os.environ.get(
            'DATA_INGRESS_NETWORK_SUBNET_IDS', '').split(',')
        source_details['availabilityZones'] = os.environ.get(
            'DATA_INGRESS_NETWORK_AVAILABILITY_ZONES', '').split(',')
        source_details['securityGroupIds'] = os.environ.get(
            'DATA_INGRESS_NETWORK_SECURITY_GROUP_IDS', '').split(',')
        return source_details

    @staticmethod
    def get_csv_metadata(boto3_session, path: str) -> ICsvMetadata:
        """
        Get the metadata for a csv (eg its delimiter).
        This will throw an exception if it's not possible to get the metadata (eg it's not a csv!)
        """
        # Read the first 10KB from the first object in the path
        first_object_path = wr.s3.list_objects(boto3_session=boto3_session, path=path)[0]
        s3_location = SamplingUtils.from_s3_path(first_object_path)
        res = boto3_session.client('s3').get_object(
            Bucket=s3_location['bucket'], Key=s3_location['key'], Range='bytes=0-10000')

        # Attempt to extract information about the csv
        csv_info = csv.Sniffer().sniff(res['Body'].read().decode('utf-8'))
        return {
            'delimiter': csv_info.delimiter,
            'quotechar': csv_info.quotechar,
            'escapechar': csv_info.escapechar,
            'quoting': csv_info.quoting,
            'doublequote': csv_info.doublequote,
            'skipinitialspace': csv_info.skipinitialspace,
            'lineterminator': csv_info.lineterminator,
        }

    @staticmethod
    def pull_s3_csv_sample(boto3_session, name: str, path: str, sample_size: int) -> Sample:
        """
        Pull the sample for a csv from s3, attempting to read extra metadata to better understand the csv (eg delimiter)
        """
        # Try to get CSV metadata. If this fails, we still try data wrangler
        metadata = None
        try:
            metadata = SamplingUtils.get_csv_metadata(boto3_session, path)
        except Exception as e:
            print("Unable to extract csv metadata (this might not be a csv file): {}", e)

        # csv.Sniffer (used in get_csv_metadata) is more reliable at inferring the separator than data wrangler, so we use
        # this inferred delimiter if available.
        extra_args = {} if metadata is None else {
            'sep': metadata.get('delimiter'), 'engine': 'python'}
        return Sample(
            name,
            next(wr.s3.read_csv(path=path, chunksize=sample_size,
                 boto3_session=boto3_session, **extra_args)),
            'csv',
            path,
            metadata,
        )

    @staticmethod
    def get_google_cloud_credentials(source_details: ISourceDetails) -> IGoogleCreds:
        """
        Get Google Cloud Client credentials
        """
        private_key = SecretsManager.get_credentials_from_source(source_details, 'privateKey', 'privateKeySecretName')
        return service_account.Credentials.from_service_account_info({
            "type": "service_account",
            "auth_uri": source_details["authUri"] if 'authUri' in source_details else "https://accounts.google.com/o/oauth2/auth",
            "token_uri": source_details["tokenUri"] if 'tokenUri' in source_details else "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": source_details["providerCertUrl"] if 'providerCertUrl' in source_details else "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": source_details["clientCertUrl"] if 'clientCertUrl' in source_details else "https://www.googleapis.com/robot/v1/metadata/x509/{}".format(urllib.parse.quote_plus(source_details["clientEmail"])),
            "project_id": source_details["projectId"],
            "client_id": source_details["clientId"],
            "client_email": source_details["clientEmail"],
            "private_key_id": source_details["privateKeyId"],
            "private_key": private_key,
        })

    @staticmethod
    def build_google_api_client(*args, **kwargs):
        return buildGoogleApiClient(*args, **kwargs)

    @staticmethod
    def get_rows_from_stream(stream, size: int, remove_last_row: bool = True):
        """
        Get the X number of rows from a stream, the delimiter is newline
        """
        stream.seek(0)
        lines = stream.readlines()
        if (remove_last_row):
            lines = lines[:-1]  # remove the last line as might be partial

        return lines[:size]  # get only the first X rows

    @staticmethod
    def list_to_bytes_stream(list, delimiter=b'\n') -> io.BytesIO:
        """
        Convert a list to a stream object (BytesIO)
        """
        return io.BytesIO(bytes(delimiter.join(list)))

    @staticmethod
    # NOSONAR (S3776:Complexity) - won't fix
    def get_date_range(*, since: str, until: str, trigger_type: str, schedule_rate="") -> Tuple[date, date]:
        """
        Get Date Range
        ondemand/once-off:
            use date range parsed from client side if
        scheduled:
            calculate the date range based on utc time now
            e.g. if weekly, start = 1 week ago, end = utc now
        """
        try:
            since_date = dateparser.parse(since).date()
        except (TypeError, OverflowError, dateparser.ParserError):
            print("Failed to parse start date: ", since)
            since_date = None
        try:
            until_date = dateparser.parse(until).date()
        except (TypeError, OverflowError, dateparser.ParserError):
            print("Failed to parse end date: ", until)
            until_date = None

        today = datetime.utcnow().date()

        if trigger_type == "SCHEDULE":
            if schedule_rate is None or schedule_rate == "":
                raise InvalidScheduleRateException(
                    "Invalid schedule frequency: ", schedule_rate)
            elif until_date and today > until_date:
                raise DateRangeException("Expired schedule")
            elif since_date and since_date > today:
                raise DateRangeException("Import has not started yet")
            else:
                pattern = r'rate\((\d+)\s(days?|weeks?|months?)\)'
                matched = re.findall(
                    pattern, schedule_rate, flags=re.IGNORECASE)
                if len(matched) == 1:
                    freq = int(matched[0][0])
                    freq_unit = str(matched[0][1])
                    freq_unit = freq_unit + \
                        ("" if freq_unit.endswith("s") else "s")
                    delta = relativedelta()
                    setattr(delta, freq_unit, freq)
                    last_n = today - delta
                    print("freq: ", freq_unit, ", delta: ", delta)
                    print(last_n, today)
                    return (last_n, today)
                else:
                    raise InvalidScheduleRateException(
                        "Not supported schedule rate")
        else:
            # treat everything else as once off
            print("On demand importing")
            if since_date is None or until_date is None:
                raise UnsupportedDataFormatException(
                    "Not supported date format")
            elif since_date > until_date:
                raise DateRangeException(
                    "Start date cannot be greater than end date")
            return (since_date, until_date)

class PreviewGlueConnection():
    def __init__(self, jdbc_connection_string: str, source_details: ISourceDetails, db_password: str, boto3_session: any):
        self.source_details = source_details
        self.jdbc_connection_string = jdbc_connection_string
        self.client = boto3_session.client('glue')
        self.db_password = db_password

    def __enter__(self):
        # create create glue connection
        self.glue_connection_name = "ada-preview-connect-" + uuid.uuid4().hex
        self.client.create_connection(
            ConnectionInput={
                'Name': self.glue_connection_name,
                'Description': 'ada-glue-connect-for-preview',
                'ConnectionType': 'JDBC',
                'ConnectionProperties': {
                    'JDBC_CONNECTION_URL': self.jdbc_connection_string,
                    'USERNAME': self.source_details['username'],
                    'PASSWORD': self.db_password,
                    'JDBC_ENFORCE_SSL': 'false',
                },
                'PhysicalConnectionRequirements': {
                    'SubnetId': self.source_details['subnetIds'][0],
                    'SecurityGroupIdList': self.source_details['securityGroupIds'],
                }
            }
        )
        return self.glue_connection_name

    def __exit__(self, *args):
        self.client.delete_connection(ConnectionName=self.glue_connection_name)
        