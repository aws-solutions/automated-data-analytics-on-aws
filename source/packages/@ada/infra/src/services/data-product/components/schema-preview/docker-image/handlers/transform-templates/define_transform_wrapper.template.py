###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
def {wrapped_transform_method_name}(**kwargs):
    try:
{script_content}
        return apply_transform(**kwargs)
    except Exception as e:
        _write_output_metadata({{
            'error': str(e)
        }})
        raise e
