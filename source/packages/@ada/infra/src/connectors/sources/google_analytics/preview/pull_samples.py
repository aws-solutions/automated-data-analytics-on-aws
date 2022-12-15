###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import pandas as pd

from handlers.common import * # NOSONAR
from handlers.sampling import SamplingUtils

GS_AVG_ROW_SIZE = 1024

def pull_samples(input: IPullSamplesInput) -> IPullSamplesReturn: # NOSONAR (python:S3776) - false positive
    """
    Query data from Goolge Analytics
    https://developers.google.com/analytics/devguides/reporting/core/v4/rest/v4/reports/batchGet
    request body:
    {
        'viewId': '123456',
        'dateRanges': [{'startDate': '2021-01-01', 'endDate': '2021-12-01'}],
        'samplingLevel': 'Default|LARGE',
        'metrics': [],
        'dimensions': [],
        'pageSize': 10,
    }
    """
    print('Reading sample data from Google Analytics')

    source_details = input.source_details
    update_trigger = input.update_trigger

    cred = SamplingUtils.get_google_cloud_credentials(source_details)
    cred.with_scopes(["https://www.googleapis.com/auth/analytics.readonly"])
    analytics = SamplingUtils.build_google_api_client("analyticsreporting", "v4", credentials=cred, cache_discovery=False)

    trigger_type = update_trigger.get("triggerType", "ON_DEMAND")
    schedule_rate = update_trigger.get("scheduleRate", "")

    date_range = SamplingUtils.get_date_range(
      since=source_details.get("since"),
      until=source_details.get("until"),
      trigger_type=trigger_type,
      schedule_rate=schedule_rate
    )

    print("Preview ga data with date ranges: ", date_range)

    since_formatted = date_range[0].strftime('%Y-%m-%d')

    until_formatted = date_range[1].strftime('%Y-%m-%d')

    """
    # input:
    # "ga:sessions, ga:users"
    # output:
    # [{"name": "ga:sessions"}, {"name": "ga:users"}]
    """
    source_dimenions = source_details.get("dimensions", {})
    if type(source_dimenions) is str:
        dimensions = []
        for dimension in source_dimenions.split(","):
            dimensions.append({"name": dimension})
    else:
        dimensions = source_dimenions

    """
    # input
    # "ga:country, ga:userType"
    # output
    # [{"expression": "ga:country"}, {"expression": "ga:userType"}]
    """
    source_metrics = source_details.get("metrics", {})

    if type(source_metrics) is str:
        metrics = []
        for metric in source_metrics.split(","):
            metrics.append({"expression": metric})
    else:
        metrics = source_metrics

    print("Calling anlytics - should be mocked", analytics)
    print("#reports()", analytics.reports())
    body = {
        'reportRequests': [
            {
                'viewId': source_details.get("viewId"),
                'dateRanges': [{'startDate': since_formatted, 'endDate': until_formatted}],
                'metrics': metrics,
                'dimensions': dimensions,
                'pageSize': input.sample_size
            }]
    }
    print("body=", body)
    response = analytics.reports().batchGet(body=body).execute()
    print("response:", response)

    print("Retrieved ga report for preview ...")

    if response.get('reports'):
        report = response['reports'][0]
        rows = report.get('data', {}).get('rows', [])

        column_header = report.get('columnHeader', {})
        dimension_headers = [
            {'name': header.replace('ga:', ''), 'type': VARCHAR_255}
            for header
            in column_header.get('dimensions', [])
        ]
        metric_map = {
            'METRIC_TYPE_UNSPECIFIED': VARCHAR_255,
            'CURRENCY': DECIMAL_20_5,
            'INTEGER': 'int(11)',
            'FLOAT': DECIMAL_20_5,
            'PERCENT': DECIMAL_20_5,
            'TIME': 'time'
        }
        metric_headers = [
            {'name': entry.get('name').replace('ga:', ''),
                'type': metric_map.get(entry.get('type'), VARCHAR_255)}
            for entry
            in column_header.get('metricHeader', {}).get('metricHeaderEntries', [])
        ]

        normalize_rows = []

        for row_counter, row in enumerate(rows):
            root_data_obj = {}
            dimensions = row.get('dimensions', [])
            metrics = row.get('metrics', [])

            for index, dimension in enumerate(dimensions):
                header = dimension_headers[index].get('name').lower()
                root_data_obj[header] = dimension

            for metric in metrics:
                data = {}
                data.update(root_data_obj)
                for index, value in enumerate(metric.get('values', [])):
                    header = metric_headers[index].get('name').lower()
                    data[header] = value
                data['viewid'] = source_details["viewId"]
                data['timestamp'] = until_formatted
                normalize_rows.append(data)
        print("normalized length: ", len(normalize_rows))
        if len(normalize_rows):
            dataframe = pd.DataFrame(normalize_rows)
            return [Sample(DEFAULT_DATASET_ID, dataframe, 'parquet')]
        else:
            raise NoSourceDataFoundException(
                "Unable to load preview: empty data")
    else:
        raise NoSourceDataFoundException(
            "Unable to load preview: bad responses from google analytics")
