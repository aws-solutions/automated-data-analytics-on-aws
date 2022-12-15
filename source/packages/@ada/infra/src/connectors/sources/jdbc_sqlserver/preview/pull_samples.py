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
    Pull sample data from Microsoft SQL Server
    """
    boto3_session = input.boto3_session
    source_details = input.source_details
    sample_size = input.sample_size

    jdbc_connection_string = "jdbc:sqlserver://" + \
        source_details['databaseEndpoint'] + ":" + source_details['databasePort'] + ";databaseName=" + source_details['databaseName']

    with PreviewGlueConnection(jdbc_connection_string, source_details, boto3_session) as glue_connection_name:
        # aws wrangler to connect to mysql db and pull out a preview
        # sanitise and construct table name
        table_name = '"{}"'.format(source_details['databaseTable'].replace('"', ''))
        if source_details['databaseSchema'] != '':
            table_name = '"{}".{}'.format(source_details['databaseSchema'].replace('"', ''),table_name)
        sql_query = "SELECT TOP " + str(sample_size) + " * FROM " + table_name
        try:
            df = None
            con_sqlserver = wr.sqlserver.connect(glue_connection_name)
            df = pd.DataFrame(wr.sqlserver.read_sql_query(sql=sql_query, con=con_sqlserver))
            con_sqlserver.close()
        except Exception as e:
            print(e)

    return [Sample(source_details['databaseTable'], next(iter([df])), 'parquet')]
