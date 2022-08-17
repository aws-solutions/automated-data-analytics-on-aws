###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
# Apply the transform to every input frame
transform_step_output = []
try:
    for i in range(0, len(input_frames)):
        transform_step_output = transform_step_output + {wrapped_transform_method}(
            spark_context=spark_context,
            glue_context=glue_context,
            input_frame=input_frames[i],
            temp_s3_path='{temp_s3_path}',
            transformation_ctx='{{}}_{{}}'.format('{transform_ctx_prefix}', i),
            input_args=input_metadata['transform_input_args']['{wrapped_transform_method}'],
            **global_transform_kwargs,
        )
except Exception as e:
    _write_output_metadata({{
        'error': str(e)
    }})
    raise e

# Update the input ready for the next transforms
input_frames = transform_step_output
