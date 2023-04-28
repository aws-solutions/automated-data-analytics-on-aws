###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import awswrangler as wr
import boto3
import boto3.session
import pandas as pd
import pytz
import random

from dateutil import parser
from datetime import datetime, date, time, timedelta
from handlers.common import * # NOSONAR
from handlers.sampling.common import SamplingUtils # NOSONAR

# Development flag for managing debug logging (set to 'False' for Mainline)
DEBUG_ON = False

EVENT_CATEGORY_MANAGEMENT = 'Management'
EVENT_CATEGORY_DATA = 'Data'
EVENT_CATEGORY_INSIGHT = 'Insight'

CLOUDTRAIL_COMMON_ELEMENTS = [
    'eventVersion', 'eventTime', 'awsRegion', 'eventID', 'eventType', 'eventCategory'
]

CLOUDTRAIL_DATA_AND_MANAGEMENT_MANDATORY_ELEMENTS = CLOUDTRAIL_COMMON_ELEMENTS + [
    'userIdentity.type', 'eventSource', 'eventName', 'awsRegion', 'sourceIPAddress', 'requestID',
]

CLOUDTRAIL_INSIGHTS_MANDATORY_ELEMENTS = CLOUDTRAIL_COMMON_ELEMENTS + [
    'insightDetails.eventSource',
    'insightDetails.eventName',
    'insightDetails.insightType',
    'insightDetails.insightContext.statistics.baseline.average',
    'insightDetails.insightContext.statistics.insight.average',
    'insightDetails.insightContext.statistics.insightDuration',
    'insightDetails.insightContext.statistics.baselineDuration',
]

CLOUDTRAIL_DATA_AND_MANAGEMENT_WILDCARD_PATH = "s3://{}/CloudTrail/{}/{}/{}/{}"

CLOUDTRAIL_INSIGHT_WILDCARD_PATH = "s3://{}/CloudTrail-Insight/{}/{}/{}/{}"

def print_debug(to_print: str):
        if DEBUG_ON:
            print('[DEBUG] {}'.format(to_print))

def get_aws_regions(boto3_session):
    ec2_client = boto3_session.client('ec2')
    response = ec2_client.describe_regions()
    if ('Regions' in response):
        return list(map(lambda region: region['RegionName'], response['Regions']))
    else:
        return []

def normalize_date(date_value):
    return datetime(date_value.year, date_value.month, date_value.day).replace(tzinfo=pytz.UTC)

