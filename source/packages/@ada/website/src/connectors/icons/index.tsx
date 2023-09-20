/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Box, Text } from 'aws-northstar';
import { Connectors } from '@ada/connectors';
import DefaultIcon from '@material-ui/icons/BrokenImage';

/*
NB: co-locate connector icons into the connector folder/bundle. Currently with connectors
defined in @ada/infra and svg/react support wired in @ada/website these will remain here
until proper connector framework is created.
*/

import { ReactComponent as CLOUDTRAIL } from './icon_cloudtrail.svg';
import { ReactComponent as CLOUDWATCH } from './icon_cloudwatch.svg';
import { ReactComponent as DYNAMODB } from './icon_dynamodb.svg';
import { ReactComponent as GOOGLE_ANALYTICS } from '../../vendor/google/ga.svg';
import { ReactComponent as GOOGLE_BIGQUERY } from '../../vendor/google/bigquery.svg';
import { ReactComponent as GOOGLE_STORAGE } from '../../vendor/google/cloud_storage.svg';
import { ReactComponent as KINESIS } from './icon_kinesis.svg';
import { ReactComponent as MONGODB } from '../../vendor/mongodb.svg';
import { ReactComponent as MYSQL5 } from '../../vendor/mysql.svg';
import { ReactComponent as ORACLE } from '../../vendor/oracle.svg';
import { ReactComponent as POSTGRESQL } from '../../vendor/postgres.svg';
import { ReactComponent as REDSHIFT } from './icon_redshift.svg';
import { ReactComponent as S3 } from './icon_s3.svg';
import { ReactComponent as SQLSERVER } from '../../vendor/sqlserver.svg';

import CloudUpload from '@material-ui/icons/CloudUpload';

// react-scripts/lib/react-app.d.ts
type IconComponent = React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;
const UPLOAD = CloudUpload as IconComponent;

export const ConnectorIcons: Record<Connectors.ID, IconComponent> = {
  UPLOAD,
  S3,
  KINESIS,
  GOOGLE_ANALYTICS,
  GOOGLE_BIGQUERY,
  GOOGLE_STORAGE,
  DYNAMODB,
  REDSHIFT,
  CLOUDWATCH,
  MYSQL5,
  POSTGRESQL,
  SQLSERVER,
  ORACLE,
  CLOUDTRAIL,
  MONGODB,
};

export interface SourceTypeIconProps {
  readonly sourceType: Connectors.ID;
}

const DEFAULT_SIZE = 40;

export const SourceTypeIcon: React.FC<
  React.SVGProps<SVGSVGElement> & { sourceType: Connectors.ID; title?: string }
> = ({ sourceType, width = DEFAULT_SIZE, height = DEFAULT_SIZE, ...props }) => {
  const connector = Connectors.find(sourceType);
  const Icon = ConnectorIcons[connector.ID] || DefaultIcon;

  return <Icon width={width} height={height} {...props} />;
};

export const SourceTypeBadge: React.FC<SourceTypeIconProps> = ({ sourceType }) => {
  const { METADATA } = Connectors.find(sourceType);
  const { label } = METADATA;

  return (
    <Box display="flex" alignItems="center" flexWrap="nowrap" whiteSpace="pre">
      <SourceTypeIcon sourceType={sourceType} width={24} height={24} alignmentBaseline="baseline" />
      <Text>{' ' + label}</Text>
    </Box>
  );
};
