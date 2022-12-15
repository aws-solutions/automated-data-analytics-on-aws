###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import uuid

from .common import * # NOSONAR
from .core import * # NOSONAR

def handler(event, _): # NOSONAR
    """
    Handler for pulling sample data for a data product
    """
    payload = event['Payload']
    data_product = payload['dataProduct']
    sample_size = payload['sampleSize']
    calling_user = payload['callingUser']

    session_id = uuid.uuid4()
    print('Starting transforms with session id {}'.format(session_id))

    samples = pull_samples(data_product, sample_size, calling_user)

    payload['tableDetails'] = []

    for sample in samples:
        payload['tableDetails'].append(
            write_sample(session_id, data_product, sample))

    return payload
