###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import os
import uuid
import boto3
import awswrangler as wr
from datetime import datetime
from dateutil import parser
import pandas as pd

# These are the Required Environment Variables input into the State
# Machine. Values are input into the CloudWatchImportDataStateMachine
# class as taskEnv object

QUERY = os.environ.get("QUERY")
CW_LOG_GROUP_NAME = os.environ.get("CW_LOG_GROUP_NAME")
S3_OUTPUT_BUCKET_URI = os.environ.get("S3_OUTPUT_BUCKET_URI")
TRIGGER_TYPE = os.environ.get("TRIGGER_TYPE")
SCHEDULE_RATE = os.environ.get("SCHEDULE_RATE")
SINCE = os.environ.get("SINCE")
UNTIL = os.environ.get("UNTIL")
TABLE_NAME = os.environ.get("TABLE_NAME")
DOMAIN_ID = os.environ.get("DOMAIN_ID")
DATA_PRODUCT_ID = os.environ.get("DATA_PRODUCT_ID")
CROSS_ACCOUNT_ACCESS_ROLE = os.environ.get("CROSS_ACCOUNT_ACCESS_ROLE")


class DateRangeException(Exception):
    pass


class MissingParameterException(Exception):
    pass


class CloudWatchImport:
    def __init__(
        self,
        cw_log_name: str,
        query: str,
        since: str,
        until: str,
        s3_output_uri: str,
        table_name: str,
        data_product_id: str,
        domain_id: str,
        trigger_type: str,
        cross_account_access_role: str,
    ) -> None:

        if cw_log_name is None or cw_log_name == "":
            raise MissingParameterException("CloudWatch ARN is missing")
        if query is None or query == "":
            raise MissingParameterException("CloudWatch log Query is missing")
        if s3_output_uri is None or s3_output_uri == "":
            raise MissingParameterException("S3 Bucket URI is missing")
        if table_name is None or table_name == "":
            raise MissingParameterException("Last Updated Detail Table Name is missing")
        if data_product_id is None or data_product_id == "":
            raise MissingParameterException("Data Product ID is missing")
        if domain_id is None or domain_id == "":
            raise MissingParameterException("Domain Id is missing")
        if trigger_type is None or trigger_type == "":
            raise MissingParameterException("Trigger Type is missing")

        try:
            self._since = parser.parse(since)
        except (TypeError, parser.ParserError) as _:
            raise DateRangeException("Since date must be provided")

        try:
            self._until = parser.parse(until)
            self._range_filename = "cloudwatch_range_dataset.parquet"
        except (TypeError, parser.ParserError) as _:
            self._until = None
            self._range_filename = f"{str(uuid.uuid4())}.parquet"

        if cross_account_access_role != "" and cross_account_access_role is not None:
            self._sts_client = boto3.client("sts")
            self._cross_account_access_role = cross_account_access_role
        else:
            self._sts_client = None

        self._cw_log_name = cw_log_name
        self._query = query
        self._s3_output_uri = s3_output_uri
        self._ddb_client = boto3.client("dynamodb")
        self._table_name = table_name
        self._data_product_id = data_product_id
        self._domain_id = domain_id
        self._trigger_type = trigger_type
        self._num_rows_returned = 0

    def execute(self):
        if self._trigger_type == "ON_DEMAND" and self._until is not None:
            # if both since and until are set
            if self._since > self._until:
                raise DateRangeException("Start date cannot be greater than end date")

            wr.s3.delete_objects(f"{self._s3_output_uri}/{self._range_filename}")
            self._import_data(self._since, self._until)
        else:
            # for ON_DEMAND without a specified end date and SCHEDULE
            last_ts = self._get_last_updated_timestamp()
            if last_ts is None:
                self._import_data(self._since, datetime.now())
            else:
                try:
                    self._import_data(parser.parse(last_ts), datetime.now())
                except (TypeError, parser.ParserError) as _:
                    raise DateRangeException("Last Updated Timestamp error")

    def _import_data(self, since, until) -> None:
        self._get_and_write_logs(since, until)
        self._update_last_updated_timestamp(until.strftime("%m/%d/%Y, %H:%M"))

    def _get_and_write_logs(self, since, until) -> None:
        logs_df = self._get_logs(since, until)
        self._num_rows_returned = logs_df.shape[0]

        if self._num_rows_returned == 0:
            print("No data to update")
        else:
            print("Writing cloudwatch logs to s3")
            self._write_logs(logs_df)

    def _get_logs(self, since: datetime, until: datetime) -> pd.DataFrame:
        print(f"Conducting data import of {since} -> {until}")

        if self._sts_client is not None:
            print("Reading Cloudwatch logs from cross account")
            df = wr.cloudwatch.read_logs(
                log_group_names=[self._cw_log_name],
                query=self._query,
                start_time=since,
                end_time=until,
                boto3_session=self._assume_pull_data_sample_role_session(
                    self._cross_account_access_role
                ),
            )
        else:
            df = wr.cloudwatch.read_logs(
                log_group_names=[self._cw_log_name],
                query=self._query,
                start_time=since,
                end_time=until,
            )
        # remove nonmeaningful ptr column returned
        df = df.drop(["ptr"], axis=1, errors="ignore")
        return df

    def _write_logs(self, logs: pd.DataFrame) -> None:
        print(f"{self._s3_output_uri}/{self._range_filename}")
        result = wr.s3.to_parquet(
            df=logs,
            path=f"{self._s3_output_uri}/{self._range_filename}",
        )
        print(result)

    def _get_last_updated_timestamp(self) -> str or None:
        print("Retrieving last updated timestamp")
        response = self._ddb_client.get_item(
            TableName=self._table_name,
            Key={
                "dataProductId": {"S": self._data_product_id},
                "domainId": {"S": self._domain_id},
            },
        )
        if "Item" in response:
            print("Last update timestamp exists")
            return response["Item"]["timestamp"]["S"]
        else:
            print("Last update timestamp does not exists")
            return None

    def _update_last_updated_timestamp(self, timestamp) -> None:
        print(f"Updating last update timestamp with: {timestamp}")
        self._ddb_client.put_item(
            TableName=self._table_name,
            Item={
                "dataProductId": {"S": self._data_product_id},
                "domainId": {"S": self._domain_id},
                "timestamp": {"S": timestamp},
                "num_rows": {"S": str(self._num_rows_returned)},
            },
        )

    def _assume_pull_data_sample_role_session(self, role_arn: str):
        assumed_role = self._sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName="ada-cloudwatch-import",
            Tags=[{"Key": "ada:service", "Value": "data-product"}],
        )
        credentials = assumed_role["Credentials"]
        return boto3.session.Session(
            aws_access_key_id=credentials["AccessKeyId"],
            aws_secret_access_key=credentials["SecretAccessKey"],
            aws_session_token=credentials["SessionToken"],
        )


if __name__ == "__main__":
    cwi = CloudWatchImport(
        CW_LOG_GROUP_NAME,
        QUERY,
        SINCE,
        UNTIL,
        S3_OUTPUT_BUCKET_URI,
        TABLE_NAME,
        DATA_PRODUCT_ID,
        DOMAIN_ID,
        TRIGGER_TYPE,
        CROSS_ACCOUNT_ACCESS_ROLE,
    )

    print("Executing CloudWatchImport")
    cwi.execute()
