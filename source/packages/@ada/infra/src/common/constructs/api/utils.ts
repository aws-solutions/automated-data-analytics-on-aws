/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CreateAndUpdateDetails, PaginatedResponse } from './common';
import { JsonSchema, cloneSchema, extendSchema } from '@ada/common';
import { difference } from 'lodash';

export * from '@ada/common/dist/api/schema-utils';

/**
 * Clones a schema as "request input" which means it removes requiring the id of entity.
 * @param source
 * @param required
 * @param requiredViaOmit If true the `required` param will omit the values from parent, otherwise will replace.
 * @param omitUpdatedTimestamp By default `asInput` will add `updatedTimestamp` as optional prop.
 * @param extraId additional text to be appended to the id to distinguish between multiple input derivatives of the same entity
 * @returns
 */
export function asInput(
  source: JsonSchema,
  required: string[] = source.required || [],
  requiredViaOmit = false,
  omitUpdatedTimestamp = false,
  extraId = '',
): JsonSchema {
  required = requiredViaOmit ? difference(source.required || [], required) : required;

  if (source.id == null) {
    console.error(source);
    throw new Error('Schema asInput requires source to have "id"');
  }

  const schema = cloneSchema(source, {
    id: source.id + extraId + 'Input',
    required,
  });

  if (omitUpdatedTimestamp !== true) {
    // @ts-ignore: read only
    schema.properties = {
      updatedTimestamp: CreateAndUpdateDetails.properties!.updatedTimestamp,
      ...(schema.properties || {}),
    };
  }

  return schema;
}

export function asNonEntityInput(
  source: JsonSchema,
  required: string[] = source.required || [],
  requiredViaOmit = false,
  extraId = '',
): JsonSchema {
  return asInput(source, required, requiredViaOmit, true, extraId);
}

export function asEntity(schema: JsonSchema): JsonSchema {
  if (schema.id == null) throw new Error('Schema "asEntity" requires schema.id');
  return extendSchema(
    {
      id: `${schema.id}Entity`,
    },
    schema,
    CreateAndUpdateDetails,
  );
}

export function asPaginatedResponse(schema: JsonSchema): JsonSchema {
  return extendSchema(schema, PaginatedResponse);
}
