/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
const path = require('path');
const { LL } = require('@ada/strings');

/*
 This is basic sanity testing to verify the webpack bundling artifacts for production build are valid as we
 have experience several instances where dev builds and tests all pass but the deployed website fails
 with errors like `exports is undefined`.

 This tests that the bundled js are executed correcly by verifying the auth flow is triggered, which happens
 within the application code.

 Cypress testing is used for actual end-to-end testing, but that is outside of standard unit testing flow so happens
 to late to catch this basic issue.
*/

const DEBUG = process.env.DEBUG === 'true';

const BUILD_DIR = path.resolve(__dirname, '..', '..', 'build');

const OAUTH_DOMAIN = 'test.auth.ap-southeast-1.amazoncognito.com';
const RUNTIME_CONFIG = `
window['runtime-config'] = {
  "userPoolId": "ap-southeast-1_ABCDEFGHI",
  "userPoolClientId": "mockUserPoolClientId",
  "apiUrl": "https://test.api/",
  "region": "ap-southeast-1",
  "accountId": "123456789012",
  "oauthScopes": [
    "phone",
    "profile",
    "openid",
    "email",
    "aws.cognito.signin.user.admin"
  ],
  "oauthDomain": "${OAUTH_DOMAIN}",
  "ouathResponseType": "code"
};
`;

jest.setTimeout(30000);

describe('sanity', () => {
  let authWasCalled;
  beforeAll(async () => {
    authWasCalled = false;

    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith('file://')) {
        if (url === 'file:///runtime-config.js') {
          console.log('INTERCEP:', url);
          request.respond({
            status: 200,
            body: RUNTIME_CONFIG,
          });
        } else if (url.includes(BUILD_DIR) === false) {
          request.respond({
            status: 301,
            headers: {
              Location: url.replace('file://', `file://${BUILD_DIR}`),
            },
          });
        } else {
          request.continue();
        }
      } else if (url.includes('cognito-idp') || url.includes('amazoncognito') || url.includes(OAUTH_DOMAIN)) {
        console.log('INTERCEP-COGNITO:', url);
        authWasCalled = true;
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.goto(`file:///index.html`, { waitUntil: 'domcontentloaded' });

    DEBUG && (await jestPuppeteer.debug());
  });

  it('should have correct "title"', async () => {
    await expect(page.title()).resolves.toMatch(LL.CONST.APP_NAME());
  });

  it('should trigger auth flow', async () => {
    await page.waitForTimeout(500);
    expect(authWasCalled).toBeTruthy();
  });
});