def assume_pull_data_sample_role_session(sts_client, role_arn: str):
    assumed_role = sts_client.assume_role(
        RoleArn=role_arn,
        RoleSessionName="ada-cloudtrail-schema-preview",
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


def get_sample_data(boto3_session, path, prefix, date_from, date_to, category_filter_out, elements_in_play):
    print('path {}'.format(path))
    print('dates {} {}'.format(date_from, date_to))
    aws_regions = get_aws_regions(boto3_session)

    print(aws_regions)

    total_num_samples = 10
    sample_df = pd.DataFrame()
    sample_date = date_from
    available_regions = aws_regions.copy()

    while sample_df.shape[0] < total_num_samples and sample_date < date_to:
        # choose a random region
        sample_region = random.choice(available_regions)
        available_regions.remove(sample_region)

        sample_year = sample_date.strftime('%Y')
        sample_month = sample_date.strftime('%m')
        sample_day = sample_date.strftime('%d')

        s3_path = path.format(prefix, sample_region, sample_year, sample_month, sample_day)
        print('Generate path {}'.format(s3_path))

        sample_files = wr.s3.list_objects(
            path=s3_path,
            boto3_session=boto3_session,
            ignore_empty=True
         )
        
        for sample_file_name in sample_files:
            # read the records from file
            print('Read from file path {}'.format(sample_file_name))
            df = wr.s3.read_json(
                        path=sample_file_name,
                        path_suffix=".json.gz",
                        boto3_session=boto3_session,
                        use_threads=True,
                        lines=True,
                        ignore_empty=True
                    )
        
            # normalise the json
            result_df = pd.json_normalize(df.loc[0].values[0])
            print('Read {} records'.format(result_df.shape[0]))

            # filter out
            if category_filter_out != None:
                result_df.query("eventCategory != '{}'".format(category_filter_out), inplace=True)

            # fix up the columns
            result_df = result_df[result_df.columns.intersection(elements_in_play)]

            print('{} records after filter'.format(result_df.shape[0]))

            # add all rows in the file into the sample
            if (result_df.shape[0] > 0):
                sample_df = pd.concat([sample_df, result_df])
                print('total {} records in sample'.format(sample_df.shape[0]))
        
            if (sample_df.shape[0] >= total_num_samples):
                break
        
        # if all regions have been sampled, move to the next day and repopulate the regions
        if len(available_regions) == 0:
            sample_date = sample_date + timedelta(days=1)
            available_regions = aws_regions.copy()

    return sample_df

def pull_samples(input: IPullSamplesInput):

    print('Commencing CloudTrail Connector Sample...')

    # Setup some pandas configuration to assist in logging when required.
    pd.set_option('display.max_rows', 10)
    pd.set_option('display.max_columns', 200)
    pd.set_option('display.width', None)
    pd.set_option('display.max_colwidth', None)

    print_debug('CloudTrail Connector Sample input => {}'.format(vars(input)))

    boto3_session = input.boto3_session
    source_details = input.source_details

    if 'crossAccountRoleArn' in source_details:
        print('Performing a Cross Account connection!')
        boto3_session = assume_pull_data_sample_role_session(boto3_session.client('sts'),
                                                             source_details['crossAccountRoleArn'])

    # Obtain information about the trail, is it data? management? insights? and other details.
    cloudtrail_client = boto3_session.client('cloudtrail')
    cloudtrail_trail_arn = source_details['cloudTrailTrailArn']
    cloudtrail_event_types = source_details['cloudTrailEventTypes'].split(' & ')
    cloudtrail_date_from = normalize_date(parser.parse(source_details['cloudTrailDateFrom']))
    cloudtrail_date_to = normalize_date(datetime.now())
    if 'cloudTrailDateTo' in source_details:
        cloudtrail_date_to = normalize_date(parser.parse(source_details['cloudTrailDateTo']))

    print('CloudTrail sample date from {}'.format(cloudtrail_date_from))
    print('CloudTrail sample date to {}'.format(cloudtrail_date_to))

    trail_response = cloudtrail_client.get_trail(Name=cloudtrail_trail_arn)

    # Has the configured trail been found?
    if 'Trail' not in trail_response:
        print('No trail found, throwing NoResourceDataFoundException!')
        raise NoSourceDataFoundException("Requested trail either does not exist or appropriate trail and bucket permissions have not been defined.")

    print_debug('CloudTrail.get_trail() response => {}'.format(trail_response))

    # Obtain trail base bucket path, check what kind of trail is (management, data, insights) and then
    # validate connector will have access to the appropriate S3 Bucket and locations required.
    trail_bucket = trail_response['Trail']['S3BucketName']
    cloudtrail_trail_arn_elements = cloudtrail_trail_arn.split(':', 5)

    # Obtain base log location for the CloudTrail, of the form <Bucket>/<Optional_Prefix>/AWSLogs/<TrailARN>.
    # If no Trail.S3KeyPrefix exists in the get_trail() response then no 'Prefix' will be in the path.
    try:
        trail_prefix = trail_response['Trail']['S3KeyPrefix']
        trail_log_location_prefix = "{}/{}/AWSLogs/{}".format(trail_bucket, trail_prefix, cloudtrail_trail_arn_elements[4])
    except KeyError:
        # No optional prefix configured so path is of <Bucket>/AWSLogs/<TrailARN>
        trail_log_location_prefix = "{}/AWSLogs/{}".format(trail_bucket, cloudtrail_trail_arn_elements[4])

    print('CloudTrail log prefix => {}'.format(trail_log_location_prefix))

    # Ascertain what event types have been requested and process sampling accordingly
    elements_in_play = CLOUDTRAIL_COMMON_ELEMENTS
    sample_data_frame = pd.DataFrame()
    sample2_data_frame = pd.DataFrame()
    event_filter_out = None

    if len(cloudtrail_event_types) == 1: # Single event type selected
        if EVENT_CATEGORY_INSIGHT in cloudtrail_event_types: # Only processing insight events (no event filter required)
            elements_in_play = CLOUDTRAIL_INSIGHTS_MANDATORY_ELEMENTS
            sample_data_frame = get_sample_data(
                boto3_session,
                CLOUDTRAIL_INSIGHT_WILDCARD_PATH,
                trail_log_location_prefix,
                cloudtrail_date_from,
                cloudtrail_date_to,
                event_filter_out, elements_in_play
            )

        else: # Only processing either data or management events
            elements_in_play = CLOUDTRAIL_DATA_AND_MANAGEMENT_MANDATORY_ELEMENTS
            event_filter_out = EVENT_CATEGORY_MANAGEMENT
            if EVENT_CATEGORY_MANAGEMENT in cloudtrail_event_types:
                event_filter_out = EVENT_CATEGORY_DATA

            sample_data_frame = get_sample_data(
                boto3_session,
                CLOUDTRAIL_DATA_AND_MANAGEMENT_WILDCARD_PATH,
                trail_log_location_prefix,
                cloudtrail_date_from,
                cloudtrail_date_to,
                event_filter_out,
                elements_in_play
            )

    else:  # Multiple event types selected
        if EVENT_CATEGORY_INSIGHT not in cloudtrail_event_types: # Processing Management and Data Events
            elements_in_play = CLOUDTRAIL_DATA_AND_MANAGEMENT_MANDATORY_ELEMENTS
            sample_data_frame = get_sample_data(
                boto3_session,
                CLOUDTRAIL_DATA_AND_MANAGEMENT_WILDCARD_PATH,
                trail_log_location_prefix,
                cloudtrail_date_from,
                cloudtrail_date_to,
                None,
                elements_in_play
            )

        else: # Processing a combination of Insight and Data/Management Events (reduced common elements)
            sample_data_frame = get_sample_data(boto3_session, CLOUDTRAIL_INSIGHT_WILDCARD_PATH,
                trail_log_location_prefix, cloudtrail_date_from, cloudtrail_date_to,
                                                None, elements_in_play)
            event_not_selected = [x for x in [EVENT_CATEGORY_DATA, EVENT_CATEGORY_MANAGEMENT, EVENT_CATEGORY_INSIGHT] if x not in cloudtrail_event_types]
            if len(event_not_selected) == 1:
                event_filter_out = event_not_selected[0]

            sample2_data_frame = get_sample_data(
                boto3_session,
                CLOUDTRAIL_DATA_AND_MANAGEMENT_WILDCARD_PATH,
                trail_log_location_prefix,
                cloudtrail_date_from,
                cloudtrail_date_to,
                event_filter_out,
                elements_in_play
            )

    sample_data_frame_size = sample_data_frame.shape[0]
    sample2_data_frame_size = sample2_data_frame.shape[0]

    if sample_data_frame_size and sample2_data_frame_size > 5:
        sample_data_frame = pd.concat([sample_data_frame.head(5), sample2_data_frame.head(5)], axis=0, ignore_index=True)
    elif sample_data_frame_size > 5:
        sample_data_frame = pd.concat([sample_data_frame.head(10 - sample2_data_frame_size), sample2_data_frame], axis=0, ignore_index=True)
    elif sample2_data_frame_size > 5:
        sample_data_frame = pd.concat([sample_data_frame, sample2_data_frame.head(10 - sample_data_frame_size)], axis=0, ignore_index=True)
    else:
        sample_data_frame = pd.concat([sample_data_frame, sample2_data_frame], axis=0, ignore_index=True)

    print_debug('CloudTrail sample resulting data frame =>\n{}'.format(sample_data_frame.to_string()))
    
    # Return the final sample to display.
    return [Sample("CLOUDTRAIL", sample_data_frame, 'parquet')]

