/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';

export const getCustomResourcePath = (name: string) => path.join('../infra/custom-resources', name);

export const getAssetsPath = (name: string) => path.join('../infra/assets', name);

export const getPackagePath = (name: string) => path.join('..', name);

export const getServicePath = (name: string) => path.join(getPackagePath('infra'), 'src/services', name);

export const getDockerImagePath = (imageName: string) =>
  // Path must be absolute, see: https://github.com/aws/aws-cdk/issues/15721
  path.resolve(getPackagePath('infra'), 'built-docker-images', `${imageName}.tar`);
