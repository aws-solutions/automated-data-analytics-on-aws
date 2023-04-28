###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
from botocore.config import Config
from decimal import Decimal
from datetime import datetime
import boto3

from handlers.common import *  # NOSONAR
import pandas as pd

# Split up the ARN into distinct parts
def get_arn_parts(table_arn: str):
    try:
        table_name = table_arn.split('table/', 1)[1]

        region = table_arn.split(':')[3]

        return {
            'region': region,
            'table_name': table_name
        }
    except Exception as exce:
        raise Exception('Invalid Table ARN') from exce

# A specific session for cross account roles needs to be established to query DynamoDB
def assume_pull_data_sample_role_session(sts_client, role_arn: str):
    assumed_role = sts_client.assume_role(
        RoleArn=role_arn,
        RoleSessionName=str(round(datetime.timestamp(datetime.now()))),
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


def pull_samples(input: IPullSamplesInput) -> IPullSamplesReturn: # NOSONAR (python:S3776) - false positive
    """
    Pull data samples from DynamoDB
    """
    boto3_session = input.boto3_session
    source_details = input.source_details
    sample_size = input.sample_size

    ddb_table_arn = source_details["dynamoDbTableArn"]
    cross_account_role_arn = source_details['crossAccountRoleArn']
    arn_parts = get_arn_parts(ddb_table_arn)

    ddb_table_name = arn_parts['table_name']

    client_config = Config(
        region_name=arn_parts['region'],
        signature_version='v4',
        retries={
            'max_attempts': 10,
            'mode': 'standard'
        }
    )

    print('DynamoDB Table Arn: {ddb_table_arn}'.format(
        ddb_table_arn=ddb_table_arn))

    # Get the service resource.
    if not cross_account_role_arn:
        dynamodb = boto3_session.resource('dynamodb', config=client_config)
    else:
        sts_client = boto3_session.client('sts')
        boto3_x_acc_session = assume_pull_data_sample_role_session(sts_client, cross_account_role_arn)
        dynamodb = boto3_x_acc_session.resource('dynamodb', config=client_config)

    table = dynamodb.Table(ddb_table_name)

    response = table.scan(Limit=sample_size)

    results = response['Items']

    df = next(iter([pd.DataFrame(data=results)]))

    for col in df:
        if isinstance(df[col][0], Decimal):
            print(f"{df[col]} is of type Decimal")
            df[col] = pd.to_numeric(df[col], errors='coerce')

    return [Sample(DEFAULT_DATASET_ID, df, 'parquet')]
