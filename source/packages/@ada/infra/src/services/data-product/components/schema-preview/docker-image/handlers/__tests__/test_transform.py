###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import pathlib
import os
import json
import math
from awswrangler.exceptions import EmptyDataFrame
from datetime import datetime
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from pyspark.conf import SparkConf
from unittest.mock import patch
import pytest

from handlers.common import * # NOSONAR
import handlers.transform as transform

sc = SparkContext.getOrCreate(SparkConf()
                              .setMaster('local[1]')
                              .set("spark.default.parallelism", 1)
                              .set("spark.executor.instances", 1))
glue_context = GlueContext(sc)

MOCK_UUID = '34f280e4-6f14-4f42-a510-cb8abee22813'
SNAPSHOT_DIR = os.path.join(pathlib.Path(__file__).resolve().parent, '__snapshots__')

def _load_scripts(scripts):
    """
    Helper method to load scripts from the 'test_transform_scripts' directory
    """
    ordered_transforms = []

    script_dir = os.path.join(pathlib.Path(
        __file__).resolve().parent, 'test_transform_scripts')
    for i in range(0, len(scripts)):
        script = scripts[i]
        with open(os.path.join(script_dir, '{}.py'.format(script.get("id")))) as f:
            ordered_transforms.append({
                "scriptId": script.get("id"),
                "namespace": "test",
                "scriptContent": f.read(),
                "inputArgs": script.get("inputArgs"),
                "tempS3Path": "s3://test/{}".format(i)
            })

    return ordered_transforms


def _run_transforms(scripts, table_details):
    """
    Run the lambda handler
    """
    return json.loads(json.dumps(transform.handler({
        "Payload": {
            "orderedTransforms": _load_scripts(scripts),
            "tableDetails": table_details,
            "dataProduct": {
                "domainId": "my_domain",
                "dataProductId": "my_data_product"
            },
        }
    }, None)))


def _make_dynamic_frame(name, data, ordered_columns):
    return transform.make_dynamic_frame_from_dict(glue_context, name, data, ordered_columns)


@patch("awswrangler.s3")
@patch("uuid.uuid4")
@patch("handlers.transform.core._load_sample_data_table")
def test_should_apply_no_transforms(mock_load_sample_data, uuid_mock, s3):
    mock_load_sample_data.return_value = _make_dynamic_frame('simpleTable', [
        {"name": "Darth Vader", "lightsaber_colour": "red"},
        {"name": "Luke Skywalker", "lightsaber_colour": "green"}
    ], ['lightsaber_colour', 'name'])
    uuid_mock.return_value = MOCK_UUID
    assert _run_transforms([], [{
        "tableName": "simpleTable",
        "classification": "json",
        "sampleDataS3Path": "s3://test/json"
    }]) == {
        "initialDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "lightsaber_colour",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        },
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "data": [],
                "s3Path": "s3://test/json",
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/source/simpletable/data.json".format(MOCK_UUID),
                "classification": "json",
                "metadata": None,
            }
        },
        "transformedDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "lightsaber_colour",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        },
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/transformed/simpletable/data.json".format(MOCK_UUID),
                "data": []
            }
        },
        "transformsApplied": []
    }


