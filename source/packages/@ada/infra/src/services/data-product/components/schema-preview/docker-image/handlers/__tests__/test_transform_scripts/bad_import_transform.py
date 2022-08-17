###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
# This transform imports an illegal module - awswrangler is used in the transform lambda but should not be made
# available to the transforms since it is not available in glue.
import awswrangler as wr
def apply_transform(input_frame, **kwargs):
    return [input_frame]
