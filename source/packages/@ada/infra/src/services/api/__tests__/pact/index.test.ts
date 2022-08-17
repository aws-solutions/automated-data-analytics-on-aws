/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';
import { Pact, PactOptions } from '@pact-foundation/pact';
import { apiGatewayEvent } from '@ada/microservice-test-common';
import { pactWith } from 'jest-pact';

const ROOT_DIR = path.join(__dirname, '../../../../../');
const PACTS_DIR = path.join(ROOT_DIR, 'pacts');
const PACT_LOG = path.join(ROOT_DIR, 'pacts-logs', 'pact.log');

const SERVICE_APP = 'microserviceApp';
const SERVICE_ONE = 'microserviceOne';
const SERVICE_TWO = 'microserviceTwo';

const PACT_CONFIG: Omit<PactOptions, 'provider'> = {
  consumer: SERVICE_APP,
  host: 'localhost',
  log: PACT_LOG,
  dir: PACTS_DIR,
  logLevel: 'warn',
};

describe('api/pact', () => {
  it('PLACEHOLDER UNTIL WE WIRE UP PACT FOR MICROSERVICES', () => {
    expect(true).toBeTruthy();
  });
});

// TODO: add Pact support for unified api

// pactWith(
//   {
//     ...PACT_CONFIG,
//     provider: SERVICE_ONE,
//     port: 5001,
//   },
//   (provider) => {
//     describe('FederatedApi Service -> Microservice one', () => {
//       beforeEach(async () => {
//         await provider.addInteraction({
//           state: 'mock GET response',
//           uponReceiving: 'a GET request from the proxy service',
//           withRequest: {
//             method: 'GET',
//             path: '/prod/micro1/my-microservice-id',
//             headers: {
//               'Content-Type': 'application/json',
//               Accept: '*/*',
//             },
//           },
//           willRespondWith: {
//             status: 200,
//             headers: { 'Content-Type': 'application/json' },
//             body: { mocked: 'response' },
//           },
//         });
//       });

//       it('should invoke microservice one GET method', async () => {
//         const res = await handler(
//           apiGatewayEvent({
//             httpMethod: 'GET',
//             headers: {},
//             resource: '/{proxy+}',
//             path: '/micro1/my-microservice-id',
//             queryStringParameters: null,
//             pathParameters: { proxy: 'micro1/my-microservice-id' },
//           }),
//           null,
//         );

//         expect(res.statusCode).toBe(200);
//         expect(res.body).toBe(JSON.stringify({ mocked: 'response' }));
//       });
//     });
//   },
// );

// pactWith(
//   {
//     ...PACT_CONFIG,
//     provider: SERVICE_TWO,
//     port: 5002,
//   },
//   (provider) => {
//     describe('FederatedApi Service -> Microservice two', () => {
//       beforeEach(async () => {
//         await provider.addInteraction({
//           state: 'mock POST response',
//           uponReceiving: 'a POST request from the proxy service',
//           withRequest: {
//             method: 'POST',
//             path: '/prod/micro2/query',
//             headers: {
//               Accept: '*/*',
//               'Content-Type': 'application/json',
//             },
//             query: {
//               myParam: 'test',
//             },
//             body: { hello: 'world' },
//           },
//           willRespondWith: {
//             status: 200,
//             headers: { 'Content-Type': 'application/json' },
//             body: { mocked: 'response' },
//           },
//         });
//       });

//       it('should invoke microservice two POST method with querystring params', async () => {
//         const res = await handler(
//           apiGatewayEvent({
//             httpMethod: 'POST',
//             headers: {},
//             resource: '/{proxy+}',
//             path: '/micro2/query',
//             queryStringParameters: {
//               myParam: 'test',
//             },
//             pathParameters: { proxy: 'micro2/query' },
//             body: JSON.stringify({ hello: 'world' }),
//           }),
//           null,
//         );

//         expect(res.statusCode).toBe(200);
//         expect(res.body).toBe(JSON.stringify({ mocked: 'response' }));
//       });
//     });
//   },
// );
