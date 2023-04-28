/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FederatedRestApi } from '../index';
import { MockIntegration } from 'aws-cdk-lib/aws-apigateway';
import { NestedStack, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

describe('api/federated-api', () => {
  it('should create FederatedRestApi instance', () => {
    const stack = new Stack();
    const api = new FederatedRestApi(stack, 'MOCK-FederatedRestApi', {
      customAuthorizer: jest.fn() as any,
      accessLogsBucket: jest.fn() as any,
    });
    expect(api).toBeInstanceOf(FederatedRestApi);
  });

  describe('microservices', () => {
    it.skip('should not create circular dependencies between microservices', () => {
      const stack = new Stack();
      const api = new FederatedRestApi(stack, 'MOCK-FederatedRestApi', {
        customAuthorizer: jest.fn() as any,
        accessLogsBucket: jest.fn() as any,
      });

      const serviceA = api.addMicroservice(new NestedStack(stack, 'Service-A'), 'Service-A', 'service-a');
      serviceA.addMethod('GET', new MockIntegration());
      const serviceB = api.addMicroservice(new NestedStack(stack, 'Service-B'), 'Service-B', 'service-b');
      serviceB.addMethod('GET', new MockIntegration());

      // console.log(api.node.children.map(child => child.node.id))
      const deployment = api.node.findChild('Deployment');
      for (const dep of deployment.node.dependencies) {
        expect(dep.node.id).not.toBe(serviceA.node.id);
        expect(dep.node.id).not.toBe(serviceB.node.id);
      }
    });

    it('should throw error if microservices are created in same stack', () => {
      const stack = new Stack();
      const api = new FederatedRestApi(stack, 'MOCK-FederatedRestApi', {
        customAuthorizer: jest.fn() as any,
        accessLogsBucket: jest.fn() as any,
      });

      expect(() => {
        api.addMicroservice(stack, 'Service-A', 'service-a');
      }).toThrow('Microservice "Service-A" must be in separate nested stack than RestApi stack');
    });
  });

  describe('aspects', () => {
    const stack = new Stack();
    const api = new FederatedRestApi(stack, 'MOCK-FederatedRestApi', {
      accessLogsBucket: jest.fn() as any,
      customAuthorizer: jest.fn() as any,
    });
    const integration = new MockIntegration();

    api.decoratedRoot.addRoutes({
      GET: { integration },
      POST: { integration },
      PUT: { integration },
      DELETE: { integration },
      paths: {
        '/foo': { GET: { integration }, POST: { integration }, PUT: { integration } },
        '/bar': { GET: { integration }, POST: { integration }, PUT: { integration } },
        '/baz': { GET: { integration }, POST: { integration }, PUT: { integration } },
      },
    });

    const serviceA = api.addMicroservice(new NestedStack(stack, 'Service-A'), 'Service-A', 'service-a');
    serviceA.addRoutes({
      GET: { integration },
      POST: { integration },
      PUT: { integration },
      DELETE: { integration },
      paths: {
        '/sfoo': { GET: { integration }, POST: { integration }, PUT: { integration } },
        '/sbar': { GET: { integration }, POST: { integration }, PUT: { integration } },
        '/sbaz': { GET: { integration }, POST: { integration }, PUT: { integration } },
      },
    });

    describe('OPTIONS', () => {
      it('should force all OPTIONS to AuthenticationType NONE but not other methods', () => {
        const template = Template.fromStack(stack);
        template.hasResourceProperties('AWS::ApiGateway::Method', { HttpMethod: 'OPTIONS', AuthorizationType: 'NONE' });

        /* eslint-disable max-len */
        // other methods are not NONE
        template.hasResourceProperties('AWS::ApiGateway::Method', { HttpMethod: 'GET', AuthorizationType: 'CUSTOM' });
        template.hasResourceProperties('AWS::ApiGateway::Method', { HttpMethod: 'POST', AuthorizationType: 'CUSTOM' });
        template.hasResourceProperties('AWS::ApiGateway::Method', { HttpMethod: 'PUT', AuthorizationType: 'CUSTOM' });
        template.hasResourceProperties('AWS::ApiGateway::Method', {
          HttpMethod: 'DELETE',
          AuthorizationType: 'CUSTOM',
        });
        /* eslint-enable max-len */
      });
    });

    describe('throttling', () => {
      const template = Template.fromStack(stack);

      it('should add dependency on previous sibling for all api methods', () => {
        expect(template.toJSON()).toHaveProperty(
          'Resources.MOCKFederatedRestApibazPUTE54AA445.DependsOn.0',
          'MOCKFederatedRestApibazGETF8C0C4EE',
        );
      });
    });
  });
});
