###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import awswrangler as wr
import boto3
import pandas as pd
from handlers.common import * # NOSONAR
from handlers.sampling.common import SamplingUtils # NOSONAR


def assume_pull_data_sample_role_session(sts_client, role_arn: str):
    assumed_role = sts_client.assume_role(
        RoleArn=role_arn,
        RoleSessionName="ada-cloudwatch-schemapreview-import",
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
    Pull data samples from data source
    """    
    boto3_session = input.boto3_session

    log_grp_arn = input.source_details['cloudwatchLogGroupArn']
    log_grp_name = log_grp_arn.split(':log-group:')[1].split(':*')[0]

    if 'crossAccountRoleArn' in input.source_details:
        cross_account_access_role = input.source_details['crossAccountRoleArn']
        if cross_account_access_role != '' and cross_account_access_role is not None:
            boto3_session = assume_pull_data_sample_role_session(
                boto3_session.client('sts'), cross_account_access_role)

    try:
        df = wr.cloudwatch.read_logs(
            log_group_names=[log_grp_name],
            query=input.source_details["query"],
            boto3_session=boto3_session,
            limit=10
        )
        # remove nonmeaningful ptr column returned
        df = df.drop(['ptr'], axis=1, errors='ignore')

        return [Sample(DEFAULT_DATASET_ID, df, 'parquet')]
    except Exception as e:
        print("Failed to read cw logs: {}", e)
 
