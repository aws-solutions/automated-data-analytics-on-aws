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
import pandas as pd


def pull_samples(input: IPullSamplesInput) -> IPullSamplesReturn:  # NOSONAR (python:S3776) - false positive
    """
    Pull sample data from PostgreSQL Database
    """
    boto3_session = input.boto3_session
    source_details = input.source_details
    sample_size = input.sample_size

    jdbc_connection_string = "jdbc:postgresql://" + \
        source_details['databaseEndpoint'] + ":" + source_details['databasePort'] + "/" + source_details['databaseName']

    with PreviewGlueConnection(jdbc_connection_string, source_details, boto3_session) as glue_connection_name:
        # sanitise and construct table name
        table_name = '"{}"'.format(source_details['databaseTable'].replace('"', ''))
        if source_details['databaseSchema'] != '':
            table_name = '"{}".{}'.format(source_details['databaseSchema'].replace('"', ''),table_name)

        # aws wrangler to connect to mysql db and pull out a preview
        sql_query = "SELECT * FROM " + table_name + " LIMIT " + str(sample_size)
        try:
            df = None
            connnection = wr.postgresql.connect(glue_connection_name)
            df = pd.DataFrame(wr.postgresql.read_sql_query(sql=sql_query, con=connnection))
            connnection.close()
        except Exception as e:
            print(e)

    return [Sample(source_details['databaseTable'], next(iter([df])), 'parquet')]
