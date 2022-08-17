###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
"""
Sample script for use in transform execution tests
"""
def apply_transform(input_frame, data_product_id, temp_s3_path, **kwargs):
    data = input_frame.relationalize(
        data_product_id, temp_s3_path
    )
    return [frame for frame in [data.select(df_name) for df_name in data.keys()] if frame.toDF().schema]
