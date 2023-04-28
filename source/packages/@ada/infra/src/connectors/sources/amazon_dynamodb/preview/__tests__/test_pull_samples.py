###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import json
from unittest.mock import patch

import pytest
from handlers.__tests__.sampling_helpers import SamplingTestHelpers
from handlers.common import *  # NOSONAR
from handlers.sampling import *  # NOSONAR

@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_dynamodb_green_path(boto_client, s3):
    source_details = {
        "dynamoDbTableArn": "arn:aws:dynamodb:us-west-2:00000000000:table/1-test-data",
        "crossAccountRoleArn": "",
    }
    boto_client.side_effect = [{
        "Plaintext": json.dumps(source_details).encode('utf-8')
    }, {
        "Credentials": {
            "AccessKeyId": "TestAccessKeyId",
            "SecretAccessKey": "TestSecretAccessKey",
            "SessionToken": "TestSessionToken",
        }
    }, {
        "Items": [{'Food': 'Beef', 'id': 'two', 'Name': 'Cow'}]
    }]

    table_details = SamplingTestHelpers.pull_data_sample(
        'DYNAMODB', source_details)['tableDetails']

    assert len(table_details) == 1
    assert s3.to_parquet.called

@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_dynamodb_table_arn_except(boto_client, s3):

    with pytest.raises((IndexError,Exception)):
        source_details = {
            "dynamoDbTableArn": "badTableARN",
            "crossAccountRoleArn": "",
        }
        boto_client.side_effect = [{
            "Plaintext": json.dumps(source_details).encode('utf-8')
        }, {
            "Credentials": {
                "AccessKeyId": "TestAccessKeyId",
                "SecretAccessKey": "TestSecretAccessKey",
                "SessionToken": "TestSessionToken",
            }
        }, {
            "Items": [{"id": "id1"}],
        }]

        _table_details = SamplingTestHelpers.pull_data_sample(
            'DYNAMODB', source_details)['tableDetails']
    
    assert not s3.to_parquet.called