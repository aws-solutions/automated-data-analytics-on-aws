/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';
import { JsonSchema, JsonSchemaType } from './json-schema';
import { JsonSchemaMapper } from './json-schema-mapper';
import { cloneDeep, isArray, isEmpty, isNil, isObject, last, mergeWith, nth, omit, omitBy, uniq } from 'lodash';

/* eslint-disable sonarjs/cognitive-complexity */

// stores mapping from json schema id to model to verify uniqueness of naming.
const JSONSCHEMA_ID_MODEL_MAP = new Map<string, string>();

export function idModelName(id: string, validate = true): string {
  if (!id.match(/^[/#]/)) return id;
  const name = path.basename(id);
  if (validate) {
    if (JSONSCHEMA_ID_MODEL_MAP.has(name)) {
      if (JSONSCHEMA_ID_MODEL_MAP.get(name) !== id) {
        throw new Error(`Model collision between "${JSONSCHEMA_ID_MODEL_MAP.get(name)}" and "${id}"`);
      }
    } else {
      JSONSCHEMA_ID_MODEL_MAP.set(name, id);
    }
  }
  return name;
}

type Ref = Pick<JsonSchema, 'ref' | 'description'>;
type Definitions = Required<JsonSchema>['definitions'];

export function asRef(schema: JsonSchema): Ref {
  if (schema.id == null) {
    console.error(schema);
    throw new Error('Schema must have "id" defined to be used as ref');
  }
  return refById(schema.id, schema.description);
}

export function refById(id: string, description?: string): Ref {
  return omitBy({ ref: `#/definitions/${idModelName(id)}`, description }, isNil);
}

/**
 * Removes "required" property from schema, and omits "id" to ensure doesn't overwrite original schemas.
 * @param schema
 * @returns
 */
export function asPartial(schema: JsonSchema): JsonSchema {
  return {
    ...omit(schema, ['id', 'required']),
    id: schema.id ? `${schema.id}Partial` : undefined,
    definitions: {
      ...(schema.id ? { [idModelName(schema.id)]: omit(schema, 'definitions') } : {}),
      ...schema.definitions,
    },
  };
}

export function extendSchema(schema: JsonSchema, ...parents: JsonSchema[]): JsonSchema {
  parents = parents
    .slice()
    .reverse()
    .map((parent) => normalizeSchema(parent));
  schema = normalizeSchema(schema);

  const definitions: Definitions = {
    ...parents.reduce((_definitions, parent) => {
      if (parent.id == null) {
        console.debug(parent);
        throw new Error('Schema id is required on parents to extends');
      }
      return {
        ..._definitions,
        ...(parent.definitions || {}),
        [parent.id]: omit(parent, 'definitions'),
      };
    }, {} as Definitions),
    ...(schema.definitions || {}),
  };

  const schemas: JsonSchema[] = [schema, ...parents].map((s) => omit(s, 'definitions'));

  const mergedSchema = mergeJsonSchema(schema.id, ...schemas);

  // make sure we reference the parent defintions so we get models
  return {
    ...mergedSchema,
    definitions,
  };
}

/**
 * Clones a schema by removing the id and potentially overwriting additional properties.
 * @param source
 * @param overwrite
 * @returns
 */
export function cloneSchema(source: JsonSchema, overwrite: JsonSchema = {}): JsonSchema {
  return {
    ...omit(source, ['id']),
    ...overwrite,
  };
}

// @ts-ignore: private static method accessor
const SchemaPropsWithUserDefinedChildren = JsonSchemaMapper.SchemaPropsWithUserDefinedChildren;

type JsonSchemaDefinitions = Required<JsonSchema>['definitions'];

export function normalizeSchema(schema: JsonSchema): JsonSchema { //NOSONAR (S3776:Cognitive Complexity) - won't fix
  schema = cloneDeep(schema);

  const definitions: JsonSchemaDefinitions = {};

  function _normalizeSchema(_schema: JsonSchema, paths: string[] | null, _definitions: JsonSchemaDefinitions): any {
    if (_schema == null || typeof _schema !== 'object') {
      return _schema;
    }
    const preserve = paths ? SchemaPropsWithUserDefinedChildren[last(paths) as string] === true : false;

    if (Array.isArray(_schema)) {
      return _schema.map((entry) => _normalizeSchema(entry, paths, _definitions));
    }

    const normalizedSchema = Object.assign(
      {},
      ...Object.entries(_schema).map(([key, value]) => {
        if (!preserve && key === 'id') {
          return { id: idModelName(value) };
        } else if (!preserve && key === 'definitions') {
          // Hoist all "definitions" to the root
          const defs: JsonSchemaDefinitions = _normalizeSchema(value, paths ? paths.concat(key) : [key], _definitions);
          Object.entries(defs).forEach(([defKey, definition]) => {
            _definitions[idModelName(definition.id || defKey)] = definition;
          });
          return {}; // remove "definitions" from sub-schema
        } else {
          const newValue = _normalizeSchema(value, paths ? paths.concat(key) : [key], _definitions);
          return { [key]: newValue };
        }
      }),
    );

    // hoist models to definitions and convert to reference (except for root schema and already in any scope of definitions)
    if (!preserve && normalizedSchema.id && paths != null && nth(paths, -2) !== 'definitions') {
      _definitions[idModelName(normalizedSchema.id)] = normalizedSchema;

      return asRef(normalizedSchema);
    }

    return normalizedSchema;
  }

  const newSchema = _normalizeSchema(schema, null, definitions);
  if (!isEmpty(definitions)) {
    return {
      ...newSchema,
      definitions,
    };
  }
  return newSchema;
}

export function mergeJsonSchema(id: string | undefined, ...schemas: JsonSchema[]): JsonSchema {
  function mergeArray(objValue: any, srcValue: any, options = { unique: false, sorted: false }): any[] {
    let arr = (() => {
      if (isArray(objValue) || isArray(srcValue)) {
        if (isArray(objValue) && isArray(srcValue)) return [...objValue, ...srcValue];
        if (isArray(objValue)) return [...objValue, srcValue];
        if (isArray(srcValue)) return [objValue, ...srcValue];
      }

      console.debug('mergeJsonSchema:mergeArray:', objValue, srcValue);
      throw new Error('Unsuppored array value merge');
    })();

    if (options.unique) arr = uniq(arr);
    if (options.sorted) arr = arr.sort();
    return arr;
  }

  const mergedSchema = mergeWith(
    {},
    ...schemas,
    (objValue: any, srcValue: any, key: string, object: any, source: any, stack: any): any => { //NOSONAR (S3776:Cognitive Complexity) - won't fix
      if (isObject(srcValue)) srcValue = cloneDeep(srcValue);
      // bypass custom resolution for nullish values
      if (objValue == null || srcValue == null) return srcValue == null ? objValue : srcValue;

      // specific key merge resolvers
      switch (key) {
        case 'additionalProperties': {
          if (objValue === true || srcValue === true) return true;
          if (objValue === false || srcValue === false) return objValue || srcValue;
          if (isObject(objValue) && isObject(srcValue)) {
            const objSchema: JsonSchema = objValue;
            const srcSchema: JsonSchema = srcValue;
            if (objSchema.allOf && srcSchema.allOf) {
              return mergeJsonSchema(undefined, {}, objSchema, srcSchema);
            }
            if (objSchema.allOf || srcSchema.allOf) {
              if (objSchema.allOf) return { ...objSchema, allOf: [...objSchema.allOf, srcSchema] } as JsonSchema;
              if (srcSchema.allOf) return { ...srcSchema, allOf: [...srcSchema.allOf, objSchema] } as JsonSchema;
            }
            if (objSchema.type === JsonSchemaType.OBJECT && srcSchema.type === JsonSchemaType.OBJECT) {
              return mergeJsonSchema(undefined, {}, objSchema, srcSchema);
            }

            console.debug('mergeJsonSchema:additionalProperties: ALLOF:', objValue, srcValue);
            return {
              type: JsonSchemaType.OBJECT,
              allOf: [objSchema, srcSchema],
            } as JsonSchema;
          }
          console.debug('mergeJsonSchema:additionalProperties:', objValue, srcValue);
          throw new Error('Unsupported jsonschema merge of "additionalProperties"');
        }
        case 'patternProperties': {
          if ('^.*$' in srcValue) {
            console.debug(srcValue, stack);
            throw new Error(`Use "additionalProperties" instead of "patternProperties" with "^.*$"`);
          }
        }
        /* eslint-disable: no-fallthrough */
        case 'required':
        case 'enum': {
          return mergeArray(objValue, srcValue, { unique: true, sorted: true });
        }
        /* eslint-enable: no-fallthrough */
      }

      // concat array values
      if (isArray(objValue) || isArray(srcValue)) {
        return mergeArray(objValue, srcValue);
      }
    },
  );

  return omitBy(
    {
      ...mergedSchema,
      id, // force id to be maintained or ignored
    },
    isNil,
  );
}
