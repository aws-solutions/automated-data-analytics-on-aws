###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
"""
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License Version 2.0 (the 'License'). You may not use this file except in compliance
with the License. A copy of the License is located at

    http://www.apache.org/licenses/
or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
and limitations under the License.
"""
import logging
import boto3
import json
from uuid import uuid4

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')
cloudfront_client = boto3.client('cloudfront')

"""
  Custom resource to upload json config to the website S3 bucket, as a method of passing infrastructure parameters
  such as API URLs to a static website.
"""
def on_event(event, context): # NOSONAR
    request_type = event['RequestType']
    if request_type == 'Create' or request_type == 'Update':
        s3_bucket = event['ResourceProperties']['S3_BUCKET']
        s3_key = event['ResourceProperties']['S3_CONFIG_FILE_KEY']
        website_config = event['ResourceProperties']['WEBSITE_CONFIG']
        distribution_id = event['ResourceProperties']['CLOUDFRONT_DISTRIBUTION_ID']
        update_website_config(s3_bucket, s3_key, website_config, distribution_id)
    elif request_type == 'Delete':
        logger.info("Website config deletion")
    else:
        raise InvalidRequestTypeError("Invalid request type: %s" % request_type)


def update_website_config(s3_bucket, s3_key, website_config, distribution_id):
    logger.info(f"Updating config file {s3_key}")
    s3_client.put_object(Body=website_config, Bucket=s3_bucket, Key=s3_key)

    logger.info(f"Invalidating Cloudfront distribution {distribution_id}")
    cloudfront_client.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            'Paths': {
                'Quantity': 1,
                'Items': [f'/{s3_key}']
            },
            'CallerReference': str(uuid4()),
        })

    logger.info(f"Website config updated succesfully")

class InvalidRequestTypeError(Exception):
    """Provided request type is invalid"""
    pass
