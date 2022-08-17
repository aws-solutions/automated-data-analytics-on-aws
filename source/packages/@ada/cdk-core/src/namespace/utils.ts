/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { NamespaceGlobalUUID } from './global-uuid';
import { get4DigitsHash } from './global-uuid/common';
import { solutionInfo } from '@ada/common';
import { startCase } from 'lodash';

export function pascalCase(value: string): string {
  return startCase(value).split(' ').join('');
}

/**
 *
 * @param scope
 * @returns
 */
export function globalHash(scope: Construct): string {
  return NamespaceGlobalUUID.globalHash(scope);
}

type NAME_FORMAT = 'pascal' | 'lower';

/**
 * Get name of the solution in format for resource naming constraints.
 * @param {NAME_FORMAT} format
 * @returns
 */
export function getSolutionName(format: NAME_FORMAT = 'pascal'): string {
  const name = solutionInfo().name;

  switch (format) {
    case 'pascal':
      return pascalCase(name);
    case 'lower':
      return name.toLowerCase();
  }
}

interface NamingOptions {
  /**
   * Separate used in segments of the naming.
   * @default {space}
   */
  separator: string;
  /**
   * Indicates if 4 digit node hash is added.
   *
   * Resources that should retain consistent solution based naming when moved in tree should disable
   * this flag (eg: KmsKeyAlias should be consistent)
   * @default true
   */
  includeNodeHash: boolean;
}

const DEFAULT_NAMING_OPTIONS: NamingOptions = {
  separator: '',
  includeNodeHash: true,
};

function getNamingOptions(options?: Partial<NamingOptions>): NamingOptions {
  return {
    ...DEFAULT_NAMING_OPTIONS,
    ...options,
  };
}

/**
 * Gets a globally unique name for resource.
 * @param scope
 * @param baseName
 * @param separator
 * @returns
 */
export function getUniqueName(scope: Construct, baseName: string, options?: Partial<NamingOptions>): string {
  const { separator, includeNodeHash } = getNamingOptions(options);

  return `${baseName + separator}${includeNodeHash ? get4DigitsHash(scope.node.path) : ''}${globalHash(scope)}`;
}

/**
 * Gets a globally unique name for resource that includes the solution name.
 * @param scope
 * @param baseName
 * @param format
 * @param separator
 * @returns
 */
export function getUniqueNameWithSolution(
  scope: Construct,
  baseName: string,
  format?: NAME_FORMAT,
  options?: Partial<NamingOptions>,
): string {
  const { separator } = getNamingOptions(options);
  return `${getSolutionName(format) + separator}${getUniqueName(scope, baseName, options)}`;
}

// list of created unique kms key alias names to ensure no duplicates during construction
const _kmsKeyAliasNames: string[] = [];
/**
 * Gets a globally unique name for KmsKeyAlias construct.
 *
 * The alias will automatically be prefixed with `alias/{solution}/`.
 * @param scope
 * @param name Name of alias without any prefixes.
 * @returns
 */
export function getUniqueKmsKeyAlias(scope: Construct, name: string): string {
  // Disable duplicate testing during testing unless explicitly enabled
  if (!(process.env.NODE_ENV === 'test' && process.env.TEST_NAMESPACE_KMSALIAS_DUPLICATES == null)) {
    if (_kmsKeyAliasNames.includes(name)) {
      console.error('getUniqueKmsKeyAlias: duplicate name', name, scope.node.path, scope);
      throw new Error(`KmsKeyAlias already exists: ${name}`);
    }
    _kmsKeyAliasNames.push(name);
  }

  // we need to explicitly prefix with `alias/` because hash makes this value unresolved
  // and CDK is unable to automatically add the prefix.
  return 'alias/' + getUniqueNameWithSolution(scope, name, 'lower', { separator: '/', includeNodeHash: false });
}

/**
 * Gets a globally unique name for Kinesis:Firehose DeliveryStream resource which
 * automatically includes `aws-waf-logs-` prefix.
 * @param scope
 * @param name
 * @returns
 */
export function getUniqueWafFirehoseDeliveryStreamName(scope: Construct, name: string): string {
  return `aws-waf-logs-${getSolutionName('lower')}-${getUniqueName(scope, name, { separator: '-' })}`;
}

/**
 * Gets explicit LogGroup name under the `aws/vendedlogs/` prefix
 * to prevent exceeding policy limits.
 * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AWS-logs-and-resource-policy.html#AWS-logs-infrastructure-CWL
 * @param scope
 * @param service
 * @param name
 * @returns
 */
export function getUniqueVendedLogGroupName(scope: Construct, service: string, name: string): string {
  return `/aws/vendedlogs/${service}/${getSolutionName('lower')}/${getUniqueName(scope, name, { separator: '/' })}`;
}

/**
 * Gets explicit StateMachine LogGroup name under the `aws/vendedlogs/states/` prefix
 * to prevent exceeding policy limits.
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/bp-cwl.html
 * @param scope
 * @param name
 * @returns
 */
export function getUniqueStateMachineLogGroupName(scope: Construct, name: string): string {
  return getUniqueVendedLogGroupName(scope, 'states', name);
}

/**
 * Gets explicit DataProduct scoped LogGroup name under the `aws/vendedlogs/*` prefix
 * to prevent exceeding policy limits.
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/bp-cwl.html
 * @param scope
 * @param dataProductIdentifier - Unique identifier of data produce (`{domain}.{dataProductId}`)
 * @param service - Name of aws service (eg `states`, `apigateway`, etc)
 * @param logName - Base name of the log group that will get prefixed.
 * @returns `/aws/vendedlogs/{service}/{solution}/dataproduct/{dataProductIdentifier}/{logName}`
 */
export function getUniqueDataProductLogGroupName(
  scope: Construct,
  service: string,
  dataProductIdentifier: string,
  logName: string,
): string {
  const name = `dataproduct/${dataProductIdentifier}/${logName}`;
  return getUniqueVendedLogGroupName(scope, service, name);
}
