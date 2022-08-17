###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
from awsglue.dynamicframe import DynamicFrame

"""
Sample script for use in transform execution tests.

Filters data using a spark dataframe which has a static schema and therefore the schema is preserved
"""
def apply_transform(input_frame, glue_context, **kwargs):
    df = input_frame.toDF()
    return [DynamicFrame.fromDF(df.filter(df['midi-chlorians'] < 10000), glue_context, input_frame.name)]
