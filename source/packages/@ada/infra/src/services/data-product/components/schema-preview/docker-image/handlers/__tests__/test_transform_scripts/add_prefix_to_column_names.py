###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
from awsglue.transforms import ApplyMapping

"""
Sample script for use in transform execution tests
"""
def apply_transform(input_frame, transformation_ctx, **kwargs):
    mappings = [(
        "`{}`".format(field.name),
        field.dataType.jsonValue()["dataType"],
        "`special_prefix_{}`".format(field.name),
        field.dataType.jsonValue()["dataType"]
    ) for field in input_frame.schema()]
    return [ApplyMapping.apply(
        frame=input_frame,
        mappings=mappings,
        transformation_ctx=transformation_ctx,
    )]
