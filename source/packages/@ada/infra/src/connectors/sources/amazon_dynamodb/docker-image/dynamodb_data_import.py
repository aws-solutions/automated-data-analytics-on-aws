###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import os
import boto3
import awswrangler as wr
from datetime import datetime
from botocore.config import Config
from decimal import Decimal
from dateutil import parser
import pandas as pd
import time

# These are the Required Environment Variables input into the State
# Machine. Values are input into the DynamoDBImportDataStateMachine
# class as taskEnv object

TABLE_ARN = os.environ.get('TABLE_ARN')
S3_OUTPUT_BUCKET_URI = os.environ.get('S3_OUTPUT_BUCKET_URI')
TRIGGER_TYPE = os.environ.get("TRIGGER_TYPE")
SCHEDULE_RATE = os.environ.get("SCHEDULE_RATE")
TABLE_NAME = os.environ.get("TABLE_NAME")
DOMAIN_ID = os.environ.get("DOMAIN_ID")
DATA_PRODUCT_ID = os.environ.get("DATA_PRODUCT_ID")
CROSS_ACCOUNT_ACCESS_ROLE = os.environ.get("CROSS_ACCOUNT_ACCESS_ROLE") 

class DateRangeException(Exception):
    pass
class MissingParameterException(Exception):
    pass
class EmptyDatasetException(Exception):
    pass

class DynamoDBImport():
    def __init__(self, 
                 table_arn: str, 
                 cross_account_role_arn: str,
                 s3_output_uri: str,
                 last_updated_table_name: str,
                 data_product_id: str,
                 domain_id: str,
                 trigger_type: str) -> None:

        if table_arn is None or table_arn == '':
            raise MissingParameterException("DynamoDB Table ARN is missing")
        if s3_output_uri is None or s3_output_uri == '':
            raise MissingParameterException("S3 Bucket URI is missing")
        if last_updated_table_name is None or last_updated_table_name == '':
            raise MissingParameterException("Last Updated Detail Table Name is missing")
        if data_product_id is None or data_product_id == '':
            raise MissingParameterException("Data Product ID is missing")
        if domain_id is None or domain_id == '':
            raise MissingParameterException("Domain Id is missing")
        if trigger_type is None or trigger_type == '':
            raise MissingParameterException("Trigger Type is missing")


        self._table_arn = table_arn
        self._cross_account_role_arn = cross_account_role_arn
        self._s3_output_uri = s3_output_uri.rstrip('/')
        self._ddb_client = boto3.client('dynamodb')
        self._last_updated_table_name = last_updated_table_name
        self._data_product_id = data_product_id
        self._domain_id = domain_id
        self._trigger_type = trigger_type
        self._range_filename = datetime.now()
        self._sts_client = boto3.client('sts')

    def execute(self):
        try:
            result_count = self._import_data()
            self._update_last_updated_timestamp(result_count)
            
        except (TypeError, parser.ParserError) as error:
            raise DateRangeException("Error writing records from dynamoDB") from error

    def _import_data(self):
        print(f"Conducting data import of {self._table_arn}")

        arn_parts = self._get_arn_parts(self._table_arn)

        ddb_table_name = arn_parts['table_name']

        client_config = Config(
            region_name=arn_parts['region'],
            signature_version='v4',
            retries={
                'max_attempts': 10,
                'mode': 'standard'
            }
        )

        # # Get the service resource.
        if not self._cross_account_role_arn:
            dynamodb = boto3.resource('dynamodb', config=client_config)
        else:
            boto3_session = self._assume_pull_data_sample_role_session(self._cross_account_role_arn)
            dynamodb = boto3_session.resource('dynamodb', config=client_config)

        table = dynamodb.Table(ddb_table_name)
        ended = False
        start_key = None
        count = 0
        result_count = 0
        while not ended:

            if start_key:
                response = table.scan(ExclusiveStartKey=start_key)
            else:
                response = table.scan()
            
            results = response['Items']
            result_count += response['Count']

            if result_count > 0:
                df = next(iter([pd.DataFrame(data=results)]))
                # 'Decimal' further along the journey isn't supported
                for col in df:
                    if isinstance(df[col][0], Decimal):
                        df[col] = pd.to_numeric(df[col], errors='coerce')

                df.columns = map(str.lower, df.columns)
                self._write_logs(df, count)
            
                count = count + 1
            if "LastEvaluatedKey" in response.keys():
                start_key = response["LastEvaluatedKey"]
                time.sleep(1) # Maybe remove? But prevent too much scanning in a short amount of time
            else:
                ended = True

        if result_count == 0:
            raise EmptyDatasetException('Source dataset is empty')

        return result_count

    def _get_arn_parts(self, table_arn: str):
        try:
            table_name = table_arn.split('table/', 1)[1]

            region = table_arn.split(':')[3]

            return {
                'region': region,
                'table_name': table_name
            }
        except Exception as exce:
            raise Exception('Invalid Table ARN') from exce

    def _write_logs(self, logs: pd.DataFrame, page: int) -> None:            
        print(f'{self._s3_output_uri}/{self._range_filename}/{page}')
        wr.s3.to_parquet(
            df=logs,
            path=f'{self._s3_output_uri}/{self._range_filename}/{page}.parquet',
        )

    def _update_last_updated_timestamp(self, result_count) -> None:
        print(f"Updating last update timestamp with: {self._range_filename}")
        self._ddb_client.put_item(
            TableName=self._last_updated_table_name,
            Item={
              'dataProductId': {'S': self._data_product_id},
              'domainId': {'S': self._domain_id},
              'timestamp': {'S': str(self._range_filename)},
              'num_rows': {'S': str(result_count)},
            }
        )

    def _assume_pull_data_sample_role_session(self, role_arn: str):
        assumed_role = self._sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName=str(round(datetime.timestamp(self._range_filename))),
            Tags=[
                {'Key': 'ada:service', 'Value': 'data-product'}
            ]
        )
        credentials = assumed_role['Credentials']
        return boto3.session.Session(
            aws_access_key_id=credentials['AccessKeyId'],
            aws_secret_access_key=credentials['SecretAccessKey'],
            aws_session_token=credentials['SessionToken'],
        )

if __name__ == "__main__":
    ddbi = DynamoDBImport(TABLE_ARN,
                        CROSS_ACCOUNT_ACCESS_ROLE,
                        S3_OUTPUT_BUCKET_URI,
                        TABLE_NAME,
                        DATA_PRODUCT_ID,
                        DOMAIN_ID,
                        TRIGGER_TYPE)

    print("Executing DynamoDBImport")
    ddbi.execute()
    