###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
from awsglue.context import GlueContext
import uuid
import shutil

from .core import * # NOSONAR

def handler(event, _): # NOSONAR
    """
    Lambda handler for executing transforms on sample datasets
    """
    payload = event['Payload']
    data_product = payload['dataProduct']
    data_product_id = data_product["dataProductId"]
    domain_id = data_product["domainId"]
    table_details = payload['tableDetails']
    glue_context = GlueContext(sc)

    input_sample_frames = load_sample_data(glue_context, table_details)

    session_id = uuid.uuid4()
    print('Starting transforms with session id {}'.format(session_id))

    # Load the transform scripts
    transforms = load_transform_functions(payload['orderedTransforms'])

    # Execute the transform loop

    session_path = '/tmp/transform-session/{}'.format(session_id)

    try:
        # Apply all the transform functions
        output_frames = apply_transforms(
            transforms, input_sample_frames, glue_context, data_product_id, session_path)

        # Return the initial and transformed schemas and sample data
        result = {
            "initialDataSets": build_initial_data_sets_result_schema_and_data(session_id, domain_id, data_product_id, table_details, input_sample_frames),
            "transformedDataSets": build_result_schema_and_data(session_id, domain_id, data_product_id, output_frames),
            "transformsApplied": [{"scriptId": transform.script_id, "namespace": transform.namespace} for transform in transforms]
        }

        # serialize manually to avoid Lambda from throwing an error: Runtime.MarshalError
        return simplejson.loads(json_dumps(result))
    finally:
        # Clean up temporary input/output files if they exist
        if os.path.isdir(session_path):
            shutil.rmtree(session_path)