@patch("awswrangler.s3")
@patch("uuid.uuid4")
@patch("handlers.transform.core._load_sample_data_table")
def test_should_sanitise_column_names(mock_load_sample_data, uuid_mock, s3):
    mock_load_sample_data.return_value = _make_dynamic_frame('simpleTable', [
        {"  Name  ": "Darth Vader", "LightsaberColour": "red"},
        {"  Name  ": "Luke Skywalker", "LightsaberColour": "green"}
    ], ['LightsaberColour', '  Name  '])
    uuid_mock.return_value = MOCK_UUID
    assert _run_transforms([], [{
        "tableName": "simpleTable",
        "classification": "json",
        "sampleDataS3Path": "s3://test/json"
    }]) == {
        "initialDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "lightsabercolour",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        },
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "data": [],
                "s3Path": "s3://test/json",
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/source/simpletable/data.json".format(MOCK_UUID),
                "classification": "json",
                "metadata": None,
            }
        },
        "transformedDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                               {
                                   "name": "lightsabercolour",
                                   "container": {"dataType": "string", "properties": {}},
                                   "properties": {}
                               },
                        {
                                   "name": "name",
                                   "container": {"dataType": "string", "properties": {}},
                                   "properties": {}
                               }
                    ]
                },
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/transformed/simpletable/data.json".format(MOCK_UUID),
                "data": []
            }
        },
        "transformsApplied": []
    }


@patch("awswrangler.s3")
@patch("uuid.uuid4")
@patch("handlers.transform.core._load_sample_data_table")
def test_should_not_load_more_than_10_rows_for_preview(mock_load_sample_data, uuid_mock, s3):
    mock_load_sample_data.return_value = _make_dynamic_frame('simpleTable', [
        {"name": "1"},
        {"name": "2"},
        {"name": "3"},
        {"name": "4"},
        {"name": "5"},
        {"name": "6"},
        {"name": "7"},
        {"name": "8"},
        {"name": "9"},
        {"name": "10"},
        {"name": "11"},
    ], ['name'])
    uuid_mock.return_value = MOCK_UUID
    assert _run_transforms([], [{
        "tableName": "simpleTable",
        "classification": "json",
        "sampleDataS3Path": "s3://test/json"
    }]) == {
        "initialDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "data": [],
                "s3Path": "s3://test/json",
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/source/simpletable/data.json".format(MOCK_UUID),
                "classification": "json",
                "metadata": None,
            }
        },
        "transformedDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/transformed/simpletable/data.json".format(MOCK_UUID),
                "data": []
            }
        },
        "transformsApplied": []
    }


@patch("awswrangler.s3")
@patch("uuid.uuid4")
@patch("handlers.transform.core._load_sample_data_table")
def test_should_apply_multiple_transforms(mock_load_sample_data, uuid_mock, s3):
    # Data is nested json to test relationalize transform is executed correctly
    mock_load_sample_data.return_value = _make_dynamic_frame('simpleTable', [
        {"name": "Darth Vader", "lightsaber": {"colour": "red"}},
        {"name": "Luke Skywalker", "lightsaber": {"colour": "green"}}
    ], ['lightsaber', 'name'])
    uuid_mock.return_value = MOCK_UUID
    # JSON relationalise, then add a prefix to each column name
    assert _run_transforms([{"id": "json_relationalize"}, {"id": "add_prefix_to_column_names"}], [{
        "tableName": "simpleTable",
        "classification": "json",
        "sampleDataS3Path": "s3://test/json"
    }]) == {
        "initialDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "lightsaber",
                            "container": {
                                "dataType": "struct",
                                "fields": [
                                    {
                                        "name": "colour",
                                        "container": {"dataType": "string", "properties": {}},
                                        "properties": {}
                                    }
                                ],
                                "properties": {}
                            },
                            "properties": {}
                        },
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "data": [],
                "s3Path": "s3://test/json",
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/source/simpletable/data.json".format(MOCK_UUID),
                "classification": "json",
                "metadata": None,
            },
        },
        "transformedDataSets": {
            DEFAULT_DATASET_ID: {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "special_prefix_lightsaber.colour",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        },
                        {
                            "name": "special_prefix_name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/transformed/{}/data.json".format(MOCK_UUID, DEFAULT_DATASET_ID),
                "data": []
            }
        },
        "transformsApplied": [
            {"namespace": "test", "scriptId": "json_relationalize"},
            {"namespace": "test", "scriptId": "add_prefix_to_column_names"},
        ]
    }


