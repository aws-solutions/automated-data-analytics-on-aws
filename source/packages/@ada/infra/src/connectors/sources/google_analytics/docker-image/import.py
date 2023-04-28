###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import json
import os
from datetime import datetime
from dateutil import parser
from dateutil.relativedelta import relativedelta
from google_analytics import GoogleAnalytics
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

VIEW_ID = os.environ.get('VIEW_ID')
SINCE = os.environ.get('SINCE')
UNTIL = os.environ.get("UNTIL")
DIMENSIONS = os.environ.get('DIMENSIONS')
METRICS = os.environ.get('METRICS')
PAGE_SIZE = os.environ.get('PAGE_SIZE')
SAMPLING_LEVEL = os.environ.get('SAMPLING_LEVEL')
INCLUDE_EMPTY_ROWS = os.environ.get('INCLUDE_EMPTY_ROWS')
S3_OUTPUT_BUCKET_URI = os.environ.get('S3_OUTPUT_BUCKET_URI')
MAX_REQUEST_SIZE = 100000
TRIGGER_TYPE = os.environ.get("TRIGGER_TYPE")
SCHEDULE_RATE = os.environ.get("SCHEDULE_RATE")

if VIEW_ID is None:
    raise Exception("ga::missing view id")

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
    :param view_id:                     The view id for associated report.
    :type view_id:                      string/array
    :param dimensions:                  comma separated GA dimensions, e.g. ga:year,ga:month,ga:day
                                        or array, e.g. [{name:"ga:year"},{name:"ga:month"}]
    :type dimensions:                   string/array
    :param metrics                      comma separated GA dimensions, e.g. ga:users,ga:visitors
                                        or array e.g. [{expression:"ga:users"},{expression:"ga:visitors"}]
    :type metrics:                      string/array
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
                 view_id,
                 since,
                 until,
                 dimensions,
                 metrics,
                 page_size=10000,
                 include_empty_rows=True,
                 sampling_level=None):
        self.view_id = view_id
        self.since = since
        self.until = until
        self.sampling_level = sampling_level or 'LARGE'
        self.dimensions = self.get_dimensions(dimensions)
        self.metrics = self.get_metrics(metrics)
        self.page_size = page_size or 10000
        self.include_empty_rows = include_empty_rows
        self.metric_map = {
            'METRIC_TYPE_UNSPECIFIED': VARCHAR_255,
            'CURRENCY': DECIMAL_20_5,
            'INTEGER': 'int(11)',
            'FLOAT': DECIMAL_20_5,
            'PERCENT': DECIMAL_20_5,
            'TIME': 'time'
        }

        if self.page_size > MAX_REQUEST_SIZE:
            self.page_size = MAX_REQUEST_SIZE

    def execute(self):
        date_range = self.get_data_range()

        if date_range is None:
            return
        
        ga_conn = GoogleAnalytics()

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
        
        report = ga_conn.get_analytics_report(self.view_id,
                                              since_formatted,
                                              until_formatted,
                                              self.sampling_level,
                                              self.dimensions,
                                              self.metrics,
                                              self.page_size,
                                              self.include_empty_rows)

        column_header = report.get('columnHeader', {})
        # Right now all dimensions are hardcoded to varchar(255), will need a map if any non-varchar dimensions are used in the future
        # Unfortunately the API does not send back types for Dimensions like it does for Metrics (yet..)
        dimension_headers = [
            {'name': header.replace('ga:', ''), 'type': VARCHAR_255}
            for header
            in column_header.get('dimensions', [])
        ]
        metric_headers = [
            {'name': entry.get('name').replace('ga:', ''),
             'type': self.metric_map.get(entry.get('type'), VARCHAR_255)}
            for entry
            in column_header.get('metricHeader', {}).get('metricHeaderEntries', [])
        ]
        report_data = report.get('data', {});
        # might use this for antisampling
        has_sampling = report_data.get('samplesReadCounts', None)
        print('Has data been sampled by google: ', has_sampling != None)

        total_row_count = report_data.get('rowCount', 0)
        
        if total_row_count <= 0:
            raise Exception("Nothing to import, throw exception to avoid crawler")

        rows = report_data.get('rows', [])
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
                #dataframe.to_parquet(fout, engine='pyarrow', index=True)
                normalize_rows = []

                for row_counter, row in enumerate(rows):
                    root_data_obj = {}
                    dimensions = row.get('dimensions', [])
                    metrics = row.get('metrics', [])

                    for index, dimension in enumerate(dimensions):
                        header = dimension_headers[index].get(
                            'name').lower()
                        root_data_obj[header] = dimension

                    for metric in metrics:
                        data = {}
                        data.update(root_data_obj)

                        for index, value in enumerate(metric.get('values', [])):
                            header = metric_headers[index].get(
                                'name').lower()
                            data[header] = value
                        data['viewid'] = self.view_id
                        data['timestamp'] = until_formatted
                        normalize_rows.append(data)
                df = pd.DataFrame(normalize_rows)
                df.to_parquet(fout, engine='pyarrow', index=False)
        print("Import completed. ", total_row_count, " row(s) imported")
            

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
            results = []
            for dimension in dimensions.split(","):
                results.append({"name": dimension})
            return results
        return dimensions

    def get_metrics(self, metrics):
        if type(metrics) is str:
            results = []
            for metric in metrics.split(","):
                results.append({"expression": metric})
            return results
        return metrics


con = GoogleAnalyticsImport(
    VIEW_ID, SINCE, UNTIL,  DIMENSIONS, METRICS, PAGE_SIZE, False, SAMPLING_LEVEL)
con.execute()
