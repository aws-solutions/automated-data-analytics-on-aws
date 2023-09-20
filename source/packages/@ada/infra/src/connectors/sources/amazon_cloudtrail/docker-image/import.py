###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import os
import uuid
import boto3
import pytz
import pandas as pd
import awswrangler as wr
import psutil
from multiprocessing import Pool

from datetime import datetime, timedelta, date, time
from dateutil import parser

#  These are the Required Environment Variables input into the State
# Machine. Values are input into the CloudTrailImportDataStateMachine
# class as taskEnv object
CLOUDTRAIL_ARN = os.environ.get('CLOUDTRAIL_ARN')
CLOUDTRAIL_DATE_FROM = os.environ.get('CLOUDTRAIL_DATE_FROM')
CLOUDTRAIL_DATE_TO = os.environ.get('CLOUDTRAIL_DATE_TO')
CLOUDTRAIL_EVENT_TYPES = os.environ.get('CLOUDTRAIL_EVENT_TYPES')
S3_OUTPUT_BUCKET_URI = os.environ.get('S3_OUTPUT_BUCKET_URI')
TRIGGER_TYPE = os.environ.get("TRIGGER_TYPE")
SCHEDULE_RATE = os.environ.get("SCHEDULE_RATE")
TABLE_NAME = os.environ.get("TABLE_NAME")
DOMAIN_ID = os.environ.get("DOMAIN_ID")
DATA_PRODUCT_ID = os.environ.get("DATA_PRODUCT_ID")
CROSS_ACCOUNT_ROLE_ARN = os.environ.get("CROSS_ACCOUNT_ROLE_ARN") 

# Development flag for managing debug logging (set to 'False' for Mainline)
DEBUG_ON = False

# Add partition key and store files by partitions
ADD_PARTITION_COLUMNS = False

EVENT_CATEGORY_MANAGEMENT = 'Management'
EVENT_CATEGORY_DATA = 'Data'
EVENT_CATEGORY_INSIGHT = 'Insight'

# The list of elements that will be imported.
# NOTE if dynamic elements (e.g. requestParameters) are imported they may cause issues such as;
# 1. Exceeding the maximum amount of columns permitted in Glue tables
# 2. Similar named items may ensue (but in different case) does also impact the glue process. For
#    example, you may have one service deliver a request pararemeter spelt 'Arn' and another 'ARN' this causes problems.
#    If it is decided to allow permitting dynamic elements, it would be recommended to align the cases during import.
CLOUDTRAIL_ELEMENTS_OF_CONCERN = set([
    'eventVersion', 'eventTime', 'awsRegion', 'eventID', 'eventType', 'eventCategory',
    'userIdentity.type', 'userIdentity.arn', 'userIdentity.accountId', 'userIdentity.sessionIssuer.type',
    'userIdentity.sessionIssuer.arn', 'eventSource', 'eventName', 'awsRegion', 'sourceIPAddress', 'requestID',
    'userAgent', 'errorCode', 'errorMessage', 'apiVersion', 'managementEvent', 'readOnly', 'recipientAccountId',
    'sharedEventID', 'serviceEventDetails.eventTime', 'serviceEventDetails.eventSource',
    'serviceEventDetails.eventName', 'serviceEventDetails.eventType',
    'insightDetails.eventSource', 'insightDetails.eventName', 'insightDetails.insightType',
    'insightDetails.insightContext.statistics.baseline.average', 'insightDetails.insightContext.statistics.insight.average',
    'insightDetails.insightContext.statistics.insightDuration', 'insightDetails.insightContext.statistics.baselineDuration',
])

CLOUDTRAIL_DATA_AND_MANAGEMENT_WILDCARD_PATH = "s3://{}/CloudTrail/{}/{}/{}/{}"

CLOUDTRAIL_INSIGHT_WILDCARD_PATH = "s3://{}/CloudTrail-Insight/{}/{}/{}/{}"

