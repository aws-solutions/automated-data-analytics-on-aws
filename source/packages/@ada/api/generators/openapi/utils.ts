/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

const DEFAULT_ARGS = ['--generate-alias-as-model', '--skip-operation-example'] as const;

export function serializePropertiesArg(
  argName: string,
  properties: Record<string, unknown>,
  argValueSeparator = '=',
): string {
  return (
    argName +
    argValueSeparator +
    Object.entries(properties)
      .reduce((props, [key, value]) => {
        return [...props, `${key}=${String(value)}`];
      }, [] as string[])
      .join(',')
  );
}

export function serializeGlobalPropertiesArg(properties: Record<string, unknown>): string {
  return serializePropertiesArg('--global-property', properties, ' ');
}

export function serializeAdditionalPropertiesArg(properties: Record<string, unknown>): string {
  return serializePropertiesArg('--additional-properties', properties);
}

export function serializeArgs(options: {
  global?: Record<string, unknown>;
  additional?: Record<string, unknown>;
}): string[] {
  const args: string[] = [...DEFAULT_ARGS];
  if (options.global) {
    args.push(serializeGlobalPropertiesArg(options.global));
  }
  if (options.additional) {
    args.push(serializeAdditionalPropertiesArg(options.additional));
  }

  return args;
}
