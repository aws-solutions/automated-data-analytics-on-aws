###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import pytest
import json
from unittest.mock import patch
from datetime import datetime
from dateutil.relativedelta import relativedelta

from handlers.common import * # NOSONAR
from handlers.sampling import * # NOSONAR
from handlers.__tests__.sampling_helpers import SamplingTestHelpers

@pytest.mark.parametrize("source_type", ["GOOGLE_ANALYTICS"])
@patch("handlers.sampling.common.SamplingUtils.build_google_api_client")
@patch("handlers.sampling.common.SamplingUtils.get_google_cloud_credentials")
@patch("botocore.client.BaseClient._make_api_call")
def test_google_analytics_pull_samples(boto_client, mock_ga_cred, mock_build, source_type):
    source_details = {
            "viewId": "12345678",
            "since": "2020-12-31T13:00:00.000Z",
            "until": "2021-11-16T13:00:00.000Z",
            "dimensions": "ga:userType,ga:country",
            "metrics": "ga:users",
            "projectId": "lt-demo-330100",
            "clientId": "114452300742793677110",
            "clientEmail": "sample@test.iam.gserviceaccount.example.com",
            "privateKeyId": "abcdefg",
            "privateKey": "-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----\n",
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
        "Contents": [{"Key": "some_file"}]
    }]

    mock_build.return_value.reports.return_value.batchGet.return_value.execute.return_value = {
        "reports": [
            {
                "columnHeader": {
                    "dimensions": [
                        "ga:userType"
                    ],
                    "metricHeader": {
                        "metricHeaderEntries": [
                            {
                                "name": "ga:sessions",
                                "type": "INTEGER"
                            }
                        ]
                    }
                },
                "data": {
                    "rows": [
                        {
                            "dimensions": [
                                "New Visitor"
                            ],
                            "metrics": [
                                {
                                    "values": [
                                        "12872"
                                    ]
                                }
                            ]
                        }
                    ],
                    "totals": [
                        {
                            "values": [
                                "12872"
                            ]
                        }
                    ],
                    "rowCount": 1,
                    "minimums": [
                        {
                            "values": [
                                "12872"
                            ]
                        }
                    ],
                    "maximums": [
                        {
                            "values": [
                                "12872"
                            ]
                        }
                    ],
                    "isDataGolden": True
                }
            }
        ]
    }

    table_details = SamplingTestHelpers.pull_data_sample(source_type, source_details)['tableDetails']
    assert len(table_details) == 1
    assert table_details[0]['tableName'] == DEFAULT_DATASET_ID
    assert table_details[0]['classification'] == 'parquet'
    assert table_details[0]['sampleDataS3Path'].startswith('s3://test-temp-bucket/test-domain/test-data-product/')


@pytest.mark.parametrize("source_type", ["GOOGLE_ANALYTICS"])
@patch("handlers.sampling.common.SamplingUtils.build_google_api_client")
@patch("handlers.sampling.common.SamplingUtils.get_google_cloud_credentials")
@patch("botocore.client.BaseClient._make_api_call")
def test_google_analytics_pull_samples_schedule(boto_client, mock_ga_cred, mock_build, source_type):
    source_details = {
            "viewId": "12345678",
            "since": "",
            "until": "",
            "dimensions": "ga:userType,ga:country",
            "metrics": "ga:users",
            "projectId": "lt-demo-330100",
            "clientId": "114452300742793677110",
            "clientEmail": "sample@test.iam.gserviceaccount.example.com",
            "privateKeyId": "abcdefg",
            "privateKey": "-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----\n",
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
        "Contents": [{"Key": "some_file"}]
    }]

    mock_build.return_value.reports.return_value.batchGet.return_value.execute.return_value = {
        "reports": [
            {
                "columnHeader": {
                    "dimensions": [
                        "ga:userType"
                    ],
                    "metricHeader": {
                        "metricHeaderEntries": [
                            {
                                "name": "ga:sessions",
                                "type": "INTEGER"
                            }
                        ]
                    }
                },
                "data": {
                    "rows": [
                        {
                            "dimensions": [
                                "New Visitor"
                            ],
                            "metrics": [
                                {
                                    "values": [
                                        "12872"
                                    ]
                                }
                            ]
                        }
                    ],
                    "totals": [
                        {
                            "values": [
                                "12872"
                            ]
                        }
                    ],
                    "rowCount": 1,
                    "minimums": [
                        {
                            "values": [
                                "12872"
                            ]
                        }
                    ],
                    "maximums": [
                        {
                            "values": [
                                "12872"
                            ]
                        }
                    ],
                    "isDataGolden": True
                }
            }
        ]
    }

    table_details = SamplingTestHelpers.pull_scheduled_data_sample(source_type, source_details)['tableDetails']
    assert len(table_details) == 1
    assert table_details[0]['tableName'] == DEFAULT_DATASET_ID
    assert table_details[0]['classification'] == 'parquet'
    assert table_details[0]['sampleDataS3Path'].startswith('s3://test-temp-bucket/test-domain/test-data-product/')

def test_google_analytics_valid_od_date_range():
    since = "2020-12-31"
    until = "2021-11-16"
    trigger_type = "ON_DEMAND"
    dateRange = SamplingUtils.get_date_range(since=since, until=until, trigger_type=trigger_type)
    today = datetime.utcnow().date()
    start = dateRange[0]
    end = dateRange[1]
    assert start == datetime(2020,12,31).date()
    assert end == datetime(2021,11,16).date()


def test_google_analytics_invalid_od_date_range():
    since = "2021-11-16"
    until = "2020-12-31"
    trigger_type = "ON_DEMAND"
    try:
        SamplingUtils.get_date_range(since=since, until=until, trigger_type=trigger_type)
    except DateRangeException as e:
        assert True

def test_google_analytics_daily_schedule_date_range():
    since = ""
    until = ""
    trigger_type = "SCHEDULE"
    schedule_rate = "rate(1 day)"
    dateRange = SamplingUtils.get_date_range(since=since, until=until, trigger_type=trigger_type, schedule_rate=schedule_rate)
    today = datetime.utcnow().date()
    start = dateRange[0]
    end = dateRange[1]
    assert start == today - relativedelta(days=1)
    assert end == today

def test_google_analytics_weekly_schedule_date_range():
    since = ""
    until = ""
    trigger_type = "SCHEDULE"
    schedule_rate = "rate(1 week)"
    dateRange = SamplingUtils.get_date_range(since=since, until=until, trigger_type=trigger_type, schedule_rate=schedule_rate)
    today = datetime.utcnow().date()
    start = dateRange[0]
    end = dateRange[1]
    assert start == today - relativedelta(weeks=1)
    assert end == today

def test_google_analytics_monthly_schedule_date_range():
    since = ""
    until = ""
    trigger_type = "SCHEDULE"
    schedule_rate = "rate(1 month)"
    dateRange = SamplingUtils.get_date_range(since=since, until=until, trigger_type=trigger_type, schedule_rate=schedule_rate)
    today = datetime.utcnow().date()
    start = dateRange[0]
    end = dateRange[1]
    assert start == today - relativedelta(months=1)
    assert end == today
