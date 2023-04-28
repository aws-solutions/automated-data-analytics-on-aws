###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import json
import pytest
import pandas as pd

from unittest.mock import patch
from handlers.__tests__.sampling_helpers import SamplingTestHelpers
from handlers.common import *  # NOSONAR
from handlers.sampling import *  # NOSONAR

DATA_FRAME_ALL = {
    'Records': [
        {
            'eventVersion': '1.08', 
            'eventTime': '2022-12-01T09:17:49Z', 
            'awsRegion': 'ap-northeast-1',
            'eventID': '27966f5424dad358688db75e8f2eb070',
            'eventType': 'AwsApiCall',
            'eventCategory': 'Data'
        }        
    ]
}

@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_cloudtrail_all_events(boto_client, s3):
    source_details = {
        "cloudTrailTrailArn": "arn:aws:cloudtrail:ap-southeast-2:123456789012:trail/test-trail",
        "cloudTrailEventTypes": "Data & Management & Insight",
        "cloudTrailDateFrom": "2022-12-01T00:00:00.000Z",
        "cloudTrailDateTo": "2022-12-02T00:00:00.000Z",
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
        'Trail': {
            'Name': 'a-tester-trail',
            'S3BucketName': 'aws-cloudtrail-test-logs-123456789',
            'IncludeGlobalServiceEvents': True,
            'IsMultiRegionTrail': True,
            'HomeRegion': 'ap-southeast-2',
            'TrailARN': 'arn:aws:cloudtrail:ap-southeast-2:123456789012:trail/tester-trail',
            'LogFileValidationEnabled': True,
            'KmsKeyId': 'arn:aws:kms:ap-southeast-2:123456789012:key/da677d31-0d1a-4cfb-a175-a72be50a9210',
            'HasCustomEventSelectors': True,
            'HasInsightSelectors': True,
            'IsOrganizationTrail': False
        },
        'ResponseMetadata': {
            'RequestId': '54a58ea6-9abe-4e62-9ff7-eca71bb77ed0',
            'HTTPStatusCode': 200,
            'HTTPHeaders': {
                'x-amzn-requestid': '52b59ea7-9abe-4e62-9ff7-eca71ee66ed0',
                'content-type': 'application/x-amz-json-1.1',
                'content-length': '477',
                'date': 'Mon, 05 Dec 2022 08:00:00 GMT'
            },
            'RetryAttempts': 0
        }
    }, {
        'Regions': [
            {'RegionName': 'us-east-1'}
        ]
    }, {
        'Regions': [
            {'RegionName': 'us-east-1'}
        ]
    }]

    s3.list_objects.return_value = [
        's3://aws-cloudtrail-test-logs-123456789/AWSLogs/123456789012/CloudTrail/us-east-1/2022/12/01/423424_CloudTrail_us-east-1_20221201000001Zwe.json.gz',
        's3://aws-cloudtrail-test-logs-123456789/AWSLogs/123456789012/CloudTrail/us-east-1/2022/12/01/423424_CloudTrail_us-east-1_20221201011101Qqq.json.gz',
        's3://aws-cloudtrail-test-logs-123456789/AWSLogs/123456789012/CloudTrail/us-east-1/2022/12/01/423424_CloudTrail_us-east-1_20221202011101Qqq.json.gz',
        's3://aws-cloudtrail-test-logs-123456789/AWSLogs/123456789012/CloudTrail/us-east-1/2022/12/01/423424_CloudTrail_us-east-1_20221203011101Qqq.json.gz',
        's3://aws-cloudtrail-test-logs-123456789/AWSLogs/123456789012/CloudTrail/us-east-1/2022/12/01/423424_CloudTrail_us-east-1_20221204011101Qqq.json.gz',
        's3://aws-cloudtrail-test-logs-123456789/AWSLogs/123456789012/CloudTrail/us-east-1/2022/12/01/423424_CloudTrail_us-east-1_20221205011101Qqq.json.gz'
    ]

    s3.read_json.return_value = pd.DataFrame(DATA_FRAME_ALL)

    table_details = SamplingTestHelpers.pull_data_sample(
        'CLOUDTRAIL', source_details)['tableDetails']

    assert len(table_details) == 1
    assert s3.to_parquet.called

