/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import axios, { AxiosRequestConfig } from 'axios';

const METRICS_ENDPOINT = 'https://metrics.awssolutionsbuilder.com/generic';

export interface OperationalMetricsConfig {
  awsSolutionId: string;
  awsSolutionVersion: string;
  anonymousDataUUID: string;
  sendAnonymousData: string;
}

export interface MetricsPayload {
  awsSolutionId: string;
  awsSolutionVersion: string;
  anonymousDataUUID: string;
  timestamp: string;
  data: unknown;
}

export enum SEND_ANONYMOUS_METRICS_RESULT {
  Succeeded = 'Succeeded',
}

export async function sendAnonymousMetric(payload: MetricsPayload): Promise<string> {
  try {
    const payloadStr = JSON.stringify({
      Solution: payload.awsSolutionId,
      Version: payload.awsSolutionVersion,
      UUID: payload.anonymousDataUUID,
      TimeStamp: payload.timestamp,
      Data: payload.data,
    });

    const config: AxiosRequestConfig = {
      headers: {
        'content-type': 'application/json',
        'content-length': String(payloadStr.length),
      },
    };

    console.log('Sending anonymized metric', payloadStr);
    const response = await axios.post(METRICS_ENDPOINT, payloadStr, config);
    console.log(`Anonymized metric response: ${response.statusText} (${response.status})`);
    return SEND_ANONYMOUS_METRICS_RESULT.Succeeded;
  } catch (err) {
    // Log the error
    console.error('Error sending anonymized metric');
    console.error(err);
    return (err as Error).message;
  }
}
