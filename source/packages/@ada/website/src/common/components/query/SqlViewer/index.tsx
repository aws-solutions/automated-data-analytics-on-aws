/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CodeViewer, CodeViewerProps } from '$common/components/CodeViewer';
import React from 'react';

export const SqlViewer: React.FC<Omit<CodeViewerProps, 'mode'>> = (props) => <CodeViewer mode="sql" {...props} />;
