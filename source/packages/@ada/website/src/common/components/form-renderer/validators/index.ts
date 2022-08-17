/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as CommonApiValidation from '@ada/common/dist/api/validation';
import { Schema as JsonSchema, Validator as JsonSchemaValidator } from 'jsonschema';
import { ValidatorFunction } from '@data-driven-forms/react-form-renderer/validators';
import { ValidatorMapper } from '@data-driven-forms/react-form-renderer/validator-mapper';
import { isEmpty, uniqBy } from 'lodash';
import { parseSQL } from '$common/sql/parser';

type Validator<T = object | undefined> = (options: T) => ValidatorFunction;

// https://html.spec.whatwg.org/multipage/input.html#email-state-(type=email)
export const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

export const EMAIL_VALIDATOR: Validator = () => (value) => {
  if (isEmpty(value)) return undefined;
  if (EMAIL_PATTERN.test(value)) return undefined;
  return 'Invalid email address';
};

export const NOT_EXISTING_VALIDATOR: Validator =
  ({ existing }: NotExistingValidatorProps | undefined = {}) =>
  (value) => {
    if (isEmpty(value)) return undefined;
    if (existing && Array.isArray(existing) && existing.includes(value)) {
      return `Value ${value} already exists`;
    }
    return undefined;
  };

export const TRANSFORM_SCRIPT_CODE_SNIPPET = 'def apply_transform(';

export const TRANSFORM_SCRIPT_CODE: Validator = () => (value: string) => {
  if (isEmpty(value)) return undefined;
  if (!value.includes(TRANSFORM_SCRIPT_CODE_SNIPPET)) {
    return `Script must contain \`${TRANSFORM_SCRIPT_CODE_SNIPPET}\``;
  }
  return undefined;
};

export const CUSTOM_VALIDATOR: Validator<{ validate: ValidatorFunction }> = ({ validate }) => validate;

export interface NotExistingValidatorProps {
  existing?: string[];
}

type TCommonApiValidation = keyof typeof CommonApiValidation;
type CommonApiValidationKeys = keyof {
  [P in TCommonApiValidation as P extends `${infer K}_VALIDATION` ? K : never]: string;
};
const _JsonSchemaValidator = new JsonSchemaValidator();
export const JSONSCHEMA_VALIDATOR: Validator =
  ({
    schema,
    message,
  }: { schema?: Partial<JsonSchema> | CommonApiValidationKeys; message?: string } | undefined = {}) =>
  (value) => {
    if (schema == null) return undefined;

    if (typeof schema === 'string') {
      const schemaKey = `${schema}_VALIDATION`;
      if (schemaKey in CommonApiValidation) {
        schema = CommonApiValidation[schemaKey as TCommonApiValidation] as Partial<JsonSchema>;
      } else {
        throw new Error(`Validation JsonSchema for common key "${schema}" is not supported.`);
      }
    }

    const results = _JsonSchemaValidator.validate(value, schema);
    if (results.valid !== true) {
      return message || results.errors.join(', ');
    }

    return undefined;
  };

type UniqByParam = Parameters<typeof uniqBy>[1];
export const NO_DUPLICATES_VALIDATOR: Validator =
  ({ by }: { by?: UniqByParam } | undefined = {}) =>
  (value) => {
    if (typeof value === 'string') {
      value = value.split(',').map((v) => v.trim());
    }

    if (Array.isArray(value)) {
      const uniqueValues = uniqBy(value, by || JSON.stringify);
      if (uniqueValues.length !== value.length) {
        return 'Contains duplicate values';
      }
    }

    return undefined;
  };

export const SQL: Validator = () => (value: string) => {
  if (isEmpty(value)) return undefined;
  try {
    parseSQL(value);
    return undefined;
  } catch (error: any) {
    return `Invalid SQL: ${error.message}`;
  }
};

export const SQL_CLAUSE: Validator = () => (value: string) => {
  if (isEmpty(value)) return undefined;
  try {
    parseSQL(`SELECT * FROM tmp WHERE ${value}`);
    return undefined;
  } catch (error: any) {
    return `Invalid SQL Clause: ${error.message}`;
  }
};

export enum CustomValidatorTypes {
  EMAIL = 'email',
  NOT_EXISTING = 'not_existing',
  TRANSFORM_SCRIPT_CODE = 'transform_script_code', //NOSONAR (S2814:Duplicate) - false positive
  NO_DUPLICATES = 'no_duplicates',
  JSONSCHEMA = 'jsonschema',
  SQL = 'sql', //NOSONAR (S2814:Duplicate) - false positive
  SQL_CLAUSE = 'sql_clause', //NOSONAR (S2814:Duplicate) - false positive
  CUSTOM = 'custom',
}

export const CUSTOMER_VALIDATOR_MAPPER: ValidatorMapper = {
  [CustomValidatorTypes.EMAIL]: EMAIL_VALIDATOR,
  [CustomValidatorTypes.NOT_EXISTING]: NOT_EXISTING_VALIDATOR,
  [CustomValidatorTypes.TRANSFORM_SCRIPT_CODE]: TRANSFORM_SCRIPT_CODE,
  [CustomValidatorTypes.NO_DUPLICATES]: NO_DUPLICATES_VALIDATOR,
  [CustomValidatorTypes.JSONSCHEMA]: JSONSCHEMA_VALIDATOR as any,
  [CustomValidatorTypes.SQL]: SQL as any,
  [CustomValidatorTypes.SQL_CLAUSE]: SQL_CLAUSE as any,
  [CustomValidatorTypes.CUSTOM]: CUSTOM_VALIDATOR as any,
};
