###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import pandas as pd
import re
import json
from awsglue.dynamicframe import DynamicFrame
from pyspark.sql import SparkSession


def extract_json(payload: str, pattern: str) -> object or None:
    result = re.search(pattern, payload)
    if result:
        try:  
            return json.loads(result.group(1))
        except json.JSONDecodeError as _e:
            return None
    
    return None

"""
Message Explode transformation

For Cloudwatch Lambda Logs, where the message field contains nested JSON messages substring.
This transform will extract the JSON string and explode the key values onto the table

eg initial table:
timestamp   |   messege
-------------------------------------
1985/09/25  | {'A' : 'a1', 'B': 'b1'}

resultant table:
timestamp   |        messege          |    A    |    B    
----------------------------------------------------------
1985/09/25  | {'A' : 'a1', 'B': 'b1'} |   a1    |   b1

input_args = {"mapping" : [['source_field_name', 'target_field_name', 'target_field_type']]}
"""
def apply_transform(input_frame, input_args, glue_context, **kwargs):
    print(f"Input args: {input_args}")
    df = input_frame.toDF()
    pandas_df = df.toPandas()

    pandas_df["json_extracted"] = pandas_df["message"].apply(extract_json, pattern=input_args["extraction_str"])
    print("Extraction has been applied")
    print(pandas_df)

    if pandas_df['json_extracted'].isnull().all():
        print("No JSON extracted - returning origin data")
        return [input_frame]
    
    pandas_df = pandas_df.dropna(axis=0, subset=['json_extracted'])
    
    ndf = pd.json_normalize(pandas_df.json_extracted)
    
    # null percent drop
    perc = input_args["drop_threshold"]
    min_count =  int(((100-perc)/100)*ndf.shape[0] + 1)
    mod_df = ndf.dropna( axis=1, thresh=min_count)
    
    merged = pd.merge(pandas_df, mod_df, left_index=True, right_index=True)
    merged = merged.drop("json_extracted", axis=1)
    merged=merged.astype(str)
    
    spark = SparkSession.builder.master("local[1]").appName("ada").getOrCreate()
    
    fin_sp_df=spark.createDataFrame(merged)
    output_frame = DynamicFrame.fromDF(fin_sp_df, glue_context, "output_frame")

    return [output_frame]
