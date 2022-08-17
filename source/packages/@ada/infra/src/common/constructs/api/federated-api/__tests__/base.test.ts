/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BaseRestApi, IDecoratedResource, RequestResponseProps } from '../base';
import { Method, MethodOptions, MockIntegration, Resource } from 'aws-cdk-lib/aws-apigateway';
import { Stack } from 'aws-cdk-lib';

describe('api/federated-api/base', () => {
  let stack: Stack;
  let api: BaseRestApi;
  beforeEach(() => {
    stack = new Stack();
    api = new BaseRestApi(stack, 'Mock', {
      customAuthorizer: jest.fn() as any,
      accessLogsBucket: jest.fn() as any,
    });
    jest.resetAllMocks();
  });

  it('should create BaseRestApi instance', () => {
    expect(api).toBeInstanceOf(BaseRestApi);
  });

  it('should get decorated root resource', () => {
    expect(api.decoratedRoot.decorated).toBeTruthy();
  });

  it('should add decorated root resource', () => {
    const resource = api.addRootResource('foo');
    expect(resource.decorated).toBeTruthy();
  });

  it('should support adding resources recursively', () => {
    const resource = api.decoratedRoot.addResource('/foo/bar/baz');
    expect(api.root.path).toBe('/');
    expect(resource.path).toBe('/foo/bar/baz');
    expect(resource.parentResource.path).toBe('/foo/bar');
    expect(resource.parentResource.parentResource.path).toBe('/foo');
    expect(resource.parentResource.node.children.includes(resource));
  });

  it('should trim slashes in paths when adding resources', () => {
    const resource = api.decoratedRoot.addResource('/foo/');
    expect(resource.path).toBe('/foo');
  });

  describe('IDecoratedResource', () => {
    let resource: IDecoratedResource;
    beforeEach(() => {
      resource = api.addRootResource('foo');
    });

    it('should be "instanceof" default Resource class', () => {
      expect(resource).toBeInstanceOf(Resource);
    });

    it('should wrap `parentResource` getter to return decorated resource', () => {
      expect(resource.parentResource.decorated).toBeTruthy();
    });

    it('should wrap `addResource` method to return decorated resource', () => {
      expect(resource.addResource('bar').decorated).toBeTruthy();
    });

    it.skip('should wrap `addMethod` method to return decorated resource', () => {
      const options: RequestResponseProps = {};
      const methodOptions: MethodOptions = {};
      const spy = jest.spyOn(api, 'requestResponse' as any).mockImplementation(() => methodOptions);
      const method = resource.addMethod('GET', new MockIntegration(), options);
      expect(method).toBeInstanceOf(Method);
      expect(spy).toBeCalledWith(options);
    });

    // TODO: add "addRoutes" tests

    // TODO: add request / response handling testing
  });
});
