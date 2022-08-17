/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import './index.css';
import 'font-awesome/css/font-awesome.css'; // initialize strings and types
import { App } from '$core/App';
import { ErrorBoundary } from '$common/components/errors';
import { MetaProvider } from '$core/provider';
import { reportWebVitals } from './reportWebVitals';
import Container from 'aws-northstar/layouts/Container';
import LoadingIndicator from 'aws-northstar/components/LoadingIndicator';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';

const SuspenseFallback = () => (
  <Container>
    <LoadingIndicator label="Loading" />
  </Container>
);

ReactDOM.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<SuspenseFallback />}>
        <MetaProvider>
          <App />
        </MetaProvider>
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
  document.getElementById('root'),
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
