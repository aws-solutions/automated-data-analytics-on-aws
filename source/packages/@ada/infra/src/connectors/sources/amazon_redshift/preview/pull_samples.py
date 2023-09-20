###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import redshift_connector
import boto3
from handlers.common import * # NOSONAR
from datetime import datetime
from botocore.config import Config

def get_redshift_client(boto3_session, database_type: str, session_name: str, endpoint: str, cross_account_access_role: str): 
    boto_session = get_boto3_session(boto3_session, session_name, cross_account_access_role)
    
    client_config = get_client_config(endpoint)
    
    if database_type == 'Cluster':
        return boto_session.client('redshift', config=client_config)
    
    return boto_session.client('redshift-serverless', config=client_config)

def get_boto3_session(boto3_session, session_name: str, cross_account_access_role: str):
    
    if not cross_account_access_role:
        return boto3_session
    
    print(f"Assuming Cross account access role {cross_account_access_role}")
    sts_client = boto3_session.client('sts')
    assumed_role = sts_client.assume_role(
        RoleArn=cross_account_access_role,
        RoleSessionName=session_name,
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

def get_client_config(endpoint: str): 
    region = endpoint.split('.')[-4]

    print(f"Client config region {region}")
    
    return Config(
        region_name=region,
        signature_version='v4'
    )

def get_creds(redshift_client, database_type: str, database: str, username: str, cluster_identifier: str, workgroup: str):
    if database_type == 'Cluster':
        creds = redshift_client.get_cluster_credentials(DbUser=username,
                                                           DbName=database,
                                                           ClusterIdentifier=cluster_identifier,
                                                           AutoCreate=False,
                                                           DurationSeconds=3600
                                                        )
        
        return {
            'username': creds['DbUser'],
            'password': creds['DbPassword'],
        }
    
    creds = redshift_client.get_credentials(dbName=database,
                                                durationSeconds=3600,
                                                workgroupName=workgroup
                                            )
        
    return {
        'username': creds['dbUser'],
        'password': creds['dbPassword'],
    }

def pull_samples(input: IPullSamplesInput) -> IPullSamplesReturn: # NOSONAR (python:S3776) - false positive
    """
    Pull data samples from Redshift
    """
    boto3_session = input.boto3_session
    source_details = input.source_details
    sample_size = input.sample_size

    endpoint = source_details["databaseEndpoint"]
    port = int(source_details["databasePort"])
    database = source_details["databaseName"]
    table = source_details["databaseTable"]
    database_type = source_details["databaseType"]
    workgroup = source_details["workgroup"]
    username = source_details["databaseUsername"]
    cluster_identifier = source_details["clusterIdentifier"]
    cross_account_access_role = source_details["crossAccountRoleArn"]

    session_name=str(round(datetime.timestamp(datetime.now())))

    redshift_client = get_redshift_client(boto3_session, database_type, session_name, endpoint, cross_account_access_role)

    creds = get_creds(redshift_client, database_type, database, username, cluster_identifier, workgroup)

    with redshift_connector.connect(
            host=endpoint,
            port=port,
            user=creds['username'],
            password=creds['password'],
            database=database
        ) as conn: 

        with conn.cursor() as cursor: 
            cursor.execute(f"SELECT * FROM {table.replace('`', '')} LIMIT {str(sample_size)}")
                    
            result = cursor.fetch_dataframe()
    
            return [Sample(DEFAULT_DATASET_ID, next(iter([result])), 'parquet')]
    
