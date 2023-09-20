###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import json
from unittest.mock import patch, MagicMock
import pandas as pd

import pytest
from handlers.__tests__.sampling_helpers import SamplingTestHelpers
from handlers.common import *  # NOSONAR
from handlers.sampling import *  # NOSONAR

test_data = pd.DataFrame({
    'Column1': ['11', '21'],
    'Column2': ['12', '22']
})

@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
@patch("redshift_connector.connect")
def test_pull_data_sample_redshift_serverless_happy_path(redshift_connection, boto_client, s3):
    source_details = {
        "databaseEndpoint": "default.123456789012.us-east-1.redshift-serverless.amazonaws.com",
        "databasePort": "5439",
        "databaseName": "dev",
        "databaseTable": "sample_data_dev",
        "databaseType": "Serverless",
        "workgroup": "default",
        "databaseUsername": "",
        "clusterIdentifier": "",
        "crossAccountRoleArn": ""
    }

    mock_conn = MagicMock()
    mock_cursor = mock_conn.cursor.return_value
    mock_cursor.execute.return_value = None
    mock_cursor.fetch_dataframe.return_value = test_data
    redshift_connection.return_value = mock_conn
    
    boto_client.side_effect = [{
        "Plaintext": json.dumps(source_details).encode('utf-8'),
    }, {
        "Credentials": {
            "AccessKeyId": "TestAccessKeyId",
            "SecretAccessKey": "TestSecretAccessKey",
            "SessionToken": "TestSessionToken",
        }
    }, {
        "dbUser": "username",
        "dbPassword": "password"
    }]

    table_details = SamplingTestHelpers.pull_data_sample(
        'REDSHIFT', source_details)['tableDetails']

    assert len(table_details) == 1
    assert s3.to_parquet.called

@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
@patch("redshift_connector.connect")
def test_pull_data_sample_redshift_cluster_happy_path(redshift_connection, boto_client, s3):
    source_details = {
        "databaseEndpoint": "test-redshift-cluster.c9reiliclukz.us-east-1.redshift.amazonaws.com",
        "databasePort": "5439",
        "databaseName": "dev",
        "databaseTable": "sample_data_dev",
        "databaseType": "Cluster",
        "workgroup": "",
        "databaseUsername": "awsuser",
        "clusterIdentifier": "test-redshift-cluster",
        "crossAccountRoleArn": ""
    }
    
    boto_client.side_effect = [{
        "Plaintext": json.dumps(source_details).encode('utf-8'),
    }, {
        "Credentials": {
            "AccessKeyId": "TestAccessKeyId",
            "SecretAccessKey": "TestSecretAccessKey",
            "SessionToken": "TestSessionToken",
        }
    }, {
        "DbUser": "username",
        "DbPassword": "password"
    }]

    table_details = SamplingTestHelpers.pull_data_sample(
        'REDSHIFT', source_details)['tableDetails']

    assert len(table_details) == 1
    assert s3.to_parquet.called
