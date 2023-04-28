###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import pytest
import json
from unittest.mock import patch
import pandas as pd
from moto import mock_sts

from handlers.common import *  # NOSONAR
from handlers.sampling import *  # NOSONAR
from handlers.__tests__.sampling_helpers import SamplingTestHelpers


@pytest.fixture
def pd_data():
    """Mock CloudWatch return data"""
    return {
        "timestamp": [
            "2022-12-09 00:15:12.267",
            "2022-12-08 22:39:08.445",
            "2022-12-08 15:16:14.981",
            "2022-12-08 14:48:38.473",
        ],
        "message": [
            "[0%] start: Building and publishing c21243e1b8",
            "ada-dp-9192-cw-no-5191-071f: creating Cloudwatch",
            "Changeset arn:aws:cloudformation:ap-southeast-2",
            "[100%] success: Built and published c21243e1b8",
        ],
        "ptr": [
            "CpcBClwKWDExODE3NjIzMzI4ODovYXdzL2xhbWJkYS9BZG",
            "CpcBClwKWDExODE3NjIzMzI4ODovYXdzL2xhbWJkYS9BZG",
            "CpcBClwKWDExODE3NjIzMzI4ODovYXdzL2xhbWJkYS9BZG",
            "CpcBClwKWDExODE3NjIzMzI4ODovYXdzL2xhbWJkYS9BZG",
        ],
    }


@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_cloudwatch(boto_client, s3, mocker, pd_data):
    mocker.patch("awswrangler.cloudwatch.read_logs", return_value=pd.DataFrame(pd_data))
    source_details = {
        "since": "30/06/2022",
        "cloudwatchLogGroupArn": "arn:aws:logs:ap-southeast-2:00000000000:log-group:/aws/lambda/cw:*",
        "query": "query",
    }
    boto_client.side_effect = [
        {"Plaintext": json.dumps(source_details).encode("utf-8")},
        {
            "Credentials": {
                "AccessKeyId": "TestAccessKeyId",
                "SecretAccessKey": "TestSecretAccessKey",
                "SessionToken": "TestSessionToken",
            }
        },
    ]

    table_details = SamplingTestHelpers.pull_data_sample("CLOUDWATCH", source_details)[
        "tableDetails"
    ]

    assert len(table_details) == 1
    assert s3.to_parquet.called


@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_cloudwatch_no_data_raises(boto_client):

    source_details = {
        "since": "30/06/2022",
        "cloudwatchLogGroupArn": "arn:aws:logs:ap-southeast-2:00000000000:log-group:/aws/lambda/cw:*",
        "query": "query",
        "crossAccountRoleArn": "arn:aws:iam::111111111111:role/xacctrole",
    }
    boto_client.side_effect = [
        {"Plaintext": json.dumps(source_details).encode("utf-8")},
        {
            "Credentials": {
                "AccessKeyId": "TestAccessKeyId",
                "SecretAccessKey": "TestSecretAccessKey",
                "SessionToken": "TestSessionToken",
            }
        },
    ]
    with pytest.raises(Exception):
        SamplingTestHelpers.pull_data_sample("CLOUDWATCH", source_details)[
            "tableDetails"
        ]
