###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
from awsglue.transforms import ApplyMapping

# This helper method is defined at the script level, and should be referenceable when running the transform
def get_the_prefix():
    return "helper_prefix"

"""
Sample script for use in transform execution tests
"""
def apply_transform(input_frame, transformation_ctx, **kwargs):
    mappings = [(
        "`{}`".format(field.name),
        field.dataType.jsonValue()["dataType"],
        "`{}_{}`".format(get_the_prefix(), field.name),
        field.dataType.jsonValue()["dataType"]
    ) for field in input_frame.schema()]
    return [ApplyMapping.apply(
        frame=input_frame,
        mappings=mappings,
        transformation_ctx=transformation_ctx,
    )]
