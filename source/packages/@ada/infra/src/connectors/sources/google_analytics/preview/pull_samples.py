###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import pandas as pd
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    MetricType,
    RunReportRequest,
)

from handlers.common import * # NOSONAR
from handlers.sampling import SamplingUtils

GS_AVG_ROW_SIZE = 1024

def pull_samples(input: IPullSamplesInput) -> IPullSamplesReturn: # NOSONAR (python:S3776) - false positive
    """
    Query data from Goolge Analytics 4
    https://googleapis.dev/python/analyticsdata/latest/data_v1beta/beta_analytics_data.html 
    request body:
    {
        'propertyId': '123456',
        'dateRanges': [{'startDate': '2021-01-01', 'endDate': '2021-12-01'}],
        'metrics': [],
        'dimensions': [],
        'limit': 10,
    }
    """
    print('Reading sample data from Google Analytics')

    source_details = input.source_details
    update_trigger = input.update_trigger

    cred = SamplingUtils.get_google_cloud_credentials(source_details)
    cred.with_scopes(["https://www.googleapis.com/auth/analytics.readonly"])

    ga_client = SamplingUtils.build_google_analytics_client(cred)

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

    source_dimenions = source_details.get("dimensions", {})
    if type(source_dimenions) is str:
        dimensions = [Dimension(name=dim) for dim in source_dimenions.split(",")]
    else:
        dimensions = map(lambda dim: Dimension(name=dim), source_dimenions)

    source_metrics = source_details.get("metrics", {})
    if type(source_metrics) is str:
        metrics = [Metric(name=metric) for metric in source_metrics.split(",")]
    else:
        metrics = map(lambda metric: Metric(name=metric), source_metrics) 

    try: 
        request = RunReportRequest(
                property=f"properties/{source_details.get('propertyId')}",
                dimensions=dimensions,
                metrics=metrics,
                date_ranges=[DateRange(start_date=since_formatted, end_date=until_formatted)],
                limit = input.sample_size,
        )
        print(request)

        response = ga_client.run_report(request)
        print("response:", response)

        print("Retrieved ga report for preview ...")
        # dimension headers are lower case all the time
        dimension_headers = [ dim.name.lower() for dim in response.dimension_headers ]
        print("Response Dimension Headers")
        print (dimension_headers)

        # metric headers are lower case all the time
        metric_headers = [ metric.name.lower() for metric in response.metric_headers]
        print("Response Metric headers")
        print(metric_headers)

        normalized_rows = []
        rows = response.rows
        for row in rows:
            row_data = dict()
            # retrieve dimensions
            for index, dimension_value in enumerate(row.dimension_values):
                row_data[dimension_headers[index]] = dimension_value.value
            # retrieve metrics
            for index, metric_value in enumerate(row.metric_values):
                row_data[metric_headers[index]] = metric_value.value
            # add common columns
            row_data['propertyid'] = source_details.get('propertyId')
            row_data['timestamp'] = until_formatted
            normalized_rows.append(row_data)

        if len(normalized_rows):
            dataframe = pd.DataFrame(normalized_rows)
            return [Sample(DEFAULT_DATASET_ID, dataframe, 'parquet')]
        else:
            raise NoSourceDataFoundException(
                "Unable to load preview: empty data")
    except:
        raise NoSourceDataFoundException(
            "Unable to load preview: bad responses from google analytics")