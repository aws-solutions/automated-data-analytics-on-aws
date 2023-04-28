###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import json
from unittest.mock import patch
import pandas as pd
from mongomock import MongoClient
import datetime

from handlers.common import *  # NOSONAR
from handlers.sampling import *  # NOSONAR
from handlers.__tests__.sampling_helpers import SamplingTestHelpers


@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_mongodb(boto_client, s3, mocker):

    client = MongoClient()
    db = client["ada-test-db"]
    db.create_collection("testcollection")
    db.testcollection.insert_many(
        [
            {
                "fruit": "apple",
                "colour": "red",
                "eaten": datetime(2022, 1, 1),
                "order": 3,
                "size": 10.01,
            },
            {
                "fruit": "orange",
                "colour": "orange",
                "eaten": datetime(2022, 2, 1),
                "order": 2,
                "size": 12.01,
            },
            {
                "fruit": "pear",
                "colour": "green",
                "eaten": datetime(2022, 3, 1),
                "order": 1,
                "size": 13.01,
            },
        ]
    )

    mocker.patch(
        "pymongo.collection.Collection.find",
        return_value=client["ada-test-db"]["testcollection"].find({}),
    )

    source_details = {
        "databaseEndpoint": "localhost",
        "databasePort": "27017",
        "databaseName": "ada-test-db",
        "collectionName": "testcollection",
        "username": "username",
        "password": "password",
        "tls": "false",
    }

    boto_client.side_effect = [
        {"Plaintext": json.dumps(source_details).encode("utf-8")},
        {
            "Credentials": {
                "AccessKeyId": "TestAccessKeyId",
                "SecretAccessKey": "TestSecretAccessKey",
                "SessionToken": "TestSessionToken",
            }
        },
    ]

    table_details = SamplingTestHelpers.pull_data_sample("MONGODB", source_details)[
        "tableDetails"
    ]

    assert len(table_details) == 1
    assert s3.to_parquet.called
