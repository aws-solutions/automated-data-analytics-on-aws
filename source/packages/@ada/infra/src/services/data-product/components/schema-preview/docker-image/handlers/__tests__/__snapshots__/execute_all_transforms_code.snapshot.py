###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import pathlib, os, json

def _read_input_metadata():
    with open(os.path.join(pathlib.Path(__file__).resolve().parent, 'input_metadata.json'), 'r') as f:
        return json.loads(f.read())

def _write_output_metadata(metadata):
    with open(os.path.join(pathlib.Path(__file__).resolve().parent, 'output_metadata.json'), 'w') as f:
        return f.write(json.dumps(metadata))

# The wrapped transform functions are defined first, to be used below when applying transforms
###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
def _apply_transform_0(**kwargs):
    try:
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

        return apply_transform(**kwargs)
    except Exception as e:
        _write_output_metadata({
            'error': str(e)
        })
        raise e


###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
def _apply_transform_1(**kwargs):
    try:
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

        return apply_transform(**kwargs)
    except Exception as e:
        _write_output_metadata({
            'error': str(e)
        })
        raise e


###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
def _apply_transform_2(**kwargs):
    try:
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

        return apply_transform(**kwargs)
    except Exception as e:
        _write_output_metadata({
            'error': str(e)
        })
        raise e


from pyspark.context import SparkContext
from awsglue.context import GlueContext
from pyspark.conf import SparkConf
from awsglue.dynamicframe import DynamicFrame

# Create the spark and glue context - this is done once for all transforms as it's a time consuming operation
spark_context = SparkContext.getOrCreate(SparkConf()
    .setMaster("local[1]")
    .set("spark.default.parallelism", 1)
    .set("spark.executor.instances", 1))
glue_context = GlueContext(spark_context)

input_metadata = _read_input_metadata()

# Read the input frames from the temporary directory. input_frames_info is already available in global scope
input_frames = [
    DynamicFrame.fromDF(glue_context.read.parquet(frame_info['path']), glue_context, frame_info['name'])
    for frame_info in input_metadata['input_frames_info']
]

global_transform_kwargs = input_metadata['global_transform_kwargs']

# Apply all transforms to the input frames. input_frames is mutated
###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
# Apply the transform to every input frame
transform_step_output = []
try:
    for i in range(0, len(input_frames)):
        transform_step_output = transform_step_output + _apply_transform_0(
            spark_context=spark_context,
            glue_context=glue_context,
            input_frame=input_frames[i],
            temp_s3_path='s3://test/0',
            transformation_ctx='{}_{}'.format('json_relationalize_0', i),
            input_args=input_metadata['transform_input_args']['_apply_transform_0'],
            **global_transform_kwargs,
        )
except Exception as e:
    _write_output_metadata({
        'error': str(e)
    })
    raise e

# Update the input ready for the next transforms
input_frames = transform_step_output


###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
# Apply the transform to every input frame
transform_step_output = []
try:
    for i in range(0, len(input_frames)):
        transform_step_output = transform_step_output + _apply_transform_1(
            spark_context=spark_context,
            glue_context=glue_context,
            input_frame=input_frames[i],
            temp_s3_path='s3://test/1',
            transformation_ctx='{}_{}'.format('add_prefix_to_column_names_1', i),
            input_args=input_metadata['transform_input_args']['_apply_transform_1'],
            **global_transform_kwargs,
        )
except Exception as e:
    _write_output_metadata({
        'error': str(e)
    })
    raise e

# Update the input ready for the next transforms
input_frames = transform_step_output


###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
# Apply the transform to every input frame
transform_step_output = []
try:
    for i in range(0, len(input_frames)):
        transform_step_output = transform_step_output + _apply_transform_2(
            spark_context=spark_context,
            glue_context=glue_context,
            input_frame=input_frames[i],
            temp_s3_path='s3://test/2',
            transformation_ctx='{}_{}'.format('add_prefix_to_column_names_with_helper_2', i),
            input_args=input_metadata['transform_input_args']['_apply_transform_2'],
            **global_transform_kwargs,
        )
except Exception as e:
    _write_output_metadata({
        'error': str(e)
    })
    raise e

# Update the input ready for the next transforms
input_frames = transform_step_output


# Write the transform output to the temporary directory
output_frames_info = []
for i in range(0, len(input_frames)):
    output_frame = input_frames[i]
    path = "{}/{}.parquet".format(input_metadata['output_frames_path'], i)
    # Parquet does not support empty schemas, so we only write non-empty data frames
    if len([field for field in output_frame.schema()]) > 0:
        output_frame.toDF().write.parquet(path)
        output_frames_info.append({"name": output_frame.name, "path": path})
    else:
        # Set the empty flag to indicate to the parent process to create an empty data frame instead of loading a file
        output_frames_info.append({"name": output_frame.name, "empty": True})

_write_output_metadata({
    'output_frames_info': output_frames_info,
})
