/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/* eslint-disable */

// Lambda@Edge does not support const so use var, and csp uses single-quotes so ensure we maintain double-quotes
var CSP = "__CSP__";

// @ts-ignore
function handler(event) {
  var response = event.response;
  var headers = response.headers;

  headers['x-frame-options'] = { value: 'deny' };
  headers['x-xss-protection'] = { value: '1; mode=block' };
  headers['x-content-type-options'] = { value: 'nosniff' };
  headers['strict-transport-security'] = { value: 'max-age=47304000; includeSubDomains' };


  if (event.request.uri.match(/^\/docs\//)) {
    // Generated docs use inline scripts+styles and external fonts
    headers['content-security-policy'] = { value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src * 'self'; media-src 'self'" };
  } else {
    // Lambda@Edge does not support env vars, so need to use inline code and replace __CSP__ in build
    headers['content-security-policy'] = { value: CSP };
  }

  return response;
}
