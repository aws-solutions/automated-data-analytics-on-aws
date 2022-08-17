/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
const DEBUG = process.env.DEBUG === 'true';

module.exports = {
  launch: {
    headless: !DEBUG,
    devtools: DEBUG,
    dumpio: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
};
