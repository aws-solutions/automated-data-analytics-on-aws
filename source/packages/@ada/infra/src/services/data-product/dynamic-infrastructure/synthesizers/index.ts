/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/api-client-lambda';
import { App, Stack, Tags } from 'aws-cdk-lib';
import { CallingUser } from '@ada/common';
import { Connectors } from '@ada/connectors';
import { DataProduct } from '@ada/api';
import { StaticInfra } from '@ada/infra-common/services';
import { applyApplicationTags } from '@ada/infra-common';

export interface SynthesizeConnectorProps {
  readonly app: App;
  readonly api: ApiClient;
  readonly stackIdentifier: string;
  readonly dataProduct: DataProduct;
  readonly callingUser: CallingUser;
  readonly staticInfrastructure: StaticInfra.IStaticParams;
}

/**
 * Synthesize the appropriate CDK stack for the data product. Other additional data gathering/computation can be done
 * prior to the cdk synth.
 * @param props stack synthesis props
 */
export const synthesizeConnectorStack = async (props: SynthesizeConnectorProps): Promise<Stack> => {
  const StackClass = Connectors.Infra.Dynamic.getStackClass(props.dataProduct.sourceType as Connectors.ID);

  const { app, stackIdentifier, ...stackProps } = props;
  const stack = new StackClass(app, stackIdentifier, stackProps);

  applyApplicationTags(stack);

  // data product tags
  Tags.of(stack).add('DataProductId', props.dataProduct.dataProductId);
  Tags.of(stack).add('DomainId', props.dataProduct.domainId);

  return stack;
};
