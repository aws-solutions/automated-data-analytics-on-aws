###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import awswrangler as wr
from pyspark.context import SparkContext
from pyspark.conf import SparkConf
from pyspark.sql.types import StructType
from pyspark.sql import SparkSession
from awsglue.dynamicframe import DynamicFrame
from awsglue.transforms import ApplyMapping
from datetime import date, datetime, time
import simplejson
import os
import textwrap
import subprocess
import json
import simplejson
import boto3

from handlers.common import * # NOSONAR


# The environment for executing transforms in the sandbox, such that the spark/glue libraries are available
SANDBOX_ENV = {
    'AWS_REGION': os.environ['AWS_REGION'],
    'AWS_ACCESS_KEY_ID': os.environ['AWS_ACCESS_KEY_ID'],
    'AWS_SECRET_ACCESS_KEY': os.environ['AWS_SECRET_ACCESS_KEY'],
    'AWS_SESSION_TOKEN': os.environ['AWS_SESSION_TOKEN'],
    'SPARK_SCALA_VERSION': os.environ['SPARK_SCALA_VERSION'],
    'PYSPARK_DRIVER_PYTHON': os.environ['PYSPARK_DRIVER_PYTHON'],
    'PYSPARK_PYTHON': os.environ['PYSPARK_PYTHON'],
    'SPARK_LOCAL_IP': os.environ['SPARK_LOCAL_IP'],
    'SPARK_HOME': os.environ['SPARK_HOME'],
    'JAVA_HOME': os.environ['JAVA_HOME'],
    'SPARK_CONF_DIR': os.environ['SPARK_CONF_DIR'],
    'GLUE_JARS_DIR': os.environ['GLUE_JARS_DIR'],
    'PYTHONPATH': ':'.join([
        os.environ['SPARK_PYTHON_PATH'],
        os.environ['SPARK_PY4J_PATH'],
        os.environ['GLUE_PYTHON_PATH'],
    ]),
}

TEMP_BUCKET_NAME = os.environ['TEMP_BUCKET_NAME']
MAX_NUM_PREVIEW_ROWS_IN_MEMORY = 10


def load_transform_template(name):
    with open('/glue/handlers/transform/templates/{}.template.py'.format(name), 'r') as f:
        return f.read()


APPLY_TRANSFORM_TEMPLATE = load_transform_template('apply_transform')
DEFINE_TRANSFORM_WRAPPER_TEMPLATE = load_transform_template('define_transform_wrapper')
EXECUTE_ALL_TRANSFORMS_TEMPLATE = load_transform_template('execute_all_transforms')


def json_serializer(obj):
    """
    Serialize unknown objects
    """
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError("Type %s not serializable" % type(obj))


def json_dumps(obj):
    """
    Stringify the object in a valid json, internally utilises the custom json_serializer
    for objects that are not natively supported.

    NaN are automatically skipped
    """
    return simplejson.dumps(obj, sort_keys=True, default=json_serializer, ignore_nan=True)


# Instantiate a minimal spark context, since lambda has a limit of 1024 file descriptors
sc = SparkContext.getOrCreate(SparkConf()
                              .setMaster('local[1]')
                              .set("spark.default.parallelism", 1)
                              .set("spark.executor.instances", 1))


class Transform:
    def __init__(self, namespace, script_id, index, script_content, temp_s3_path, input_args):
        self.index = index
        self.unique_transform_ctx_prefix = "{}_{}".format(script_id, index)
        self.namespace = namespace
        self.script_id = script_id
        self.script_content = script_content
        self.temp_s3_path = temp_s3_path
        self.input_args = input_args

    def wrapped_transform_method_name(self):
        return "_apply_transform_{index}".format(index=self.index)

    def wrapped_transform_code(self):
        """
        Wraps the transform code so that it can be used alongside other transform scripts without name clashes
        (since all transforms are named apply_transform)
        """
        return DEFINE_TRANSFORM_WRAPPER_TEMPLATE.format(
            wrapped_transform_method_name=self.wrapped_transform_method_name(),
            script_content=textwrap.indent(self.script_content, ' ' * 8)
        )

    def apply_transform_code(self):
        """
        Generates the code to apply the transform in the transform execution process
        """
        return APPLY_TRANSFORM_TEMPLATE.format(
            wrapped_transform_method=self.wrapped_transform_method_name(),
            temp_s3_path=self.temp_s3_path,
            transform_ctx_prefix=self.unique_transform_ctx_prefix,
        )


