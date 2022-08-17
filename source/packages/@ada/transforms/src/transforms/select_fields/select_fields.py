###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
def apply_transform(input_frame, input_args, glue_context, **kwargs):
    data = input_frame.select_fields(paths=input_args['paths'])
    return [data]
