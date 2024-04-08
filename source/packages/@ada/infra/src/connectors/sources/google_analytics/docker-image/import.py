###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import json
import os
from datetime import datetime
from dateutil import parser
from dateutil.relativedelta import relativedelta
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    MetricType,
    RunReportRequest,
)
import pandas as pd
import smart_open
import tempfile
import uuid
import re

MB = 1024 ** 2
GB = 1024 ** 3
TB = 1024 ** 4

VARCHAR_255 = 'varchar(255)'
DECIMAL_20_5 = 'decimal(20,5)'

PROPERTY_ID = os.environ.get('PROPERTY_ID')
SINCE = os.environ.get('SINCE')
UNTIL = os.environ.get("UNTIL")
DIMENSIONS = os.environ.get('DIMENSIONS')
METRICS = os.environ.get('METRICS')
PAGE_SIZE = os.environ.get('PAGE_SIZE')
INCLUDE_EMPTY_ROWS = os.environ.get('INCLUDE_EMPTY_ROWS')
S3_OUTPUT_BUCKET_URI = os.environ.get('S3_OUTPUT_BUCKET_URI')
MAX_REQUEST_SIZE = 250000
DEFAULT_REQUEST_SIZE = 10000
TRIGGER_TYPE = os.environ.get("TRIGGER_TYPE")
SCHEDULE_RATE = os.environ.get("SCHEDULE_RATE")

if PROPERTY_ID is None:
    raise Exception("ga::missing property id")

if DIMENSIONS is None:
    raise Exception("ga::missing dimensions")

if METRICS is None:
    raise Exception("ga::missing metrics")

if S3_OUTPUT_BUCKET_URI is None:
    raise Exception("ga::missing s3 output bucket")

# remove the last slash from the path
if S3_OUTPUT_BUCKET_URI[-1:] == '/':
    S3_OUTPUT_BUCKET_URI = S3_OUTPUT_BUCKET_URI[:-1]

class DateRangeException(Exception):
    pass
class InvalidScheduleRateException(Exception):
    pass
class UnsupportedDataFormatException(Exception):
    pass
