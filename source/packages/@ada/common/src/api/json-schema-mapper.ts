/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { JsonSchema, JsonSchemaVersion } from './json-schema';

// Copied from https://github.com/aws/aws-cdk/blob/c335ba38f5b46a8310509333331ac26b7471e30f/packages/@aws-cdk/aws-apigateway/lib/util.ts
export class JsonSchemaMapper {
  /**
   * Transforms naming of some properties to prefix with a $, where needed
   * according to the JSON schema spec
   * @param schema The JsonSchema object to transform for CloudFormation output
   */
  public static toCfnJsonSchema(schema: JsonSchema): any {
    const result = JsonSchemaMapper._toCfnJsonSchema(schema);
    if (! ('$schema' in result)) {
      result.$schema = JsonSchemaVersion.DRAFT4;
    }
    return result;
  }

  static readonly SchemaPropsWithPrefix: { [key: string]: string } = {
    schema: '$schema',
    ref: '$ref',
  };
  // The value indicates whether direct children should be key-mapped.
  static readonly SchemaPropsWithUserDefinedChildren: { [key: string]: boolean } = {
    definitions: true,
    properties: true,
    patternProperties: true,
    dependencies: true,
  };

  private static _toCfnJsonSchema(schema: any, preserveKeys = false): any {
    if (schema == null || typeof schema !== 'object') {
      return schema;
    }
    if (Array.isArray(schema)) {
      return schema.map(entry => JsonSchemaMapper._toCfnJsonSchema(entry));
    }
    return Object.assign({}, ...Object.entries(schema).map(([key, value]) => {
      const mapKey = !preserveKeys && (key in JsonSchemaMapper.SchemaPropsWithPrefix);
      const newKey = mapKey ? JsonSchemaMapper.SchemaPropsWithPrefix[key] : key;
      // If keys were preserved, don't consider SchemaPropsWithUserDefinedChildren for those keys (they are user-defined!)
      const newValue = JsonSchemaMapper._toCfnJsonSchema(
        value,
        !preserveKeys && JsonSchemaMapper.SchemaPropsWithUserDefinedChildren[key]
      );
      return { [newKey]: newValue };
    }));
  }
}