pd.set_option('display.max_rows', 10)
pd.set_option('display.max_columns', 200)
pd.set_option('display.width', None)
pd.set_option('display.max_colwidth', None)

class DateRangeException(Exception):
    pass

class MissingParameterException(Exception):
    pass

class InvalidTrailException(Exception):
    pass

# Helper to only print output to logs when DEBUG flag is on
def print_debug(to_print: str):
    if DEBUG_ON:
        print('[DEBUG] {}'.format(to_print))

# Normalise the date to be 0 o'clock UTC for the given day
def normalize_date(date_value):
    return datetime(date_value.year, date_value.month, date_value.day).replace(tzinfo=pytz.UTC)

def process_memory():
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    return mem_info.rss

def process_logs(params) -> None:
    (s3_path, category_filter_out) = params
    
    processed_count = 0

    print("Reading from {}".format(s3_path))
    print_debug("RSS Memory: {}".format(process_memory()))
    try:
        df = wr.s3.read_json(
                    path=s3_path,
                    path_suffix=".json.gz",
                    boto3_session=global_active_boto3_session,
                    use_threads=True,
                    lines=True,
                    ignore_empty=True
            )

        print("{} records found in the path".format(len(df.loc[0].values)))

        result_n_df = pd.json_normalize(df.explode('Records')['Records'].values)
        print("{} rows read".format(result_n_df.shape[0]))

        result_df = result_n_df[list(CLOUDTRAIL_ELEMENTS_OF_CONCERN.intersection(set(result_n_df.columns.tolist())))]
        if category_filter_out != None:
            result_df = result_df[result_df['eventCategory'] != category_filter_out]

        if result_df.shape[0] > 0:
            # add the partition keys
            if ADD_PARTITION_COLUMNS:
                result_df['year'] = result_df['eventTime'].transform(lambda x: x[:4])
                result_df['month'] = result_df['eventTime'].transform(lambda x: x[5:7])
                result_df['day'] = result_df['eventTime'].transform(lambda x: x[8:10])

            print('writing: {} records to s3'.format(result_df.shape[0]))
            wr.s3.to_parquet(
                df=result_df,
                path=global_s3_output_uri,
                dataset=True,
                partition_cols= ['awsRegion', 'year', 'month', 'day'] if ADD_PARTITION_COLUMNS else None,
                boto3_session=global_local_boto3_session
            )

            processed_count = processed_count + result_df.shape[0]
            print('totally {} rows written to s3'.format(processed_count))

        df = None
        result_df = None
        result_n_df = None
        print("RSS Memory: {}".format(process_memory()))
    except Exception as e:
        print('[ERROR] {}'.format(e))

    return processed_count
    
