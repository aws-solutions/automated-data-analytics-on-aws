/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CfnCrawler } from 'aws-cdk-lib/aws-glue';
import { Construct } from 'constructs';
import { ExternalFacingRole } from '../../../../../common/constructs/iam/external-facing-role';
import { IDatabase } from '@aws-cdk/aws-glue-alpha';
import { S3Location } from '@ada/api';

export interface CrawlerProps {
  readonly tablePrefix: string;
  readonly s3Target: S3Location;
  readonly targetGlueDatabase: IDatabase;
  readonly glueSecurityConfigurationName: string;
  readonly sourceAccessRole: ExternalFacingRole;
}

/**
 * Construct to create a glue crawler
 */
export default class Crawler extends Construct {
  public readonly crawler: CfnCrawler;
  public readonly tablePrefix: string;

  constructor(
    scope: Construct,
    id: string,
    { tablePrefix, s3Target, targetGlueDatabase, glueSecurityConfigurationName, sourceAccessRole }: CrawlerProps,
  ) {
    super(scope, id);

    this.tablePrefix = tablePrefix;

    this.crawler = new CfnCrawler(this, 'Crawler', {
      name: `${tablePrefix}-crawler`,
      targets: {
        s3Targets: [
          {
            path: `${s3Target.bucket}/${s3Target.key}`,
          },
        ],
      },
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
