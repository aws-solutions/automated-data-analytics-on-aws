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
{define_wrapped_transform_functions}

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
{apply_transforms}

# Write the transform output to the temporary directory
output_frames_info = []
for i in range(0, len(input_frames)):
    output_frame = input_frames[i]
    path = "{{}}/{{}}.parquet".format(input_metadata['output_frames_path'], i)
    # Parquet does not support empty schemas, so we only write non-empty data frames
    if len([field for field in output_frame.schema()]) > 0:
        output_frame.toDF().write.parquet(path)
        output_frames_info.append({{"name": output_frame.name, "path": path}})
    else:
        # Set the empty flag to indicate to the parent process to create an empty data frame instead of loading a file
        output_frames_info.append({{"name": output_frame.name, "empty": True}})

_write_output_metadata({{
    'output_frames_info': output_frames_info,
}})
