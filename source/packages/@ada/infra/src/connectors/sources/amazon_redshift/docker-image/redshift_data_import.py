###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import os
import boto3
import awswrangler as wr
from datetime import datetime
from botocore.config import Config
import pandas as pd
import redshift_connector

# These are the Required Environment Variables input into the State
# Machine. Values are input into the RedshiftDataStateMachine
# class as taskEnv object

ENDPOINT = os.environ.get('DATABASE_ENDPOINT')
PORT=os.environ.get('DATABASE_PORT')
DATABASE_NAME = os.environ.get('DATABASE_NAME')
DATABASE_TABLE = os.environ.get('DATABASE_TABLE')

DATABASE_TYPE = os.environ.get('DATABASE_TYPE')

WORKGROUP = os.environ.get("WORKGROUP")

DATABASE_USERNAME = os.environ.get('DATABASE_USERNAME')
CLUSTER_IDENTIFIER = os.environ.get('CLUSTER_IDENTIFIER')

S3_OUTPUT_BUCKET_URI = os.environ.get('S3_OUTPUT_BUCKET_URI')
TABLE_NAME = os.environ.get("TABLE_NAME")
TRIGGER_TYPE = os.environ.get("TRIGGER_TYPE")
DOMAIN_ID = os.environ.get("DOMAIN_ID")
DATA_PRODUCT_ID = os.environ.get("DATA_PRODUCT_ID")
CROSS_ACCOUNT_ACCESS_ROLE = os.environ.get("CROSS_ACCOUNT_ACCESS_ROLE") 

class MissingParameterException(Exception):
    pass

class RedshiftImport():
    def __init__(self, 
             endpoint: str, 
             port: str,
             database: str,
             table: str,
             database_type: str,
             workgroup: str,
             username: str,
             cluster_identifier: str,
             cross_account_access_role: str,
             s3_output_uri: str,
             last_updated_table_name: str,
             data_product_id: str,
             domain_id: str,
             trigger_type: str
            )-> None:

        if endpoint is None or endpoint == '':
            raise MissingParameterException("Endpoint is missing")
        if port is None or port == '':
            raise MissingParameterException("Port is missing")
        if database is None or database == '':
            raise MissingParameterException("Database name is missing")
        if table is None or table == '':
            raise MissingParameterException("Database name is missing")
        if database_type != 'Cluster' and (workgroup is None or workgroup == ''):
             raise MissingParameterException("Workgroup is required for Redshift Serverless")
        if database_type == 'Cluster' and (username is None or username == ''):
             raise MissingParameterException("Database username is required for Redshift Cluster")   
        if database_type == 'Cluster' and (cluster_identifier is None or cluster_identifier == ''):
             raise MissingParameterException("Cluster identifier is required for Redshift Cluster")  
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

        self._endpoint = endpoint
        self._port = int(port)
        self._database = database
        self._table = table.replace('`', '')
        
        self._database_type = database_type
        
        self._workgroup = workgroup
        
        self._username = username
        self._cluster_identifier = cluster_identifier
        
        self._s3_output_uri = s3_output_uri
        self._ddb_client = boto3.client("dynamodb")
        self._last_updated_table_name = last_updated_table_name
        self._data_product_id = data_product_id
        self._domain_id = domain_id
        self._trigger_type = trigger_type

        self._sts_client = boto3.client("sts")
        
        session_name = str(datetime.now()).replace(' ', '-').replace(':', '-').replace('.', '-')
        self._range_filename = session_name
        self._redshift_client = self._get_redshift_client(database_type, session_name, self._endpoint, cross_account_access_role)

    def execute(self):
        result_count = self._import_data()
        self._update_last_updated_timestamp(result_count)

    def _import_data(self):
        print(f"Getting temporary credential")

        creds = self._get_creds()

        print(f"Connecting to {self._endpoint}")

        with redshift_connector.connect(
            host=self._endpoint,
            port=self._port,
            user=creds['username'],
            password=creds['password'],
            database=self._database
        ) as conn:

            with conn.cursor() as cursor:
                query = f'SELECT * FROM {self._table}'
                print(f"Executing query: {query}")
                
                cursor.execute(query)
                
                result = cursor.fetch_dataframe()

                num_records = len(result.index)
                
                print(f"Writing {num_records} records")
                
                self._write_data(result)
                return num_records
        
    def _write_data(self, data: pd.DataFrame) -> None: 
        file_name = f'{self._s3_output_uri}{self._range_filename}.parquet'     
        print('Filename: ', file_name)
        wr.s3.to_parquet(
            df=data,
            path=file_name,
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

    def _get_redshift_client(self, database_type: str, session_name: str, endpoint: str, cross_account_access_role: str): 
        boto3_session = self._get_boto3_session(session_name, cross_account_access_role)
        
        client_config = self._get_client_config(endpoint)
        
        if database_type == 'Cluster':
            return boto3_session.client('redshift', config=client_config)
        
        return boto3_session.client('redshift-serverless', config=client_config)

    def _get_boto3_session(self, session_name: str, cross_account_access_role: str):
        
        if not cross_account_access_role:
            return boto3
        
        print(f"Assuming Cross account access role {cross_account_access_role}")
        
        assumed_role = self._sts_client.assume_role(
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

    def _get_client_config(self, endpoint: str): 
        region = endpoint.split('.')[-4]
    
        print(f"Client config region {region}")
        
        return Config(
            region_name=region,
            signature_version='v4'
        )
        
    def _get_creds(self):
        if self._database_type == 'Cluster':
            creds = self._redshift_client.get_cluster_credentials(DbUser=self._username,
                                                               DbName=self._database,
                                                               ClusterIdentifier=self._cluster_identifier,
                                                               AutoCreate=False,
                                                               DurationSeconds=3600
                                                            )
            
            return {
                'username': creds['DbUser'],
                'password': creds['DbPassword'],
            }
        
        creds = self._redshift_client.get_credentials(dbName=self._database,
                                                    durationSeconds=3600,
                                                    workgroupName=self._workgroup
                                                )
            
        return {
            'username': creds['dbUser'],
            'password': creds['dbPassword'],
        }

if __name__ == "__main__":
    redshift_import = RedshiftImport(ENDPOINT, 
                        PORT,
                        DATABASE_NAME,
                        DATABASE_TABLE,
                        DATABASE_TYPE,
                        WORKGROUP,
                        DATABASE_USERNAME,
                        CLUSTER_IDENTIFIER,
                        CROSS_ACCOUNT_ACCESS_ROLE,
                        S3_OUTPUT_BUCKET_URI,
                        TABLE_NAME,
                        DATA_PRODUCT_ID,
                        DOMAIN_ID,
                        TRIGGER_TYPE)

    print("Executing RedshiftImport")
    redshift_import.execute()
    