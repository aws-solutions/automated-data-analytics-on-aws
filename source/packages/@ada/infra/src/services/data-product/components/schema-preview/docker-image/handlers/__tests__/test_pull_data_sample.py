###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import pytest
import pandas as pd
import time
from unittest.mock import patch, MagicMock
from datetime import datetime

from handlers.common import * # NOSONAR
from handlers.sampling import * # NOSONAR

@pytest.mark.parametrize("calling_user", [{"userId": "auth0_auth0|61dcd9cdc4b05c0069a392de"}])
@patch('time.time')
def test_assume_pull_data_sample_role(mock_time, calling_user):
    mock_time.return_value = time.mktime(datetime(2021, 1, 1).timetuple())
    user_id = SamplingUtils.get_hashed_and_sanitized_user_id(calling_user)
    assert user_id.get('hashed') == "3615978473146a9a3c6f21949d739f2a6ccb1d7a4f31ac0919fdac2b4560b8c2"
    assert user_id.get('sanitized') == "auth0_auth061dcd9cdc4b05c0069a392de"
    assert len(user_id.get('hashed')) == 64

def test_from_s3_path():
    assert SamplingUtils.from_s3_path('s3://bucket/key') == {
        'bucket': 'bucket',
        'key': 'key',
    }
    assert SamplingUtils.from_s3_path('s3://bucket/multi/level/key/') == {
        'bucket': 'bucket',
        'key': 'multi/level/key/',
    }

def test_from_s3_path_fails_with_invalid_path():
    with pytest.raises(InternalError):
        SamplingUtils.from_s3_path('invalid path')


@patch("awswrangler.s3")
def test_get_csv_metadata_commas(s3):
    s3.list_objects.return_value = ['s3://bucket/key.csv']
    boto_session = MagicMock()
    s3_get_object_body = MagicMock()
    s3_get_object_body.read.return_value = b'"name","order","lightsaber_colour"\n"luke","jedi","green"\n"darth vader","sith","red"\n'
    boto_session.client.return_value.get_object.return_value = {
        'Body': s3_get_object_body
    }
    metadata = SamplingUtils.get_csv_metadata(boto_session, 's3://bucket/')
    assert metadata['delimiter'] == ','
    assert metadata['quotechar'] == '"'


@patch("awswrangler.s3")
def test_get_csv_metadata_tabs(s3):
    s3.list_objects.return_value = ['s3://bucket/key.csv']
    boto_session = MagicMock()
    s3_get_object_body = MagicMock()
    s3_get_object_body.read.return_value = b"'name'\t'order'\t'lightsaber_colour'\n'luke'\t'jedi'\t'green'\n'darth vader'\t'sith'\t'red'\n"
    boto_session.client.return_value.get_object.return_value = {
        'Body': s3_get_object_body
    }
    metadata = SamplingUtils.get_csv_metadata(boto_session, 's3://bucket/')
    assert metadata['delimiter'] == '\t'
    assert metadata['quotechar'] == "'"

def test_pd_read_json_dtypes():
    df1 = pd.read_json('{"col1":"1.0", "col2":1.0, "col3": 1}', lines=True, orient='records')
    assert df1["col1"].dtypes == int
    assert df1["col2"].dtypes == int
    assert df1["col3"].dtypes == int

    df2 = pd.read_json('{"col1":"1.0", "col2":1.0, "col3": 1}', lines=True, dtype=False, orient='records')
    assert df2["col1"].dtypes == object # object = str/mixed
    assert type(df2["col1"][0]) == str
    assert df2["col2"].dtypes == float
    assert df2["col3"].dtypes == int
