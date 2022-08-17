/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as entities from './entity';
import * as nestedEntities from './entity/nested';
import { EntityKeys, EntityStringDictionary, StringEntityEvents, StringEntityProperties, toPluralKey } from './types';
import { snakeCase } from 'lodash';

const EVENT_ARGS = ' {0?:string|quote}'

export const ENTITY = Object.assign(Object.entries(entities).reduce((_entries, [key, value]) => {
	// ignore non definitions, such as es_module properties
	if (typeof value !== 'object' || !(key in value)) return _entries;

	const { description, descriptions, properties, ...definition } = value;
	const SingularKey = key as keyof typeof definition;
	const SingularValue = definition[SingularKey];
	const PluralKey = toPluralKey(key as EntityKeys) as keyof typeof definition;
	const PluralValue = definition[PluralKey];

	const singular_key = snakeCase(SingularKey) as keyof typeof definition;
	const singular_value = definition[singular_key];
	const plural_key = snakeCase(PluralKey) as keyof typeof definition;
	const plural_value = definition[plural_key];

	const strings: [key: string, value: string | StringEntityProperties][] = [];
	// named
	strings.push([`${SingularKey}^`, `{0:string} ${SingularValue}`]);
	strings.push([`${singular_key}^`, `{0:string} ${singular_value}`]);
	strings.push([`${PluralKey}^`, `{0:string} ${PluralValue}`]);
	strings.push([`${plural_key}^`, `{0:string} ${plural_value}`]);
	// description(s)
	strings.push([`${SingularKey}_description`, description]);
	strings.push([`${PluralKey}_description`, descriptions]);
	// plural interpolation
	// https://github.com/ivanhofer/typesafe-i18n/tree/main/packages/runtime#plural-zero-one-other
	// {{zero|one|other}}
	strings.push([`${PluralKey}$`, `{{ ${SingularValue} | ${SingularValue} | ${PluralValue} }}`]);
	strings.push([`${plural_key}$`, `{{ ${singular_value} | ${singular_value} | ${plural_value} }}`]);
	// count interpolation
	strings.push([`${PluralKey}#`, `{{ 1 ${SingularValue} | ?? ${PluralValue} }}`]);
	strings.push([`${plural_key}#`, `{{ 1 ${singular_value} | ?? ${plural_value} }}`]);
	// properties
	properties && strings.push([`${SingularKey}@`, properties]);
	// actions
	strings.push(...Object.entries({
		// Singular
		[`${SingularKey}__CREATE`]: `Create ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__UPDATE`]: `Edit ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__DELETE`]: `Delete ${singular_value}${EVENT_ARGS}`,
		// Plural
		[`${PluralKey}__CREATE`]: `Create ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__UPDATE`]: `Edit ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__DELETE`]: `Delete ${plural_value}${EVENT_ARGS}`,
	} as Record<StringEntityEvents<EntityKeys>, string>));

	// events
	strings.push(...Object.entries({
		// Singular
		[`${SingularKey}__FETCHING`]: `Fetching ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__FETCHED`]: `Fetched ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__FAILED_TO_FETCH`]: `Failed to fetch ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__CREATING`]: `Creating ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__CREATED`]: `Created ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__FAILED_TO_CREATE`]: `Failed to create ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__UPDATING`]: `Updating ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__UPDATED`]: `Updated ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__FAILED_TO_UPDATE`]: `Failed to update ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__CREATING_OR_UPDATING`]: `Saving ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__CREATED_OR_UPDATED`]: `Saved ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__FAILED_TO_CREATE_OR_UPDATE`]: `Failed to save ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__DELETING`]: `Deleting ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__DELETED`]: `Deleted ${singular_value}${EVENT_ARGS}`,
		[`${SingularKey}__FAILED_TO_DELETE`]: `Failed to delete ${singular_value}${EVENT_ARGS}`,
		// Plural
		[`${PluralKey}__FETCHING`]: `Fetching ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__FETCHED`]: `Fetched ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__FAILED_TO_FETCH`]: `Failed to fetch ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__CREATING`]: `Creating ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__CREATED`]: `Created ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__FAILED_TO_CREATE`]: `Failed to create ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__UPDATING`]: `Updating ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__UPDATED`]: `Updated ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__FAILED_TO_UPDATE`]: `Failed to update ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__CREATING_OR_UPDATING`]: `Saving ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__CREATED_OR_UPDATED`]: `Saved ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__FAILED_TO_CREATE_OR_UPDATE`]: `Failed to save ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__DELETING`]: `Deleting ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__DELETED`]: `Deleted ${plural_value}${EVENT_ARGS}`,
		[`${PluralKey}__FAILED_TO_DELETE`]: `Failed to delete ${plural_value}${EVENT_ARGS}`,
	} as Record<StringEntityEvents<EntityKeys>, string>));

	return {
		..._entries,
		...definition,
		...Object.fromEntries(strings),
	};
}, {}) as EntityStringDictionary, nestedEntities);
