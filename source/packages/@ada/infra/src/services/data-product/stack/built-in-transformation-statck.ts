/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fs from 'fs';
import { BuiltInTransforms } from '@ada/transforms';
import { Construct } from 'constructs';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { NestedStack } from 'aws-cdk-lib';
import { ReservedDomains, getNestedStackDescription, solutionInfo } from '@ada/common';
import { startCase } from 'lodash';
import InvokeMicroserviceLambda from '../../../common/constructs/api/invoke-microservice-lambda';

export interface BuiltInTransformationStackProps {
  readonly putScriptLambda: IFunction;
}

/**
 * Nested stack for built-in transformations
 */
export class BuiltInTransformationStack extends NestedStack {
  constructor(scope: Construct, id: string, props: BuiltInTransformationStackProps) {
    super(scope, id);
    this.templateOptions.description = getNestedStackDescription(solutionInfo(), id);

    InvokeMicroserviceLambda.makeSequential(Object.values(BuiltInTransforms).map((transform) => {
      const { id: scriptId, ...body } = transform;

      return new InvokeMicroserviceLambda(this, `Put${startCase(scriptId)}Script`, {
        //NOSONAR (typescript:S1848) - cdk construct is used
        lambda: props.putScriptLambda,
        pathParameters: { scriptId, namespace: ReservedDomains.GLOBAL },
        body: {
          ...body,
          source: fs.readFileSync(body.source, 'utf-8'),
        },
      });
    }));
  }
}

export default BuiltInTransformationStack;