@patch("awswrangler.s3")
@patch("uuid.uuid4")
@patch("handlers.transform.core._load_sample_data_table")
def test_should_apply_built_in_apply_mapping_transforms(mock_load_sample_data, uuid_mock, s3):
    # Data is nested json to test relationalize transform is executed correctly
    mock_load_sample_data.return_value = _make_dynamic_frame('simpleTable', [
        {"name": "Darth Vader", "age": "30"},
        {"name": "Luke Skywalker",  "age": "20"},
        {"name": "Darth Maul", "age": "40"}
    ], ['name', 'age'])
    uuid_mock.return_value = MOCK_UUID
    # JSON relationalise, then add a prefix to each column name
    assert _run_transforms([{"id": "apply_mapping", "inputArgs": {
                "drop_fields": False,
                "mappings": [
                    {
                    "oldName": "age",
                    "newName": "lifespan",
                    "newType": "integer"
                    }
                ]
            }
    }], [{
        "tableName": "simpleTable",
        "classification": "json",
        "sampleDataS3Path": "s3://test/json",
    }],
    ) == {
        "initialDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        },
                        {
                            "name": "age",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "data": [],
                "s3Path": "s3://test/json",
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/source/simpletable/data.json".format(MOCK_UUID),
                "classification": "json",
                "metadata": None,
            },
        },
        "transformedDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        },
                        {
                            "name": "lifespan",
                            "container": {"dataType": "int", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/transformed/simpletable/data.json".format(MOCK_UUID),
                "data": []
            }
        },
        "transformsApplied": [
            {"namespace": "test", "scriptId": "apply_mapping"}
        ]
    }


@patch("awswrangler.s3")
@patch("uuid.uuid4")
@patch("handlers.transform.core._load_sample_data_table")
def test_should_apply_built_in_drop_fields_transforms(mock_load_sample_data, uuid_mock, s3):
    # Data is nested json to test relationalize transform is executed correctly
    mock_load_sample_data.return_value = _make_dynamic_frame('simpleTable', [
        {"name": "Darth Vader", "age": "30"},
        {"name": "Luke Skywalker",  "age": "20"},
        {"name": "Darth Maul", "age": "40"}
    ], ['name', 'age'])
    uuid_mock.return_value = MOCK_UUID
    # JSON relationalise, then add a prefix to each column name
    assert _run_transforms([{"id": "drop_fields", "inputArgs": {
                "drop_fields": False,
                "paths": ["age"]
            }
    }], [{
        "tableName": "simpleTable",
        "classification": "json",
        "sampleDataS3Path": "s3://test/json",
    }],
    ) == {
        "initialDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        },
                        {
                            "name": "age",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "data": [],
                "s3Path": "s3://test/json",
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/source/simpletable/data.json".format(MOCK_UUID),
                "classification": "json",
                "metadata": None,
            },
        },
        "transformedDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/transformed/simpletable/data.json".format(MOCK_UUID),
                "data": []
            }
        },
        "transformsApplied": [
            {"namespace": "test", "scriptId": "drop_fields"}
        ]
    }


@patch("awswrangler.s3")
@patch("uuid.uuid4")
@patch("handlers.transform.core._load_sample_data_table")
def test_should_apply_built_in_select_fields_transforms(mock_load_sample_data, uuid_mock, s3):
    # Data is nested json to test relationalize transform is executed correctly
    mock_load_sample_data.return_value = _make_dynamic_frame('simpleTable', [
        {"name": "Darth Vader", "age": "30"},
        {"name": "Luke Skywalker",  "age": "20"},
        {"name": "Darth Maul", "age": "40"}
    ], ['name', 'age'])
    uuid_mock.return_value = MOCK_UUID
    # JSON relationalise, then add a prefix to each column name
    assert _run_transforms([{"id": "select_fields", "inputArgs": {
                "select_fields": False,
                "paths": ["name"]
            }
    }], [{
        "tableName": "simpleTable",
        "classification": "json",
        "sampleDataS3Path": "s3://test/json",
    }],
    ) == {
        "initialDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        },
                        {
                            "name": "age",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "data": [],
                "s3Path": "s3://test/json",
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/source/simpletable/data.json".format(MOCK_UUID),
                "classification": "json",
                "metadata": None,
            },
        },
        "transformedDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/transformed/simpletable/data.json".format(MOCK_UUID),
                "data": []
            }
        },
        "transformsApplied": [
            {"namespace": "test", "scriptId": "select_fields"}
        ]
    }

