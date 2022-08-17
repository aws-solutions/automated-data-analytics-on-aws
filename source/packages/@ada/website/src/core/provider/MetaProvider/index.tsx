/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BaseMetaProvider } from './base';
import React, { PropsWithChildren } from 'react';

export * from './base';

export const MetaProvider = ({ children }: PropsWithChildren<{}>) => {
  return <BaseMetaProvider>{children}</BaseMetaProvider>;
};
