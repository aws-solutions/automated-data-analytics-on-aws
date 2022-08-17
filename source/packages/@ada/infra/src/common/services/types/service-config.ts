/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

export interface MicroserviceConfig {
  /**
   * The display name of the service.
   */
  readonly serviceName: string;
  /**
   * The namespace of the service used as base route for api.
   */
  readonly serviceNamespace: string;
}
