/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CustomFormat, Validator } from 'jsonschema';
import type { ErrorObject, FormatDefinition, FormatValidator, Options, Ajv as TAjv } from 'ajv';

// Ajv is dependecy of react-jsonschema-forms and causes `unsafe-eval` during compilation of validation
// Override this with webpack alias to remove it from deps
// https://github.com/rjsf-team/react-jsonschema-form/search?q=unsafe-eval&type=issues

export class Ajv implements Pick<TAjv, 'errors' | 'addFormat' | 'addMetaSchema' | 'validate'> {
  readonly errorDataPath: Options['errorDataPath'];
  readonly allErrors: Options['allErrors'];
  readonly multipleOfPrecision: Options['multipleOfPrecision'];
  readonly schemaId: Options['schemaId'];
  readonly unknownFormats: Options['unknownFormats'];

  errors: TAjv['errors'];

  private readonly validator: Validator;

  constructor(options: Options) {
    this.errorDataPath = options.errorDataPath;
    this.allErrors = options.allErrors === true;
    this.multipleOfPrecision = 8;
    this.schemaId = options.schemaId || 'auto';
    this.unknownFormats = options.unknownFormats;

    this.validator = new Validator();
  }

  addFormat(name: string, format: FormatValidator | FormatDefinition): TAjv {
    const customFormat: CustomFormat = (input: any): boolean => {
      if (typeof format === 'string') {
        format = new RegExp(format);
      }
      if (format instanceof RegExp) {
        return format.test(input);
      }
      if (typeof format === 'function') {
        return format(input) as any;
      }
      console.warn('Validation format not supported:', name, format);
      return true;
    };
    this.validator.customFormats[name] = customFormat;
    return this as unknown as TAjv;
  }
  addMetaSchema(schema: object, key?: string | undefined): TAjv {
    this.validator.addSchema(schema, key);
    return this as unknown as TAjv;
  }
  validate(schemaKeyRef: string | boolean | object, data: any): boolean | PromiseLike<any> {
    this.errors = undefined;
    const result = this.validator.validate(data, schemaKeyRef as any);
    if (result.valid) return true;

    console.warn('ValidationResult:', result);
    this.errors = result.errors.map(
      (error): ErrorObject => ({
        ...error,
        dataPath: error.path.join('.'),
        data,
        keyword: error.property,
        schemaPath: error.path.join('.'),
        params: error.argument,
      }),
    );

    throw new Error(result.toString());
  }
}

export default Ajv;
