/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as apig from 'aws-cdk-lib/aws-apigateway';
import { IAspect } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

/* eslint-disable sonarjs/cognitive-complexity */

export class PublicOPTIONSMethodAspect implements IAspect {
  public visit(construct: IConstruct): void {
    if (construct instanceof apig.CfnMethod || construct instanceof apig.Method) {
      if (construct instanceof apig.Method) {
        construct = construct.node.defaultChild as apig.CfnMethod;
      }
      if ((construct as apig.CfnMethod).httpMethod === 'OPTIONS') {
        // Remove authorization from OPTIONS methods to enable CORS
        (construct as apig.CfnMethod).authorizationType = apig.AuthorizationType.NONE;
      }
    }
  }
}

/**
 * Throttle all API Gateway control service limit resources (resource,  model, method) to prevent deployment
 * throttling issues when deploying the stack.
 * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html#api-gateway-control-service-limits-table
 */
export class ThrottleApiResourceDeploymentAspect implements IAspect {
  public visit(construct: IConstruct): void { //NOSONAR (S3776:Cognitive Complexity) - planning to move to separate library
    // must apply all dependencies at the CfnResource level, otherwise can create circular dependencies
    if (construct instanceof apig.Resource) {
      const cfnResource = construct.node.defaultChild as apig.CfnResource;

      const childResources = cfnResource.node.children.filter(
        (child) => child instanceof apig.CfnResource,
      ) as apig.CfnResource[];
      if (childResources.length > 1) {
        for (let i = 1; i < childResources.length; i++) {
          childResources[i].node.addDependency(childResources[i - 1]);
        }
      }

      const childModels = construct.node.children
        .filter((child) => child instanceof apig.Model)
        .map((model) => model.node.defaultChild as apig.CfnModel);
      if (childModels.length > 1) {
        for (let i = 1; i < childModels.length; i++) {
          childModels[i].node.addDependency(childModels[i - 1]);
        }
      }

      const childMethods = construct.node.children
        .filter((child) => child instanceof apig.Method)
        .map((model) => model.node.defaultChild as apig.CfnMethod);
      if (childMethods.length > 1) {
        for (let i = 1; i < childMethods.length; i++) {
          childMethods[i].node.addDependency(childMethods[i - 1]);
        }
      }
    }
  }
}
