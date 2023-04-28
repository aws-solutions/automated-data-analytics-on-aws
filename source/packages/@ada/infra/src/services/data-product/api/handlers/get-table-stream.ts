/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DynamoDB } from '@ada/aws-sdk';

import { Arn, ArnFormat } from 'aws-cdk-lib';

const TABLE_ARN_PATTERN = /^arn:aws:dynamodb:([a-z])+-([a-z])+-\d:\d+:table\/([A-Za-z0-9-]+)$/;
/**
 * Handler for retrieving dynamodb table stream details
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'getDataProductDynamoDBTableStream',
  async ({ requestParameters }, _x, apiGatewayEvent) => {
    if (!requestParameters.tableArn) {
      return ApiResponse.badRequest({
        message: 'Missing required parameters, tableArn is required',
      });
    }

    const tableArn = decodeURIComponent(requestParameters.tableArn);

    if (!tableArn.match(TABLE_ARN_PATTERN)) {
      return ApiResponse.badRequest({
        message: `Table Arn not in correct format. ${tableArn} : : ${requestParameters.tableArn}`,
      });
    }

    const { region, resourceName, account } = Arn.split(tableArn, ArnFormat.SLASH_RESOURCE_NAME);
    const hostAccount = apiGatewayEvent.requestContext.accountId;

    if (account !== hostAccount) {
      return ApiResponse.success(<
        {
          crossAccount: boolean;
          tableStreamArn?: string;
          StreamSpecification?: { StreamEnabled: boolean; StreamViewType: string };
        }
      >{
        crossAccount: true,
      });
    }

    if (!resourceName || !region) {
      return ApiResponse.badRequest({
        message: 'Table Arn missing details.',
      });
    }

    const dynamodb = new DynamoDB({ region: region });
    const result = await dynamodb.describeTable({ TableName: resourceName }).promise();

    return ApiResponse.success(<
      {
        crossAccount: boolean;
        tableStreamArn?: string;
        StreamSpecification?: { StreamEnabled: boolean; StreamViewType: string };
      }
    >{
      crossAccount: false,
      tableStreamArn: result?.Table?.LatestStreamArn,
      streamEnabled: result?.Table?.StreamSpecification?.StreamEnabled,
      streamViewType: result?.Table?.StreamSpecification?.StreamViewType,
    });
  },
);
