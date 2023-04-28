###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import sys
from datetime import time
import json
import re
from awsglue.transforms import * # NOSONAR (python:S2208)
from awsglue.utils import getResolvedOptions
from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.dynamicframe import DynamicFrame
from pyspark.context import SparkContext
from pyspark.sql import SparkSession
from transform_script import apply_transform
import awswrangler as wr
from py4j.protocol import Py4JJavaError


# @params: [JOB_NAME]
args = getResolvedOptions(
    sys.argv,
    [
        "JOB_NAME",
        "DATABASE_NAME",
        "INPUT_TABLE_NAME",
        "DATA_PRODUCT_ID",
        "TEMP_S3_PATH",
        "OUTPUT_S3_PATH",
        "INPUT_ARGS",
    ],
)

# Create the spark context
sc = SparkContext.getOrCreate()

# Use s3a filesystem to avoid creation of _$folder$ directory markers in s3, since these require
# more s3 privileges to write.
hadoop_conf = sc._jsc.hadoopConfiguration()
hadoop_conf.set("fs.s3.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")

# Create the glue context and initialise the job
glue_context = GlueContext(sc)
job = Job(glue_context)
job.init(args["JOB_NAME"], args)

try:
    # Read the input dynamic frame
    input_frame = glue_context.create_dynamic_frame.from_catalog(
        database=args["DATABASE_NAME"],
        table_name=args["INPUT_TABLE_NAME"],
        transformation_ctx="input_frame",
    )

except Py4JJavaError as e:
    # If Parquet file has a column of type INT64 TIMESTAMP_MICROS,
    # glue_context.create_dynamic_frame.from_catalog cannot read the datatype, so we have to
    # convert it to string through datawranger pandas df and then convert to a
    # spark df. Finally converting to a DynamicFrame from the spark df
    error_message = e.java_exception.getCause().toString()
    ERROR_MATCH = r"(Illegal Parquet type: INT64 \(TIME_MICROS\))"

    if re.search(ERROR_MATCH, error_message):
        table_location = wr.catalog.get_table_location(
            database=args["DATABASE_NAME"], table=args["INPUT_TABLE_NAME"])
        df = wr.s3.read_parquet(path=table_location)

        for col in df:
            if isinstance(df[col][0], time):
                print(f"{df[col]} is of type 'time'")
                df[col] = df[col].astype(str)

        spark = SparkSession.builder.master("local[1]") \
                                    .appName('ada') \
                                    .getOrCreate()
        df_spark = spark.createDataFrame(df)
        input_frame = DynamicFrame.fromDF(df_spark, glue_context, args["INPUT_TABLE_NAME"])


spark_input_frame = input_frame.toDF()
# convert all column names to lowercase
lowered_column_if = spark_input_frame.toDF(*[c.lower() for c in spark_input_frame.columns])

if not spark_input_frame.rdd.isEmpty():
    print("Applying transforms")
    # Apply the transform
    output_frames = apply_transform(
        spark_context=sc,
        glue_context=glue_context,
        input_frame=DynamicFrame.fromDF(lowered_column_if,
                                        glue_context,
                                        args["INPUT_TABLE_NAME"]
                                        ),
        data_product_id=args["DATA_PRODUCT_ID"],
        temp_s3_path=args["TEMP_S3_PATH"],
        transformation_ctx="transform",
        input_args=json.loads(args["INPUT_ARGS"]),
    )

    # Write the result to s3
    for output_frame in output_frames:
        print("Writing to s3 table: ", output_frame.name)
        s3_path = args["OUTPUT_S3_PATH"] + output_frame.name
        glue_context.write_dynamic_frame.from_options(
            frame=output_frame,
            connection_type="s3",
            connection_options={"path": s3_path},
            format="parquet",
            transformation_ctx=f"output_frame_{output_frame.name}",
        )

job.commit()