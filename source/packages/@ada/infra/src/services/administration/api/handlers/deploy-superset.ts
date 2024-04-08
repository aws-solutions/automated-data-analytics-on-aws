/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as AWS from 'aws-sdk';
import { ApiError } from '@ada/api';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { SupersetDeployResponse } from '@ada/api-client';

const codebuild = new AWS.CodeBuild();
/**
 * Handler for starting to deploy Apache Superset
 */
export const handler = ApiLambdaHandler.for(
  'postAdministrationDeploySuperset',
  async (): Promise<ApiResponse<ApiError | SupersetDeployResponse>> => {
    const codeBuildName = process.env.DEPLOYMENT_CODEBUILD_PROJECT_NAME ?? '';
    console.log(`Starting build ${codeBuildName}`);
    try {
      const build = await codebuild
        .startBuild({
          projectName: codeBuildName,
        })
        .promise();
      console.log(`Started build ${codeBuildName}`);
      console.log(build);
      return ApiResponse.success({
        message: `Visualisation solution deployment started. Please monitor progress in CodeBuild Project ${codeBuildName} from the CodeBuild console.`,
      });
    } catch (e) {
      console.log(e);
      return ApiResponse.internalServerError({
        message: `Visualisation solution deployment failed to start. Please check status in CodeBuild Project ${codeBuildName} from the CodeBuild console.`,
      });
    }
  },
);
