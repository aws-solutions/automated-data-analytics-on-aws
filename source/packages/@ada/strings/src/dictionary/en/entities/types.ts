/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Pluralize } from '../../../../../../../@types/ts-utils';
import { SnakeCase } from 'type-fest';
import { plural } from 'pluralize';

export enum EntityKey {
	Domain = 'Domain',
	DataProduct = 'DataProduct',
	Transform = 'Transform',
	Schema = 'Schema',
	DataSet = 'DataSet',
	Script = 'Script',
	Ontology = 'Ontology',
	AttributePolicy = 'AttributePolicy',
	AttributeValuePolicy = 'AttributeValuePolicy',
	Lens = 'Lens',
	AccessRequest = 'AccessRequest',
	ApiAccessPolicy = 'ApiAccessPolicy',
	Group = 'Group',
	Member = 'Member',
	IdentityProvider = 'IdentityProvider',
	Machine = 'Machine',
	Token = 'Token',
	User = 'User',
	UserProfile = 'UserProfile',
	Query = 'Query',
	SavedQuery = 'SavedQuery',
}

export function toPluralKey(key: EntityKeys): string {
	if (key === 'Lens') {
		return 'Lenses';
	}
	if (key === 'Schema') {
		return 'Schemas';
	}

	return plural(key);
}

export interface StringEntityProperty {
	label: string;
	description: string;
	placeholder?: string;
	hintText?: string;
	emptyText?: string;
}

export type StringEntityProperties = Record<string, StringEntityProperty>;

export type EntityKeys = keyof typeof EntityKey

export interface StringEntityDefinitionExtras {
	description: string;
	descriptions: string;
	properties?: StringEntityProperties;
}

export const STRING_ENTITY_ACTIONS = [
	'CREATE',
	'UPDATE',
	'DELETE',
] as const;

export type TSTRING_ENTITY_ACTIONS = (typeof STRING_ENTITY_ACTIONS)[number];

export type TStringEntityActions<T extends string> = `${T}__${TSTRING_ENTITY_ACTIONS}`;

export type StringEntityActions<
	T extends EntityKeys,
	TSingular extends string = T,
	TPlural extends string = Pluralize<TSingular>,
> = TStringEntityActions<TSingular> | TStringEntityActions<TPlural>

export const STRING_ENTITY_EVENTS = [
	'FETCHING',
	'FETCHED',
	'FAILED_TO_FETCH',
	'CREATING',
	'CREATED',
	'FAILED_TO_CREATE',
	'UPDATING',
	'FAILED_TO_UPDATE',
	'CREATING_OR_UPDATING',
	'CREATED_OR_UPDATED',
	'FAILED_TO_CREATE_OR_UPDATE',
	'DELETING',
	'DELETED',
	'FAILED_TO_DELETE',
] as const;

export type TSTRING_ENTITY_EVENTS = (typeof STRING_ENTITY_EVENTS)[number];

export type TStringEntityEvents<T extends string> = `${T}__${TSTRING_ENTITY_EVENTS}`;

export type StringEntityEvents<
	T extends EntityKeys,
	TSingular extends string = T,
	TPlural extends string = Pluralize<TSingular>,
> = TStringEntityEvents<TSingular> | TStringEntityEvents<TPlural>

export type StringEntityDefinition<
	T extends EntityKeys,
	TKey extends string = T,
	TPlural extends string = Pluralize<TKey>,
	t extends string = SnakeCase<TKey>,
	tplural extends string = Pluralize<t>,
> =
	Record<TKey, Capitalize<string>> &
	Record<TPlural, Pluralize<string>> &
	Record<t, Lowercase<string>> &
	Record<tplural, Lowercase<Pluralize<string>>> &
	StringEntityDefinitionExtras;

export type StringEntityInterpolations<
	T extends EntityKeys,
	TKey extends string = T,
	TPlural extends string = Pluralize<TKey>,
	t extends string = SnakeCase<TKey>,
	tplural extends string = Pluralize<t>,
	INamed extends string = `${TKey}^`,
	inamed extends string = `${t}^`,
	INameds extends string = `${TPlural}^`,
	inameds extends string = `${tplural}^`,
	IPlural extends string = `${TPlural}$`,
	iplural extends string = `${tplural}$`,
	ICount extends string = `${TPlural}#`,
	icount extends string = `${tplural}#`,
	IProps extends string = `${TKey}@`,
	IDescription extends string = `${TKey}_description`,
	IDescriptions extends string = `${TPlural}_description`,
> =
	{
		[K in INamed | inamed | INameds | inameds
			| IPlural | iplural | ICount | icount
			| IDescription | IDescriptions
			| StringEntityActions<T>
			| StringEntityEvents<T>
		]: string;
	} & { [K1 in IProps]: StringEntityProperties; }

export type ComputedEntityStrings<
	T extends EntityKeys,
> = Omit<StringEntityDefinition<T>, keyof StringEntityDefinitionExtras> & StringEntityInterpolations<T>;

export type EntityStringDictionary = ComputedEntityStrings<EntityKey>;
