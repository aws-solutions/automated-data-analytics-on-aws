/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import mockAxios from 'jest-mock-axios';

mockAxios.defaults.headers = {
  put: {
    'Content-Type': 'mock',
  },
};

export default mockAxios;