@patch("awswrangler.s3")
@patch("uuid.uuid4")
@patch("handlers.transform.core._load_sample_data_table")
@patch("handlers.transform.core.boto3")
def test_should_permit_transforms_that_result_in_empty_frames(boto3, mock_load_sample_data, uuid_mock, s3):
    mock_load_sample_data.return_value = _make_dynamic_frame('simpleTable', [
        {"name": "Darth Vader", "midi-chlorians": 27000},
        {"name": "Luke Skywalker", "midi-chlorians": 23000},
        {"name": "Yoda", "midi-chlorians": 19000},
    ], ['name', 'midi-chlorians'])
    uuid_mock.return_value = MOCK_UUID

    # Data wrangler throws an exception attempting to write the empty transformed data frame, which we should
    # appropriately handle
    s3.to_json.side_effect = [None, EmptyDataFrame()]

    # Filter to an empty dataframe
    assert _run_transforms([{"id": "less_than_10000_midi_chlorians_static_schema"}], [{
        "tableName": "simpleTable",
        "classification": "json",
        "sampleDataS3Path": "s3://test/json"
    }]) == {
               "initialDataSets": {
                   "simpletable": {
                       "schema": {
                           "dataType": "struct",
                           "properties": {},
                           "fields": [
                               {
                                   "name": "name",
                                   "container": {"dataType": "string", "properties": {}},
                                   "properties": {}
                               },
                               {
                                   "name": "midi-chlorians",
                                   "container": {"dataType": "long", "properties": {}},
                                   "properties": {}
                               }
                           ]
                       },
                       "data": [],
                       "s3Path": "s3://test/json",
                       "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/source/simpletable/data.json".format(MOCK_UUID),
                       "classification": "json",
                       "metadata": None,
                   },
               },
               "transformedDataSets": {
                   "simpletable": {
                       "schema": {
                           "dataType": "struct",
                           "properties": {},
                           "fields": [
                               {
                                   "name": "name",
                                   "container": {"dataType": "string", "properties": {}},
                                   "properties": {}
                               },
                               {
                                   "name": "midi-chlorians",
                                   "container": {"dataType": "long", "properties": {}},
                                   "properties": {}
                               },
                           ]
                       },
                       "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/transformed/simpletable/data.json".format(MOCK_UUID),
                       "data": []
                   }
               },
               "transformsApplied": [
                   {"namespace": "test", "scriptId": "less_than_10000_midi_chlorians_static_schema"},
               ]
           }
    # Put object was called to write the empty dataframe
    assert boto3.client.return_value.put_object.called


