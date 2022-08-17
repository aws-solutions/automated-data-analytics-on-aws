/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENV_DEVELOPMENT, ENV_PRODUCTION } from '$config';
import { LL } from '@ada/strings';
import React, { PropsWithChildren } from 'react';

/* eslint-disable handle-callback-err */

export class ErrorBoundary extends React.Component {
  state = { hasError: false };

  constructor(props: PropsWithChildren<{}>) {
    super(props);
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // TODO: handle error handling/logging for uncaught errors
    console.error(error, errorInfo);

    if (ENV_DEVELOPMENT) throw error;
  }

  render() {
    if (ENV_PRODUCTION && this.state.hasError) {
      // You can render any custom fallback UI
      return <h1>{LL.VIEW.error.unknownError()}</h1>;
    }

    return this.props.children;
  }
}