class GoogleAnalyticsImport():
    """
    required parameters:
    :param property_id:                 The property id.
    :type property_id:                  string
    
    :param dimensions:                  comma separated GA dimensions, e.g. year,month,day
    :type dimensions:                   string

    :param metrics                      comma separated GA dimensions, e.g. engagedSessions,totalUsers
    :type metrics:                      string

    :param since:                       The date up from which to pull GA data.
                                        This can either be a string in the format
                                        of '%Y-%m-%d %H:%M:%S' or ISO format '%Y-%m-%dT%H:%M:%SZ'
                                        but in either case it will be
                                        passed to GA as '%Y-%m-%d'.
    :type since:                        string

    :param until:                       The date up to which to pull GA data.
                                        This can either be a string in the format
                                        of '%Y-%m-%d %H:%M:%S' or or ISO format '%Y-%m-%dT%H:%M:%SZ'
                                        but in either case it will be
                                        passed to GA as '%Y-%m-%d'.
    :type until:                        string
    """

    def __init__(self,
                 property_id,
                 since,
                 until,
                 dimensions,
                 metrics,
                 page_size=DEFAULT_REQUEST_SIZE,
                 include_empty_rows=True):
        self.property_id = property_id
        self.since = since
        self.until = until
        self.dimensions = self.get_dimensions(dimensions)
        self.metrics = self.get_metrics(metrics)
        self.page_size = min(int(page_size or DEFAULT_REQUEST_SIZE), MAX_REQUEST_SIZE)
        self.include_empty_rows = include_empty_rows

    def execute(self):
        # get formattted data range
        date_range = self.get_data_range()
        if date_range is None:
            return
        try:
            since_formatted = date_range[0].strftime('%Y-%m-%d')
        except Exception as _:
            since_formatted = str(self.since)
        
        try:
            until_formatted = date_range[1].strftime('%Y-%m-%d')
        except Exception as _:
            until_formatted = str(self.until)
        print("Start date: ", since_formatted,
              ", End date: ", until_formatted)
        
        ga_client = BetaAnalyticsDataClient()

        # pagination offset
        offset = 0

        # first the initial request
        response = ga_client.run_report(self.get_request(since_formatted, until_formatted, offset))

        # dimension headers are lower case all the time
        dimension_headers = [ dim.name.lower() for dim in response.dimension_headers ]
        print("Response Dimension Headers")
        print (dimension_headers)

        # metric headers are lower case all the time
        metric_headers = [ metric.name.lower() for metric in response.metric_headers]
        print("Response Metric headers")
        print(metric_headers)

        total_row_count = response.row_count
        if total_row_count <= 0:
            raise Exception("Nothing to import, throw exception to avoid crawler")

        # getting all rows
        normalized_rows = []
        # processing current page
        while (offset < total_row_count):
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
                row_data['propertyid'] = self.property_id
                row_data['timestamp'] = until_formatted
                normalized_rows.append(row_data)

            print(offset, len(rows))
            # getting next page
            offset += len(rows)
            if offset < total_row_count:
                response = ga_client.run_report(self.get_requset(since_formatted, until_formatted, offset))

        # there are data to process, so open output file
        filename = str(uuid.uuid4())
        with (tempfile.NamedTemporaryFile()) as tmp:
            if (tmp is not None):
                part_size = 1 * GB

            with smart_open.open(
                f'{S3_OUTPUT_BUCKET_URI}/{filename}.parquet',
                'wb',
                # min_part_size can be increased if there's enough memory in the container, max size is 1GB per part
                # the buffer is kept in memory till it raches the size and then written into S3 (generating a new 'part')
                # a small part size might end up generating too many parts and thus reach the 10k parts limits (if the content is on the order of TB)
                # more info: https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html
                #
                # alternatively the data can be stored in the local filesystem by using writebuffer prop but this requires a volume in the ECS container
                # by default the container comes with a 30GB disk: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-ami-storage-config.html
                # read/write io ops are slower than memory lookups
                # https://github.com/RaRe-Technologies/smart_open/blob/develop/howto.md#how-to-write-to-s3-efficiently
                transport_params={
                    'min_part_size': part_size, 'writebuffer': tmp}
            ) as fout:
                # write all rows to file
                df = pd.DataFrame(normalized_rows)
                df.to_parquet(fout, engine='pyarrow', index=False)
                print("Import completed. ", len(normalized_rows), " row(s) imported")
            

    """
    Get Date Range
    ondemand/once-off:
        use date range parsed from client side if
    scheduled:
        calculate the date range based on utc time now
        e.g. if weekly, start = 1 week ago, end = utc now
    """
    def get_data_range(self):
        try:
            since_date = parser.parse(self.since).date()
        except Exception as _:
            print("Failed to parse start date: ", self.since)
            since_date = None
        
        try:
            until_date = parser.parse(self.until).date()
        except Exception as _:
            print("Failed to parse end date: ", self.until)
            until_date = None

        today = datetime.utcnow().date()

        # handles the delay start and expired schedule, need to
        # be moved to pipeline
        if TRIGGER_TYPE == "SCHEDULE":
            if SCHEDULE_RATE is None or SCHEDULE_RATE == "":
                raise InvalidScheduleRateException("Invalid schedule frequency: ", SCHEDULE_RATE)
            if until_date and today > until_date:
                raise DateRangeException("Expired schedule")
            elif since_date and since_date > today:
                raise DateRangeException("Import has not started yet")
            else:
                pattern = 'rate\((\d+)\s(days?|weeks?|months?)\)'
                matched = re.findall(
                    pattern, SCHEDULE_RATE, flags=re.IGNORECASE)
                if len(matched) == 1:
                    freq = int(matched[0][0])
                    freq_unit = str(matched[0][1])
                    freq_unit = freq_unit + \
                        ("" if freq_unit.endswith("s") else "s")
                    delta = relativedelta()
                    setattr(delta, freq_unit, freq)
                    last_n = today - delta
                    print("freq: ", freq_unit, ", delta: ", delta)
                    print(last_n, today)
                    return last_n, today
                else:
                    raise InvalidScheduleRateException("Not supported schedule rate")
        else:
            # treat everything else as once off
            print("On demand impmorting")
            if since_date > until_date:
                raise DateRangeException("Start date cannot be greater than end date")
            elif since_date is None or until_date is None:
                raise UnsupportedDataFormatException("Not supported date format")
            return since_date, until_date

    # handle string inputs for metrics and dimensions
    def get_dimensions(self, dimensions):
        if type(dimensions) is str:
            return [Dimension(name=dim) for dim in dimensions.split(",")]
        return dimensions

    def get_metrics(self, metrics):
        if type(metrics) is str:
              return [Metric(name=metric) for metric in metrics.split(",")]
        return metrics

    def get_request(self, since_formatted, until_formatted, offset):
        return RunReportRequest(
            property=f"properties/{self.property_id}",
            dimensions=self.dimensions,
            metrics=self.metrics,
            date_ranges=[DateRange(start_date=since_formatted, end_date=until_formatted)],
            keep_empty_rows = self.include_empty_rows,
            limit = self.page_size,
            offset = offset
        )

con = GoogleAnalyticsImport(
    PROPERTY_ID, SINCE, UNTIL,  DIMENSIONS, METRICS, PAGE_SIZE, False)
con.execute()
