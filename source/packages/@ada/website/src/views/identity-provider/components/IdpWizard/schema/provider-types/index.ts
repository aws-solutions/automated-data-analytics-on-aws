/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { IdpTypeDefinition } from './common';
import Amazon from './amazon';
import Google from './google';
import OIDC from './oidc';
import SAML from './saml';

export const IdentityProviderDefinitions: IdpTypeDefinition[] = [SAML, OIDC, Amazon, Google];