class CloudTrailImport():

    def __init__(self,
                 cloudtrail_arn: str,
                 cloudtrail_event_types: str,
                 cloudtrail_date_from: str,
                 cloudtrail_date_to: str,
                 cross_account_role_arn: str,
                 s3_output_uri: str,
                 table_name: str,
                 data_product_id: str,
                 domain_id: str,
                 trigger_type: str) -> None:

        if cloudtrail_arn is None:
            raise MissingParameterException("CloudTrail ARN is missing!")
        if cloudtrail_event_types is None:
            raise MissingParameterException("CloudTrail Event Types have not been selected!")
        if s3_output_uri is None:
            raise MissingParameterException("S3 Bucket URI is missing!")
        if table_name is None:
            raise MissingParameterException("Last Updated Detail Table Name is missing!")
        if data_product_id is None:
            raise MissingParameterException("Data Product ID is missing!")
        if domain_id is None:
            raise MissingParameterException("Domain Id is missing!")
        if trigger_type is None:
            raise MissingParameterException("Trigger Type is missing!")

        try:
            self._cloudtrail_date_from = normalize_date(parser.parse(cloudtrail_date_from))
        except (TypeError, parser.ParserError) as _:
            raise DateRangeException("CloudTrail Date From must be provided!")

        try:
            self._cloudtrail_date_to = normalize_date(parser.parse(cloudtrail_date_to))
        except (TypeError, parser.ParserError) as _:
            self._cloudtrail_date_to = None

        self._local_boto3_session = boto3.session.Session()

        # Cross account setup if required
        if cross_account_role_arn != '' and cross_account_role_arn is not None:
            self._sts_client = self._local_boto3_session.client('sts')
            self._active_boto3_session = self._assume_pull_data_sample_role_session(cross_account_role_arn)
            self._cloudtrail_client = self._active_boto3_session.client('cloudtrail')
        else:
            self._sts_client = None
            self._active_boto3_session = self._local_boto3_session
            self._cloudtrail_client = self._local_boto3_session.client('cloudtrail')

        self._cloudtrail_arn = cloudtrail_arn
        self._cloudtrail_event_types = cloudtrail_event_types.split(' & ')
        self._s3_output_uri = s3_output_uri
        self._ddb_client = self._local_boto3_session.client('dynamodb')
        self._ec2_client = self._local_boto3_session.client('ec2')
        self._table_name = table_name
        self._data_product_id = data_product_id
        self._domain_id = domain_id
        self._trigger_type = trigger_type
        self._num_rows_returned = 0

    def _assume_pull_data_sample_role_session(self, role_arn: str):
        assumed_role = self._sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName="ada-cloudtrail-import",
            Tags=[
                {'Key': 'ada:service', 'Value': 'data-product'}
            ]
        )
        credentials = assumed_role['Credentials']
        return boto3.session.Session(
            aws_access_key_id=credentials['AccessKeyId'],
            aws_secret_access_key=credentials['SecretAccessKey'],
            aws_session_token=credentials['SessionToken'],
        )

    def execute(self):
        print('Executing a CloudTrail Data import!')
        print('self => {}'.format(self._cloudtrail_date_from))

        if self._trigger_type == "ON_DEMAND" and self._cloudtrail_date_to is not None: # if both from and to dates are set...
            if self._cloudtrail_date_from > self._cloudtrail_date_to:
                raise DateRangeException("Date from cannot be after date to!")

            print("Executing an ON_DEMAND import; {} => {}".format(self._cloudtrail_date_from, self._cloudtrail_date_to))

            # If on demand clean up any potential previous on demand data
            wr.s3.delete_objects(path=self._s3_output_uri, use_threads=True, boto3_session=self._local_boto3_session)
           
            self._import_data(self._cloudtrail_date_from, self._cloudtrail_date_to, self._cloudtrail_event_types)

        else: # ON_DEMAND (without a date to) and SCHEDULED
            last_updated_date = self._get_last_updated_date()
            # date_to will have the time as the 0 hours UTC for the current day, but only date is used
            # since the import can only be done by whole days, the current day will be excluded as the data
            # is not completed for the current day
            date_to = normalize_date(datetime.now(pytz.utc))
            if last_updated_date is None:
                self._import_data(self._cloudtrail_date_from, date_to, self._cloudtrail_event_types)
            else:
                try:
                    self._import_data(last_updated_date,
                                      date_to,
                                      self._cloudtrail_event_types)
                except (TypeError, parser.ParserError):
                    raise DateRangeException("Last Updated Timestamp error")

    def _import_data(self, date_from, date_to, event_types) -> None:
        # check if there is anything to import
        if (date_to <= date_from):
            print("Skip importing task as date_from is later or equal to date_to, nothing to import. Date From: {}, Date To: {}".format(date_from, date_to))
            return
        
        print('Importing CloudTrail Data: {} => {}. {}'.format(date_from, date_to, event_types))

        self._process_cloudtrail_logs(date_from, date_to)

        print('Updating last updated date to {}'.format(date_to))
        self._update_last_updated(date_to)

    def _process_cloudtrail_logs(self, date_from, date_to) -> None:
        trail_response = self._cloudtrail_client.get_trail(Name=self._cloudtrail_arn)

        if 'Trail' not in trail_response:
            print('No trail found, throwing NoResourceDataFoundException!')
            raise InvalidTrailException('Unable to ascertain configured trail!')

        print_debug('Cloudtrail.get_trail() response => {}'.format(trail_response))

        # Obtain trail base bucket path, check what kind of trail is (management, data, insights) and then
        # validate connector will have access to the appropriate S3 Bucket and locations required.
        trail_bucket = trail_response['Trail']['S3BucketName']
        cloudtrail_trail_arn_elements = self._cloudtrail_arn.split(':', 5)

        # Obtain base log location for the CloudTrail, of the form <Bucket>/<Optional_Prefix>/AWSLogs/<TrailARN>.
        # If no Trail.S3KeyPrefix exists in the get_trail() response then no 'Prefix' will be in the path.
        try:
            trail_prefix = trail_response['Trail']['S3KeyPrefix']
            trail_log_location_prefix = "{}/{}/AWSLogs/{}".format(trail_bucket, trail_prefix,
                                                                  cloudtrail_trail_arn_elements[4])
        except KeyError:
            # No optional prefix configured so path is of <Bucket>/AWSLogs/<TrailARN>
            trail_log_location_prefix = "{}/AWSLogs/{}".format(trail_bucket, cloudtrail_trail_arn_elements[4])

        print('CloudTrail log prefix => {}'.format(trail_log_location_prefix))

        # Ascertain what event types have been requested and process import accordingly
        event_filter_out = None

        if len(self._cloudtrail_event_types) == 1:  # Single event type selected
            if EVENT_CATEGORY_INSIGHT in self._cloudtrail_event_types:  # Only processing insight events
                self._num_rows_returned = self._num_rows_returned + \
                                          self._upload_and_process_logs(
                                                CLOUDTRAIL_INSIGHT_WILDCARD_PATH,
                                                trail_log_location_prefix,
                                                date_from,
                                                date_to,
                                                event_filter_out
                                          )

            else:  # Only processing either data or management events
                event_filter_out = EVENT_CATEGORY_MANAGEMENT
                if EVENT_CATEGORY_MANAGEMENT in self._cloudtrail_event_types:
                    event_filter_out = EVENT_CATEGORY_DATA

                self._num_rows_returned = self._num_rows_returned + \
                                          self._upload_and_process_logs(
                                              CLOUDTRAIL_DATA_AND_MANAGEMENT_WILDCARD_PATH,
                                              trail_log_location_prefix,
                                              date_from,
                                              date_to,
                                              event_filter_out
                                          )

        else:  # Multiple event types selected
            if EVENT_CATEGORY_INSIGHT not in self._cloudtrail_event_types:  # Processing Management and Data Events
                self._num_rows_returned = self._num_rows_returned + \
                                          self._upload_and_process_logs(
                                              CLOUDTRAIL_DATA_AND_MANAGEMENT_WILDCARD_PATH,
                                              trail_log_location_prefix,
                                              date_from,
                                              date_to,
                                              None
                                          )

            else:  # Processing a combination of Insight and Data/Management Events (reduced common elements)
                self._num_rows_returned = self._num_rows_returned + \
                                          self._upload_and_process_logs(
                                              CLOUDTRAIL_INSIGHT_WILDCARD_PATH,
                                              trail_log_location_prefix,
                                              date_from,
                                              date_to,
                                              None
                                          )
                event_not_selected = [x for x in
                                      [EVENT_CATEGORY_DATA, EVENT_CATEGORY_MANAGEMENT, EVENT_CATEGORY_INSIGHT] if
                                      x not in self._cloudtrail_event_types]
                if len(event_not_selected) == 1:
                    event_filter_out = event_not_selected[0]

                self._num_rows_returned = self._num_rows_returned + \
                                          self._upload_and_process_logs(
                                              CLOUDTRAIL_DATA_AND_MANAGEMENT_WILDCARD_PATH,
                                              trail_log_location_prefix,
                                              date_from,
                                              date_to,
                                              event_filter_out
                                          )
        print('Processed {} items!'.format(self._num_rows_returned))

    def _get_last_updated_date(self) -> str or None:
        print("Retrieving last updated timestamp")
        response = self._ddb_client.get_item(
            TableName=self._table_name,
            Key={
                'dataProductId': {'S': self._data_product_id},
                'domainId': {'S': self._domain_id},
            }
        )
        if 'Item' in response:
            print('Last updated time exists => {}'.format(response['Item']['timestamp']['S']))
            return normalize_date(parser.parse(response['Item']['timestamp']['S']))
        else:
            print('Last updated time has not been found!')
            return None

    def _update_last_updated(self, timestamp) -> None:
        print(f"Updating last update timestamp with: {timestamp}")
        self._ddb_client.put_item(
            TableName=self._table_name,
            Item={
                'dataProductId': {'S': self._data_product_id},
                'domainId': {'S': self._domain_id},
                'timestamp': {'S': timestamp.strftime('%Y-%m-%dT%H:%M:%S.%fZ')},
                'num_rows': {'S': str(self._num_rows_returned)},
            }
        )

    def _upload_and_process_logs(self, path, prefix, date_from, date_to, category_filter_out):
        print("upload and process {} => {}".format(date_from, date_to))

        date_from = normalize_date(date_from)
        date_to = normalize_date(date_to)
        aws_regions = self._get_aws_regions()
        items_processed = 0
        while (date_from < date_to):
            start_year = date_from.strftime('%Y')
            start_month = date_from.strftime('%m')
            start_day = date_from.strftime('%d')

            print('date_from: {}, date_to: {}'.format(date_from, date_to))

            new_s3_paths = [(path.format(prefix, region_name, start_year, start_month, start_day), category_filter_out) for region_name in aws_regions]
            with Pool(processes=10, maxtasksperchild=1) as pool:
                iterator = pool.imap_unordered(process_logs, new_s3_paths, chunksize=1)
                while True:
                    try:
                        count = next(iterator)
                        print("Complete task. Count: {}".format(count))
                        items_processed = items_processed + count 
                    except StopIteration:
                        print("All completed. Processes stopped")
                        break
                    except Exception as e:
                        print("Error occured in process. Error: {}".format(e))
            print('total item processed: {}'.format(items_processed))
            date_from = normalize_date(date_from + timedelta(days=1))

        return items_processed

    def _get_aws_regions(self):
        response = self._ec2_client.describe_regions()
        if ('Regions' in response):
            return list(map(lambda region: region['RegionName'], response['Regions']))
        else:
            return []
    
    def _assume_pull_data_sample_role_session(self, role_arn: str):
        assumed_role = self._sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName="ada-cloudwatch-import",
            Tags=[
                {'Key': 'ada:service', 'Value': 'data-product'}
            ]
        )
        credentials = assumed_role['Credentials']
        return boto3.session.Session(
            aws_access_key_id=credentials['AccessKeyId'],
            aws_secret_access_key=credentials['SecretAccessKey'],
            aws_session_token=credentials['SessionToken'],
        )
 
cti = CloudTrailImport(
    CLOUDTRAIL_ARN,
    CLOUDTRAIL_EVENT_TYPES,
    CLOUDTRAIL_DATE_FROM,
    CLOUDTRAIL_DATE_TO,
    CROSS_ACCOUNT_ROLE_ARN,
    S3_OUTPUT_BUCKET_URI,
    TABLE_NAME,
    DATA_PRODUCT_ID,
    DOMAIN_ID,
    TRIGGER_TYPE)

global_active_boto3_session = cti._active_boto3_session
global_local_boto3_session = cti._local_boto3_session
global_s3_output_uri = cti._s3_output_uri

print("Executing CloudTrailImport...")
cti.execute()