@patch("awswrangler.s3")
@patch("uuid.uuid4")
@patch("handlers.transform.core._load_sample_data_table")
@patch("handlers.transform.core.boto3")
def test_should_permit_transforms_that_result_in_empty_schemas(boto3, mock_load_sample_data, uuid_mock, s3):
    mock_load_sample_data.return_value = _make_dynamic_frame('simpleTable', [
        {"name": "Darth Vader", "midi-chlorians": 27000},
        {"name": "Luke Skywalker", "midi-chlorians": 23000},
        {"name": "Yoda", "midi-chlorians": 19000},
    ], ['name', 'midi-chlorians'])
    uuid_mock.return_value = MOCK_UUID

    # Data wrangler throws an exception attempting to write the empty transformed data frame, which we should
    # appropriately handle
    s3.to_json.side_effect = [None, EmptyDataFrame()]

    # Filter to an empty dataframe
    assert _run_transforms([{"id": "less_than_10000_midi_chlorians_dynamic_schema"}], [{
        "tableName": "simpleTable",
        "classification": "json",
        "sampleDataS3Path": "s3://test/json"
    }]) == {
               "initialDataSets": {
                   "simpletable": {
                       "schema": {
                           "dataType": "struct",
                           "properties": {},
                           "fields": [
                               {
                                   "name": "name",
                                   "container": {"dataType": "string", "properties": {}},
                                   "properties": {}
                               },
                               {
                                   "name": "midi-chlorians",
                                   "container": {"dataType": "long", "properties": {}},
                                   "properties": {}
                               }
                           ]
                       },
                       "data": [],
                       "s3Path": "s3://test/json",
                       "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/source/simpletable/data.json".format(MOCK_UUID),
                       "classification": "json",
                       "metadata": None,
                   },
               },
               "transformedDataSets": {
                   "simpletable": {
                       "schema": {
                           "dataType": "struct",
                           "properties": {},
                           # Schema is empty!
                           "fields": [],
                       },
                       "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/transformed/simpletable/data.json".format(MOCK_UUID),
                       "data": []
                   }
               },
               "transformsApplied": [
                   {"namespace": "test", "scriptId": "less_than_10000_midi_chlorians_dynamic_schema"},
               ]
           }
    # Put object was called to write the empty dataframe
    assert boto3.client.return_value.put_object.called


@patch("awswrangler.s3")
@patch("uuid.uuid4")
@patch("handlers.transform.core._load_sample_data_table")
def test_should_parse_json_with_unexpected_values(mock_load_sample_data, uuid_mock, s3):
    mock_load_sample_data.return_value = _make_dynamic_frame('simpleTable', [
        {"name": "Darth Vader", "lightsaber_colour": "red"},
        {"name": "Luke Skywalker", "lightsaber_colour": "green"},
        {"name": "Luke NaN", "lightsaber_colour": math.nan},
        {"name": "Luke Infinite", "lightsaber_colour": math.inf},
        {"name": "Luke Date", "lightsaber_colour": datetime(
            2020, 5, 17, 1, 2, 3, 55)},
    ], ['name', 'lightsaber_colour'])
    uuid_mock.return_value = MOCK_UUID
    assert _run_transforms([], [{
        "tableName": "simpleTable",
        "classification": "json",
        "sampleDataS3Path": "s3://test/json"
    }]) == {
        "initialDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        },
                        {
                            "name": "lightsaber_colour",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "data": [],
                "s3Path": "s3://test/json",
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/source/simpletable/data.json".format(MOCK_UUID),
                "classification": "json",
                "metadata": None,
            }
        },
        "transformedDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        },
                        {
                            "name": "lightsaber_colour",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/transformed/simpletable/data.json".format(MOCK_UUID),
                "data": []
            }
        },
        "transformsApplied": []
    }


