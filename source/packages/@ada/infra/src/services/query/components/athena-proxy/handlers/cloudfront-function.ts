/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/* eslint-disable */

// @ts-ignore
function handler(event) {
  var response = event.response;
  var headers = response.headers;

  headers['x-frame-options'] = { value: 'deny' };
  headers['x-xss-protection'] = { value: '1; mode=block' };
  headers['x-content-type-options'] = { value: 'nosniff' };
  headers['strict-transport-security'] = { value: 'max-age=47304000; includeSubDomains' };

  // This is API so not expected to handle content
  headers['content-security-policy'] = { value: "default-src 'none'" };

  return response;
}
