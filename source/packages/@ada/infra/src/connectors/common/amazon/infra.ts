/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TaskInput } from 'aws-cdk-lib/aws-stepfunctions';

export const AMAZON_BASE_TASK_INPUT: { name: string; value: TaskInput }[] = [
  {
    name: 'S3_OUTPUT_BUCKET_URI',
    value: TaskInput.fromJsonPathAt('$.s3OutputPath').value,
  },
  {
    name: 'TRIGGER_TYPE',
    value: TaskInput.fromJsonPathAt('$.triggerType').value,
  },
  {
    name: 'SCHEDULE_RATE',
    value: TaskInput.fromJsonPathAt('$.scheduleRate').value,
  },
];
