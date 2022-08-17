/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/* eslint-disable */
import { OpenAPIV3_1 as OpenAPIV31 } from 'openapi-types';

type T = {};
type P = {};

export type HttpMethods = OpenAPIV31.HttpMethods;

export type Document = OpenAPIV31.Document<T> & Required<Pick<OpenAPIV31.Document<T>, 'paths' | 'components'>>;
export type PathsObject = OpenAPIV31.PathsObject<T, P>;
export type PathItemObject = OpenAPIV31.PathItemObject<T> & P;
export type ParameterObject = OpenAPIV31.ParameterObject;
export type OperationObject = OpenAPIV31.OperationObject<T>;
export type MediaTypeObject = OpenAPIV31.MediaTypeObject;
export type ResponseObject = OpenAPIV31.ResponseObject;
export type ResponseObjectContent = Required<ResponseObject>['content'];
export type ResponsesObject = OpenAPIV31.ResponsesObject;
export type RequestBodyObject = OpenAPIV31.RequestBodyObject;
export type RequestBodyObjectContent = Required<RequestBodyObject>['content'];
export type ComponentsObject = OpenAPIV31.ComponentsObject & Required<Pick<OpenAPIV31.ComponentsObject, 'schemas'>>;
export type Schemas = ComponentsObject['schemas'];
export type SchemaObject = OpenAPIV31.SchemaObject;
export type ReferenceObject = OpenAPIV31.ReferenceObject;
export type SchemaValue = ReferenceObject | SchemaObject | undefined;
export type ArraySchemaObject = OpenAPIV31.ArraySchemaObject;
export type ArraySchemaObjectItems = ArraySchemaObject['items'];
export type SchemaObjectType = SchemaObject['type'];
export type SchemaObjectProperties = SchemaObject['properties'];
