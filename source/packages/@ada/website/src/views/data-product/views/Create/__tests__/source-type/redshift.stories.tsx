/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as Connectors from '@ada/connectors';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CreateDataProductView } from '../../index';
import { DELAY } from '$testing/interaction';
import { DataProductUpdateTriggerType } from '@ada/common';
import {
  assertReview,
  assertSubmit,
  clickNext,
  gotoSourceTypeDetails,
  selectUpdateTriggerType,
  useSourceTypeTestApiMocks,
} from '../helpers';
import { userEvent, within } from '@storybook/testing-library';
import assert from 'assert';

const SOURCE_DETAILS: Connectors.AmazonRedshift.ISourceDetails = {
  "databaseEndpoint": "default.123456789012.us-east-1.redshift-serverless.amazonaws.com",
  "databasePort": "5339",
  "databaseName": "dev",
  "databaseTable": "testTable",
  "databaseType": "Serverless",
  "workgroup": "default",
  "databaseUsername": "",
  "clusterIdentifier": "",
  "crossAccountRoleArn": 'arn:aws:iam::111111111111:role/xacctrole',
};

const CLUSTER_SOURCE_DETAILS: Connectors.AmazonRedshift.ISourceDetails = {
  ...SOURCE_DETAILS,
  "databaseEndpoint": "test-redshift-cluster.c9reiliclukz.us-east-1.redshift.amazonaws.com",
  "databaseType": "Cluster",
  "workgroup": "",
  "databaseUsername": "awsuser",
  "clusterIdentifier": "test-redshift-cluster",
  "crossAccountRoleArn": 'arn:aws:iam::111111111111:role/xacctrole',
};

export default {
  title: `Views/DataProduct/Create/${Connectors.AmazonRedshift.ID}`,
  component: CreateDataProductView,
} as ComponentMeta<typeof CreateDataProductView>;

const Template: ComponentStory<typeof CreateDataProductView> = (args) => {
  useSourceTypeTestApiMocks();

  return <CreateDataProductView {...args} />;
};

export const Primary = Template.bind({});

Primary.play = async ({ canvasElement }) => {
  const { getByLabelText } = within(canvasElement);

  await inputBaseConfig(canvasElement, SOURCE_DETAILS.databaseEndpoint);
  
  await userEvent.type(getByLabelText('Redshift Serverless Workgroup'), SOURCE_DETAILS.workgroup, { delay: DELAY.TYPING });

  await clickNext(canvasElement);

  await assertReview(canvasElement, Connectors.AmazonRedshift.ID, SOURCE_DETAILS as any);

  await assertSubmit(canvasElement, {
    sourceType: Connectors.AmazonRedshift.ID,
    sourceDetails: SOURCE_DETAILS,
  });
};

export const RedshiftCluster = Template.bind({});

RedshiftCluster.play = async ({ canvasElement }) => {
  const { getByLabelText } = within(canvasElement);

  await inputBaseConfig(canvasElement, CLUSTER_SOURCE_DETAILS.databaseEndpoint);

  await userEvent.click(getByLabelText('Is the database Amazon Redshift Serverless?'));
  await userEvent.type(getByLabelText('Redshift Cluster Username'), CLUSTER_SOURCE_DETAILS.databaseUsername, { delay: DELAY.TYPING });
  await userEvent.type(getByLabelText('Redshift Cluster Identifier'), CLUSTER_SOURCE_DETAILS.clusterIdentifier, { delay: DELAY.TYPING });

  await clickNext(canvasElement);

  await assertReview(canvasElement, Connectors.AmazonRedshift.ID, SOURCE_DETAILS as any);

  await assertSubmit(canvasElement, {
    sourceType: Connectors.AmazonRedshift.ID,
    sourceDetails: CLUSTER_SOURCE_DETAILS,
  });
}

export const InputError = Template.bind({});

InputError.play = async ({ canvasElement }) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.AmazonRedshift.ID);

  const { getByLabelText, queryByText, queryAllByText } = within(canvasElement);

  await userEvent.type(getByLabelText('Redshift Endpoint'), 'bad-redshift-endpoint', { delay: DELAY.TYPING });
  assert(queryByText('Must be a valid Redshift endpiont'), 'Should show Redshift endpoint error message');

  await userEvent.type(getByLabelText('Database Port'), '100000', { delay: DELAY.TYPING });

  assert(queryByText('Must be 0 to 65535'), 'Should show Redshift database port message');

  assert(queryAllByText('Required').length === 3);
};

const inputBaseConfig = async (canvasElement: HTMLElement, endpointContent: string) => {
  await gotoSourceTypeDetails(canvasElement, Connectors.AmazonRedshift.ID);

  const { getByLabelText } = within(canvasElement);

  await userEvent.type(getByLabelText('Redshift Endpoint'), endpointContent, { delay: DELAY.TYPING });

  await userEvent.type(getByLabelText('Database Port'), SOURCE_DETAILS.databasePort, { delay: DELAY.TYPING });

  await userEvent.type(getByLabelText('Database Name'), SOURCE_DETAILS.databaseName, { delay: DELAY.TYPING });

  await userEvent.type(getByLabelText('Database Table'), SOURCE_DETAILS.databaseTable, { delay: DELAY.TYPING });

  await userEvent.type(getByLabelText('Redshift Cross Account Access IAM Role ARN'), SOURCE_DETAILS.crossAccountRoleArn!, {
    delay: DELAY.TYPING,
  });

  await selectUpdateTriggerType(canvasElement, DataProductUpdateTriggerType.ON_DEMAND);
}