@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_cloudtrail_single_event(boto_client, s3):
    source_details = {
        "cloudTrailTrailArn": "arn:aws:cloudtrail:ap-southeast-2:123456789012:trail/test-trail",
        "cloudTrailEventTypes": "Insight",
        "cloudTrailDateFrom": "2022-12-01T00:00:00.000Z",
        "cloudTrailDateTo": "2022-12-02T00:00:00.000Z",
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
        'Trail': {
            'Name': 'a-tester-trail',
            'S3BucketName': 'aws-cloudtrail-test-logs-123456789',
            'IncludeGlobalServiceEvents': True,
            'IsMultiRegionTrail': True,
            'HomeRegion': 'ap-southeast-2',
            'TrailARN': 'arn:aws:cloudtrail:ap-southeast-2:123456789012:trail/tester-trail',
            'LogFileValidationEnabled': True,
            'KmsKeyId': 'arn:aws:kms:ap-southeast-2:123456789012:key/da677d31-0d1a-4cfb-a175-a72be50a9210',
            'HasCustomEventSelectors': True,
            'HasInsightSelectors': True,
            'IsOrganizationTrail': False
        },
        'ResponseMetadata': {
            'RequestId': '54a58ea6-9abe-4e62-9ff7-eca71bb77ed0',
            'HTTPStatusCode': 200,
            'HTTPHeaders': {
                'x-amzn-requestid': '52b59ea7-9abe-4e62-9ff7-eca71ee66ed0',
                'content-type': 'application/x-amz-json-1.1',
                'content-length': '477',
                'date': 'Mon, 05 Dec 2022 08:00:00 GMT'
            },
            'RetryAttempts': 0
        }
    },
    {
        'Regions': [
            {'RegionName': 'ap-southeast-1'}
        ]
    }]

    s3.list_objects.return_value = [
        's3://aws-cloudtrail-test-logs-123456789/AWSLogs/123456789012/CloudTrail/us-east-1/2022/12/01/423424_CloudTrail_us-east-1_20221201000001Zwe.json.gz',
        's3://aws-cloudtrail-test-logs-123456789/AWSLogs/123456789012/CloudTrail/us-east-1/2022/12/01/423424_CloudTrail_us-east-1_20221201011101Qqq.json.gz',
    ]

    s3.read_json.return_value = pd.DataFrame(DATA_FRAME_ALL)

    table_details = SamplingTestHelpers.pull_data_sample(
        'CLOUDTRAIL', source_details)['tableDetails']

    print(table_details)
    assert len(table_details) == 1
    assert s3.to_parquet.called


@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_cloudtrail_arn_except(boto_client, s3):

    with pytest.raises((Exception)):
        source_details = {
        "cloudTrailTrailArn": "arn:aws:cloudtrail:ap-southeast-2:123456789012:trail/test-trail",
        "cloudTrailEventTypes": "Data & Management & Insight",
        "cloudTrailDateFrom": "2022-12-01T00:00:00.000Z",
        "cloudTrailDateTo": "2022-12-02T00:00:00.000Z",
        }
        boto_client.side_effect = [{
            "Plaintext": json.dumps(source_details).encode('utf-8')
        }, {
            "Credentials": {
                "AccessKeyId": "TestAccessKeyId",
                "SecretAccessKey": "TestSecretAccessKey",
                "SessionToken": "TestSessionToken",
            }
        }
        ]

        SamplingTestHelpers.pull_data_sample('CLOUDTRAIL', source_details)['tableDetails']
    
    assert not s3.to_parquet.called
