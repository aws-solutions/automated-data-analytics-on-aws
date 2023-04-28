###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import re
import awswrangler as wr
import os
import uuid

from handlers.common import *  # NOSONAR
from handlers.sampling.common import SamplingUtils  # NOSONAR
from handlers.sampling.common import PreviewGlueConnection  # NOSONAR
from handlers.sampling.common import SecretsManager  # NOSONAR
import pandas as pd

SOURCEDETAILS_CREDENTIAL_FIELD_NAME = 'password'
SOURCEDETAILS_CREDENTIAL_SECRET_NAME = 'dbCredentialSecretName'

def pull_samples(input: IPullSamplesInput) -> IPullSamplesReturn:  # NOSONAR (python:S3776) - false positive
    """
    Pull sample data from PostgreSQL Database
    """
    boto3_session = input.boto3_session
    source_details = input.source_details
    sample_size = input.sample_size

    jdbc_connection_string = "jdbc:postgresql://" + \
        source_details['databaseEndpoint'] + ":" + source_details['databasePort'] + "/" + source_details['databaseName']

    # retrieve password from source details
    db_password = SecretsManager.get_credentials_from_source( 
        source_details, 
        SOURCEDETAILS_CREDENTIAL_FIELD_NAME, 
        SOURCEDETAILS_CREDENTIAL_SECRET_NAME
    )

    with PreviewGlueConnection(jdbc_connection_string, source_details, db_password, boto3_session) as glue_connection_name:
        # sanitise and construct table name
        table_name = '"{}"'.format(source_details['databaseTable'].replace('"', ''))
        if source_details['databaseSchema'] != '':
            table_name = '"{}".{}'.format(source_details['databaseSchema'].replace('"', ''),table_name)

        # aws wrangler to connect to mysql db and pull out a preview
        sql_query = "SELECT * FROM " + table_name + " LIMIT " + str(sample_size)
        try:
            df = None
            connnection = wr.postgresql.connect(glue_connection_name, boto3_session=boto3_session)
            df = pd.DataFrame(wr.postgresql.read_sql_query(sql=sql_query, con=connnection))
            connnection.close()
        except Exception as e:
            print(e)

    return [Sample(source_details['databaseTable'], next(iter([df])), 'parquet')]