@patch("awswrangler.s3")
@patch("uuid.uuid4")
@patch("handlers.transform.core._load_sample_data_table")
def test_should_allow_transforms_with_helper_functions(mock_load_sample_data, uuid_mock, s3):
    mock_load_sample_data.return_value = _make_dynamic_frame('simpleTable', [
        {"name": "Darth Vader", "midi-chlorians": 27000},
        {"name": "Luke Skywalker", "midi-chlorians": 23000},
        {"name": "Yoda", "midi-chlorians": 19000},
    ], ['name', 'midi-chlorians'])
    uuid_mock.return_value = MOCK_UUID
    # Add a prefix to the column names but with the transform script that defines a helper function
    assert _run_transforms([{"id": "add_prefix_to_column_names_with_helper"}], [{
        "tableName": "simpleTable",
        "classification": "json",
        "sampleDataS3Path": "s3://test/json"
    }]) == {
        "initialDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        },
                        {
                            "name": "midi-chlorians",
                            "container": {"dataType": "long", "properties": {}},
                            "properties": {}
                        }
                    ]
                },
                "data": [],
                "s3Path": "s3://test/json",
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/source/simpletable/data.json".format(MOCK_UUID),
                "classification": "json",
                "metadata": None,
            },
        },
        "transformedDataSets": {
            "simpletable": {
                "schema": {
                    "dataType": "struct",
                    "properties": {},
                    "fields": [
                        {
                            "name": "helper_prefix_name",
                            "container": {"dataType": "string", "properties": {}},
                            "properties": {}
                        },
                        {
                            "name": "helper_prefix_midi-chlorians",
                            "container": {"dataType": "long", "properties": {}},
                            "properties": {}
                        },
                    ]
                },
                "s3SamplePath": "s3://test-temp-bucket/my_domain/my_data_product/{}/transformed/simpletable/data.json".format(MOCK_UUID),
                "data": []
            }
        },
        "transformsApplied": [
            {"namespace": "test", "scriptId": "add_prefix_to_column_names_with_helper"},
        ]
    }


@patch("awswrangler.s3")
@patch("uuid.uuid4")
@patch("handlers.transform.core._load_sample_data_table")
def test_should_not_allow_transforms_with_non_sandbox_modules(mock_load_sample_data, uuid_mock, s3):
    mock_load_sample_data.return_value = _make_dynamic_frame('simpleTable', [
        {"name": "Darth Vader", "midi-chlorians": 27000},
        {"name": "Luke Skywalker", "midi-chlorians": 23000},
        {"name": "Yoda", "midi-chlorians": 19000},
    ], ['name', 'midi-chlorians'])
    uuid_mock.return_value = MOCK_UUID
    # The bad import transform should not succeed
    with pytest.raises(Exception):
        _run_transforms([{"id": "bad_import_transform"}], [{
            "tableName": "simpleTable",
            "classification": "json",
            "sampleDataS3Path": "s3://test/json"
        }])


def test_make_dynamic_frame_from_dict_should_preserve_columns():
    schema = _make_dynamic_frame('simpleTable', [
        {"name": "Darth Vader", "lightsaber_colour": "red"},
        {"name": "Luke Skywalker", "lightsaber_colour": "green"}
    ], ['name', 'lightsaber_colour']).schema().jsonValue()
    assert [f['name']
            for f in schema['fields']] == ['name', 'lightsaber_colour']

    schema = _make_dynamic_frame('simpleTable', [
        {"name": "Darth Vader", "lightsaber_colour": "red"},
        {"name": "Luke Skywalker", "lightsaber_colour": "green"}
    ], ['lightsaber_colour', 'name']).schema().jsonValue()
    assert [f['name']
            for f in schema['fields']] == ['lightsaber_colour', 'name']


def test_make_dynamic_frame_from_dict_should_preserve_columns_with_dots():
    schema = _make_dynamic_frame('simpleTable', [
        {"name": "Darth Vader", "lightsaber.colour": "red"},
        {"name": "Luke Skywalker", "lightsaber.colour": "green"}
    ], ['name', 'lightsaber.colour']).schema().jsonValue()
    assert [f['name']
            for f in schema['fields']] == ['name', 'lightsaber.colour']

def _load_snapshot(name):
    with open('{}/{}.snapshot.py'.format(SNAPSHOT_DIR, name), 'r') as f:
        return f.read()

def test_generate_execute_all_transforms_code():
    assert transform.generate_execute_all_transforms_code(transform.load_transform_functions(_load_scripts([
        {
            "id": "json_relationalize"
        },
        {
            "id": "add_prefix_to_column_names"
        },
        {
            "id": "add_prefix_to_column_names_with_helper"
        }
    ]))) == _load_snapshot('execute_all_transforms_code')
