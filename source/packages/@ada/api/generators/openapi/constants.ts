/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';

export const PACKAGE_ROOT = path.join(__dirname, '../../');

export const BUILD_DIR = path.join(PACKAGE_ROOT, 'build');

export const CLIENT_DIR = path.join(PACKAGE_ROOT, 'client');

export const DOCS_DIR = path.join(PACKAGE_ROOT, 'docs');

export const OPENAPI_SPEC_JSON_FILE = path.join(BUILD_DIR, 'openapi.json');

export const OPENAPI_SPEC_FILE = path.join(PACKAGE_ROOT, 'spec.yaml');

export const NPM_PACKAGE_NAME = '@ada/api-client';