def generate_execute_all_transforms_code(transforms):
    """
    Generates the code to execute in the sandbox process to apply all transforms
    """
    return EXECUTE_ALL_TRANSFORMS_TEMPLATE.format(
        define_wrapped_transform_functions='\n\n'.join(
            [transform.wrapped_transform_code() for transform in transforms]),
        apply_transforms='\n\n'.join(
            [transform.apply_transform_code() for transform in transforms]),
    )


def _write_input_metadata(input_metadata, session_path):
    with open(os.path.join(session_path, 'input_metadata.json'), 'w') as f:
        f.write(json.dumps(input_metadata))


def _read_output_metadata(session_path):
    with open(os.path.join(session_path, 'output_metadata.json'), 'r') as f:
        return json.loads(f.read())


def execute_code(code, session_path):
    """
    Executes the given python code in the sandbox
    :param code: python code to execute
    :param session_path: path in which to write the code and use as a working directory
    :return: return code, stdout and stderr
    """
    # Write the code ready to execute
    code_file_name = 'execute_transforms.py'
    with open(os.path.join(session_path, code_file_name), 'w') as f:
        f.write(code)

    # Execute the code
    process = subprocess.Popen(
        ['/sandbox/bin/python3', '-E', '-B', code_file_name],
        cwd=session_path,
        env=SANDBOX_ENV,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    stdout, stderr = process.communicate()
    return process.returncode, stdout, stderr


def execute_sandboxed_transforms(transforms, session_path, input_frames_info, output_frames_path, data_product_id):
    """
    Executes the given transforms in the sandbox process
    :param transforms: the transforms to apply
    :param input_frames_info: list of objects with name and path indicating name and location of parquet data frame
    :param output_frames_path: location to write output frames to
    :param data_product_id: the id of the data product we are executing transforms for
    :return: list of objects with name and path of output data frames
    """
    # Write the input metadata for our transforms - only serialiseable values may be written here, ie not data
    _write_input_metadata({
        'input_frames_info': input_frames_info,
        'output_frames_path': output_frames_path,
        'global_transform_kwargs': {
            'data_product_id': data_product_id,
        },
        'transform_input_args': {
            transform.wrapped_transform_method_name(): transform.input_args for transform in transforms
        }
    }, session_path)

    # Execute the transforms in the sandbox process
    code = generate_execute_all_transforms_code(transforms)
    retcode, stdout, stderr = execute_code(code, session_path)

    try:
        output_metadata = _read_output_metadata(session_path)
    except SystemExit:
      raise
    except Exception as e:
        print(e)
        raise TransformExecutionError('An unexpected error occurred when executing the transform script')

    # When there's no error, return the output frames
    if retcode == 0:
        # Return the output frames
        return output_metadata['output_frames_info']

    # Handle errors
    error = output_metadata.get('error', None)
    if error is not None:
        raise TransformExecutionError(output_metadata['error'])

    raise TransformExecutionError(
        'An unexpected error occurred when executing the transform script')


def read_frame(glue_context, frame_info):
    # Read a parquet output frame written by the transforms.
    # Empty frames aren't written to the filesystem since they cannot be represented by parquet, so we handle the special
    # case here
    df = sc.emptyRDD().toDF(StructType([])) if frame_info.get(
        'empty', False) else glue_context.read.parquet(frame_info['path'])
    return DynamicFrame.fromDF(df, glue_context, frame_info['name'])


def apply_transforms(transforms, input_sample_frames, glue_context, data_product_id, session_path):
    # Shortcut: when there are no transforms to apply, we don't need to spin up a sandbox.
    # We save the overhead of setting up the sandbox spark context etc by just returning the input frames.
    if len(transforms) == 0:
        return input_sample_frames

    # Create the input/output directories for frames
    input_frames_path = '{}/input'.format(session_path)
    output_frames_path = '{}/output'.format(session_path)
    os.makedirs(input_frames_path)
    os.makedirs(output_frames_path)

    # Write the input frames to the temp directory
    input_frames_info = []
    for i in range(0, len(input_sample_frames)):
        input_frame = input_sample_frames[i]
        input_frame_path = '{}/{}.parquet'.format(input_frames_path, i)
        input_frame.toDF().write.parquet(input_frame_path)
        input_frames_info.append(
            {'name': input_frame.name, 'path': input_frame_path})

    # Execute the transforms
    output_frames_info = execute_sandboxed_transforms(
        transforms, session_path, input_frames_info, output_frames_path, data_product_id)
    return [read_frame(glue_context, frame_info) for frame_info in output_frames_info]


class UnsupportedDataFormatException(Exception):
    pass
class TransformExecutionError(Exception):
    pass


def make_dynamic_frame_from_dict(glue_context, name, data, ordered_columns):
    """
    Given a dictionary of data in "records" format (eg: [{'col1': 'a', 'col2': 1}, {'col1': 'b', 'col2': 2 }]),
    convert it to a glue dynamic frame.

    The ordering of columns in the returned dynamic frame will be in the order specified in the ordered_columns parameter
    """
    return DynamicFrame.fromDF(glue_context.spark_session.read.json(
        sc.parallelize(map(lambda x: json_dumps(x), data))
    ), glue_context, name).select_fields(['`{}`'.format(column) for column in ordered_columns])


def build_data_set_id(data_product_id, table_name):
    """
    Construct a dataset id for a table
    Note that this replicates the logic in buildDataSetId in update-data-product.ts to increase the likelihood that the
    resultant data set names will be the same as those from the real transform loop.
    """
    dataset_id = table_name
    if dataset_id.startswith(data_product_id):
        dataset_id = dataset_id.replace(data_product_id, '', 1)
    dataset_id = (dataset_id.strip('-_') or DEFAULT_DATASET_ID).lower()
    return dataset_id.replace('.', '_')


def _load_csv_with_encoded_types(glue_context, table):
    """
    Loads a csv file written by pull_data_sample, which encodes the data types in the first row
    """
    path = table['sampleDataS3Path']
    dtypes = wr.s3.read_csv(path=path, nrows=1).iloc[0].to_dict()
    df = wr.s3.read_csv(path=path, dtype=dtypes, skiprows=[1])
    # df has columns in the order they were read from the csv file
    return make_dynamic_frame_from_dict(glue_context, table['tableName'], df.to_dict(orient='records'), df.columns)


def _load_parquet_file_type(glue_context, table):
    """
    Loads a parquet file from s3, and Explicitly convert on Time data top string to avoid error
    in spark.
    Time data type is mapped to INT64 TIMESTAMP_MICROS in parquet which results illegal type in
    spark query.
    """
    path = table['sampleDataS3Path']
    p_dataframe = wr.s3.read_parquet(path=path)

    for col in p_dataframe:
        if isinstance(p_dataframe[col][0], time):
            print(f"{p_dataframe[col]} is of type 'time'")
            p_dataframe[col] = p_dataframe[col].astype(str)

    spark = SparkSession.builder.master("local[1]") \
                                .appName('ada') \
                                .getOrCreate()

    spark_dataframe = spark.createDataFrame(p_dataframe)

    return DynamicFrame.fromDF(spark_dataframe, glue_context, table['tableName'])


def _load_sample_data_table(glue_context, table):
    if table['classification'] == 'csv':
        return _load_csv_with_encoded_types(glue_context, table)
    if table['classification'] == 'json':
        return glue_context.create_dynamic_frame.from_options(
            "s3", {'paths': [table['sampleDataS3Path']]}, format="json")
    if table['classification'] == 'parquet':
        try:
            return glue_context.create_dynamic_frame.from_options(
                "s3", {'paths': [table['sampleDataS3Path']]}, format="parquet")
        except Exception as _:
            print(_)
            return _load_parquet_file_type(glue_context, table)

    raise UnsupportedDataFormatException(
        f"Unable to load sample data in format {table['classification']}")


def _sanitise_column_names(frame):
    mappings = [(
        "`{}`".format(field.name),
        field.dataType.jsonValue()["dataType"],
        # Lowercase the column names and remove leading/trailing spaces to match the behaviour of the glue crawler,
        # ensuring that custom transform scripts operate on the same schema during preview as they would during the
        # real import.
        "`{}`".format(field.name.lower().strip()),
        field.dataType.jsonValue()["dataType"]
    ) for field in frame.schema()]
    return ApplyMapping.apply(
        frame=frame,
        mappings=mappings,
        transformation_ctx='_initial_transform_ctx_lowercase_{}'.format(
            frame.name),
    )


def load_sample_data_table(glue_context, table):
    print("Loading sample data for table {}".format(json_dumps(table)))
    frame = _load_sample_data_table(glue_context, table)
    frame.name = table['tableName']
    return _sanitise_column_names(frame)


def load_sample_data(glue_context, table_details):
    return [load_sample_data_table(glue_context, table) for table in table_details]


def load_transform_functions(ordered_transforms):
    """
    Deserialise the transforms ready for execution
    """
    transform_functions = []

    for i in range(0, len(ordered_transforms)):
        transform = ordered_transforms[i]
        transform_functions.append(Transform(
            transform["namespace"], transform["scriptId"], i, transform['scriptContent'], transform["tempS3Path"], transform.get("inputArgs", {})))

    return transform_functions


def build_result_schema_and_data(session_id, domain_id, data_product_id, data_frames):
    return {build_data_set_id(data_product_id, frame.name): {
        "schema": frame.schema().jsonValue(),
        "data": [],
        "s3SamplePath": write_sample_data('transformed', session_id, domain_id, data_product_id,  build_data_set_id(data_product_id, frame.name), frame),
    } for frame in data_frames}


def build_initial_data_sets_result_schema_and_data(session_id, domain_id, data_product_id, table_details, data_frames):
    return {build_data_set_id(data_product_id, data_frames[i].name): {
        "schema": data_frames[i].schema().jsonValue(),
        "data": [],
        "s3Path": details.get('originalDataS3Path') or details.get('sampleDataS3Path'),
        "s3SamplePath": write_sample_data('source', session_id, domain_id, data_product_id,  build_data_set_id(data_product_id, data_frames[i].name), data_frames[i]),
        "classification": details['classification'],
        "metadata": details.get("metadata"),
    } for i, details in enumerate(table_details)}


def to_s3_path(s3_location):
    return 's3://{}/{}'.format(s3_location['bucket'], s3_location['key'])


def write_sample_data(folder_name, session_id, domain_id, data_product_id,  data_set_id, sample_data_in_df):
    """
    Save data to s3 due to step function payload limit of 256 KB (States.DataLimitExceeded)
    https://aws.amazon.com/about-aws/whats-new/2020/09/aws-step-functions-increases-payload-size-to-256kb/
    https://docs.aws.amazon.com/step-functions/latest/dg/limits-overview.html#service-limits-general
    """
    key = '{}/{}/{}/{}/{}/data.json'.format(
        domain_id, data_product_id, session_id, folder_name, data_set_id)
    path = to_s3_path({
        'bucket': TEMP_BUCKET_NAME,
        'key': key
    })

    try:
        wr.s3.to_json(df=sample_data_in_df.toDF().toPandas(), path=path,
                      lines=False, orient='records')
    except wr.exceptions.EmptyDataFrame:
        print("Transform resulted in empty data frame, writing empty result to temp bucket")
        boto3.client('s3').put_object(
            Bucket=TEMP_BUCKET_NAME, Key=key, Body=b'[]')
    return path
