###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
"""
Parquet Data Type Map transform
At this time this function only exists to trigger the Transform flows, during which
we can catch and handle issues around the TIME64 data type in the file.
"""
def apply_transform(input_frame, **__):
    return [input_frame]
