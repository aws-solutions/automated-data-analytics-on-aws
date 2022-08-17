/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import '@testing-library/jest-dom/extend-expect';
import { jest } from '@jest/globals';
// initialize strings
import './src/strings';

// https://storybook.js.org/docs/react/writing-tests/importing-stories-in-tests#optional-configuration
import { setGlobalConfig } from '@storybook/testing-react';
// Storybook's preview file location
import * as globalStorybookConfig from './.storybook/preview';
setGlobalConfig(globalStorybookConfig);

// https://github.com/jefflau/jest-fetch-mock/issues/13#issuecomment-299413329
const { Response, Headers, Request } = require('whatwg-fetch');
global.Response = Response;
global.Headers = Headers;
global.Request = Request;

// Mock localstorage imported by northstar as an es module
const mockSetLocalStorage = jest.fn();
jest.mock('react-use-localstorage', () => ({
  __esModule: true,
  default: () => ['false', mockSetLocalStorage],
}));

// https://github.com/remarkjs/react-markdown/issues/635
jest.mock('remark-gfm', () => () => {});
jest.mock('rehype-raw', () => () => {});

// Trim all i18n translation strings during testing to match html rendering which trims by default.
// Since we check against rendered value with `findTextBy`, we need trimmed version to have matching
// work as expected.
jest.mock('@ada/strings/node_modules/typesafe-i18n/runtime/cjs/runtime/src/core.cjs', () => {
  const actual = jest.requireActual('@ada/strings/node_modules/typesafe-i18n/runtime/cjs/runtime/src/core.cjs') as any;
  return {
    ...actual,
    translate: (...args: any[]) => actual.translate(...args).trim(),
  }
})

export {};
