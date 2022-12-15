/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CfnCrawler } from 'aws-cdk-lib/aws-glue';
import { Construct } from 'constructs';
import { ExternalFacingRole } from '../../../../../common/constructs/iam/external-facing-role';
import { IDatabase } from '@aws-cdk/aws-glue-alpha';
import { S3Location } from '@ada/api';

export interface CrawlerProps {
  readonly tablePrefix: string;
  readonly targetDescription: {
    s3Target?: S3Location;
    jdbcTarget?: {
      connectionName: string;
      path: string;
      exclusions: string[];
    };
    dynamoDbTarget?: {
      path: string;
    };
  };
  readonly targetGlueDatabase: IDatabase;
  readonly glueSecurityConfigurationName: string;
  readonly sourceAccessRole: ExternalFacingRole;
}

/**
 * Construct to create a glue crawler
 */
export class Crawler extends Construct {
  public readonly crawler: CfnCrawler;
  public readonly tablePrefix: string;

  constructor(
    scope: Construct,
    id: string,
    {
      tablePrefix,
      targetDescription,
      targetGlueDatabase,
      glueSecurityConfigurationName,
      sourceAccessRole,
    }: CrawlerProps,
  ) {
    super(scope, id);

    this.tablePrefix = tablePrefix;

    const targets: CfnCrawler.TargetsProperty = {
      s3Targets: targetDescription.s3Target
        ? [
            {
              path: `${targetDescription.s3Target.bucket}/${targetDescription.s3Target.key}`,
            },
          ]
        : undefined,
      jdbcTargets: targetDescription.jdbcTarget
        ? [
            {
              connectionName: targetDescription.jdbcTarget.connectionName,
              path: targetDescription.jdbcTarget.path,
            },
          ]
        : undefined,
      dynamoDbTargets: targetDescription.dynamoDbTarget
        ? [
            {
              path: targetDescription.dynamoDbTarget.path,
            },
          ]
        : undefined,
    };

    this.crawler = new CfnCrawler(this, 'Crawler', {
      name: `${tablePrefix}-crawler`,
      targets,
      role: sourceAccessRole.roleArn,
      databaseName: targetGlueDatabase.databaseName,
      schemaChangePolicy: {
        deleteBehavior: 'DEPRECATE_IN_DATABASE',
        updateBehavior: 'UPDATE_IN_DATABASE',
      },
      tablePrefix,
      classifiers: [],
      crawlerSecurityConfiguration: glueSecurityConfigurationName,
    });
  }
}

export default Crawler;
