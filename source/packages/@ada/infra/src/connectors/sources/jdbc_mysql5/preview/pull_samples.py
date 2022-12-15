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
    Pull sample data from MySQL Database
    """
    boto3_session = input.boto3_session
    source_details = input.source_details
    sample_size = input.sample_size

    jdbc_connection_string = "jdbc:mysql://" + \
        source_details['databaseEndpoint'] + ":" + source_details['databasePort'] + "/" + source_details['databaseName']

    with PreviewGlueConnection(jdbc_connection_string, source_details, boto3_session) as glue_connection_name:
        # aws wrangler to connect to mysql db and pull out a preview
        # sanitize sql table name to prevent sql injection
        table_name = source_details['databaseTable'].replace('`', '') 
        sql_query = "SELECT * FROM `" + table_name + "` LIMIT " + str(sample_size)
        try:
            df = None
            con_mysql = wr.mysql.connect(glue_connection_name)
            df = pd.DataFrame(wr.mysql.read_sql_query(sql=sql_query, con=con_mysql))
            con_mysql.close()
        except Exception as e:
            print(e)

    return [Sample(source_details['databaseTable'], next(iter([df])), 'parquet')]
