###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
from awsglue.transforms import Filter

"""
Sample script for use in transform execution tests.

Filters data using a glue DynamicFrame, which has a dynamic schema and therefore if the resultant frame
is empty loses schema information.
"""
def apply_transform(input_frame, transformation_ctx, **kwargs):
    return [Filter.apply(frame=input_frame, f = lambda r: r['midi-chlorians'] < 10000)]
