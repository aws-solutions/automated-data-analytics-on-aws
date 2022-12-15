/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TaskInput } from 'aws-cdk-lib/aws-stepfunctions';

export const GOOGLE_BASE_TASK_INPUT: { name: string, value: TaskInput }[] = [
	{
		name: 'CLIENT_EMAIL',
		value: TaskInput.fromJsonPathAt('$.clientEmail').value,
	},
	{
		name: 'CLIENT_ID',
		value: TaskInput.fromJsonPathAt('$.clientId').value,
	},
	{
		name: 'PRIVATE_KEY_ID',
		value: TaskInput.fromJsonPathAt('$.privateKeyId').value,
	},
	{
		name: 'PRIVATE_KEY_SECRET',
		value: TaskInput.fromJsonPathAt('$.privateKeySecretName').value,
	},
	{
		name: 'PROJECT_ID',
		value: TaskInput.fromJsonPathAt('$.projectId').value,
	},
	{
		name: 'S3_OUTPUT_BUCKET_URI',
		value: TaskInput.fromJsonPathAt('$.s3OutputPath').value,
	},
]
