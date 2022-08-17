/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  AccessRequestEntity,
  AccessRequestIdentifier,
  ApiAccessPolicyEntity,
  ApiAccessPolicyIdentifier,
  AttributePolicyEntity,
  AttributePolicyIdentifier,
  AttributeValuePolicyEntity,
  DataProductEntity,
  DataProductIdentifier,
  DataProductPolicyEntity,
  DefaultLensPolicyEntity,
  DomainEntity,
  DomainIdentifier,
  GroupEntity,
  GroupIdentifier,
  IdentityProviderEntity,
  IdentityProviderIdentifier,
  ListIdentityGroupsResponse,
  ListIdentityMachineTokensResponse,
  ListIdentityMachinesResponse,
  ListIdentityProvidersResponse,
  ListIdentityUsersResponse,
  MachineEntity,
  MachineIdentifier,
  OntologyEntity,
  OntologyIdentifier,
  QueryExecution,
  S3Location,
  SavedQueryEntity,
  SavedQueryIdentifier,
  SavedQueryList,
  ScriptEntity,
  ScriptIdentifier,
  TokenEntity,
  TokenIdentifier,
  UserEntity,
  UserIdentifier,
} from '../models';
import {
  ApiTransformedOperationName,
  InferOperationAction,
  InferOperationType,
  MUTATION_ACTIONS,
  OPERATION_ACTION,
  OPERATION_TYPE,
} from './api';
import {
  ListApiAccessPoliciesResponse,
  ListDataProductDomainDataProductsResponse,
  ListDataProductDomainsResponse,
  ListDataProductScriptsResponse,
  ListIdentityRequestsResponse,
  ListOntologiesResponse,
} from '../';
import { OPERATION_PATTERN } from '.';
import { Pluralize, Singularize, UnionToTuple } from '../../../../../@types/ts-utils';
import { isEmpty } from 'lodash';
import pluralize from 'pluralize';

export type EntityTypes =
  | DataProductEntity
  | ApiAccessPolicyEntity
  | S3Location
  | ScriptEntity
  | DefaultLensPolicyEntity
  | AttributePolicyEntity
  | AttributeValuePolicyEntity
  | DataProductPolicyEntity
  | GroupEntity
  | MachineEntity
  | TokenEntity
  | IdentityProviderEntity
  | UserEntity
  | AccessRequestEntity
  | OntologyEntity
  | DomainEntity
  | SavedQueryEntity
  | QueryExecution; // WARNING: order matters here as matched against interface, so DataProduct extends Domain

export type EntityTypesTuple = UnionToTuple<EntityTypes>;

export type EntityIdentifierTypes =
  | AccessRequestIdentifier
  | DataProductIdentifier
  | ApiAccessPolicyIdentifier
  | S3Location
  | ScriptIdentifier
  | AttributePolicyIdentifier
  | GroupIdentifier
  | MachineIdentifier
  | TokenIdentifier
  | IdentityProviderIdentifier
  | UserIdentifier
  | OntologyIdentifier
  | DomainIdentifier
  | SavedQueryIdentifier
  | QueryExecution;

export type Meta<
  TEntityIdentifier extends EntityIdentifierTypes | false = false,
  TEntityType extends EntityTypes | false = false,
  TListType = false,
> = TEntityType extends EntityTypes
  ? TEntityIdentifier extends EntityIdentifierTypes
    ? TEntityType extends TEntityIdentifier
      ? TListType extends false
        ? {
            entityKey: (keyof TEntityIdentifier)[];
            entityIdentifierType: TEntityIdentifier;
            entityType: TEntityType;
          }
        : {
            entityKey: (keyof TEntityIdentifier)[];
            entityIdentifierType: TEntityIdentifier;
            entityType: TEntityType;
            listKey: keyof TListType;
          }
      : never
    : never
  : never;

export const OperationEntityMeta = {
  DataProductDomain: <Meta<DomainIdentifier, DomainEntity, ListDataProductDomainsResponse>>{
    entityKey: ['domainId'],
    listKey: 'domains',
  },

  ApiAccessPolicy: <Meta<ApiAccessPolicyIdentifier, ApiAccessPolicyEntity, ListApiAccessPoliciesResponse>>{
    entityKey: ['apiAccessPolicyId'],
    listKey: 'policies',
  },

  DataProductDomainDataProduct: <
    Meta<DataProductIdentifier, DataProductEntity, ListDataProductDomainDataProductsResponse>
  >{
    entityKey: ['domainId', 'dataProductId'],
    listKey: 'dataProducts',
  },

  DataProductDomainDataProductFileUpload: <Meta<S3Location, S3Location>>{ entityKey: ['bucket', 'key'] },

  DataProductScript: <Meta<ScriptIdentifier, ScriptEntity, ListDataProductScriptsResponse>>{
    entityKey: ['namespace', 'scriptId'],
    listKey: 'scripts',
  },

  // note: this is commented off as the namespaceAndAttributeId is not part of the request and cannot be mapped to the entity for caching
  GovernancePolicyAttributesGroup: <Meta<AttributePolicyIdentifier, AttributePolicyEntity>>{
    entityKey: ['group', 'namespaceAndAttributeId'],
  },

  GovernancePolicyAttributeValuesGroup: <Meta<AttributePolicyIdentifier, AttributeValuePolicyEntity>>{
    entityKey: ['group', 'namespaceAndAttributeId'],
  },

  GovernancePolicyDefaultLensDomainDataProduct: <Meta<DataProductIdentifier, DefaultLensPolicyEntity>>{
    entityKey: ['domainId', 'dataProductId'],
  },

  GovernancePolicyDomainDataProduct: <Meta<DataProductIdentifier, DataProductPolicyEntity>>{
    entityKey: ['domainId', 'dataProductId'],
  },

  IdentityGroup: <Meta<GroupIdentifier, GroupEntity, ListIdentityGroupsResponse>>{
    entityKey: ['groupId'],
    listKey: 'groups',
  },

  IdentityUser: <Meta<UserIdentifier, UserEntity, ListIdentityUsersResponse>>{
    entityKey: ['username'],
    listKey: 'users',
  },

  IdentityMachine: <Meta<MachineIdentifier, MachineEntity, ListIdentityMachinesResponse>>{
    entityKey: ['machineId'],
    listKey: 'machines',
  },

  IdentityMachineToken: <Meta<TokenIdentifier, TokenEntity, ListIdentityMachineTokensResponse>>{
    entityKey: ['machineId', 'tokenId'],
    listKey: 'tokens',
  },

  IdentityRequest: <Meta<AccessRequestIdentifier, AccessRequestEntity, ListIdentityRequestsResponse>>{
    entityKey: ['groupId', 'userId'],
    listKey: 'accessRequests',
  },

  IdentityProvider: <Meta<IdentityProviderIdentifier, IdentityProviderEntity, ListIdentityProvidersResponse>>{
    entityKey: ['identityProviderId'],
    listKey: 'providers',
  },

  Ontology: <Meta<OntologyIdentifier, OntologyEntity, ListOntologiesResponse>>{
    entityKey: ['ontologyNamespace', 'ontologyId'],
    listKey: 'ontologies',
  },

  Query: <Meta<QueryExecution, QueryExecution>>{ entityKey: ['executionId'] },

  QuerySavedQuery: <Meta<SavedQueryIdentifier, SavedQueryEntity, SavedQueryList>>{
    entityKey: ['namespace', 'queryId'],
    listKey: 'queries',
  },

  QueryNamespaceSavedQuery: <Meta<SavedQueryIdentifier, SavedQueryEntity, SavedQueryList>>{
    entityKey: ['namespace', 'queryId'],
    listKey: 'queries',
  },
} as const; // IMPORTANT: must be "const" for typings

export type OperationEntityMeta = typeof OperationEntityMeta; //NOSONAR export type

export type ListOperationEntityMeta = {
  [K in keyof OperationEntityMeta as 'listKey' extends keyof OperationEntityMeta[K]
    ? Pluralize<K>
    : never]: OperationEntityMeta[K];
};

export type ApiOperationEntityMeta = OperationEntityMeta & ListOperationEntityMeta;

export type OperationEntityName = keyof OperationEntityMeta;

/**
 * Pregenerated list of all api operation keys.
 * Enabled constant access on more complex types
 */
type OperationKeyMap = {
  [K in ApiTransformedOperationName]: InterpolateOperationKey<K>;
};

export type OperationKeys = keyof { [K in keyof OperationKeyMap as OperationKeyMap[K]]: true };

type InterpolateOperationKey<
  OperationName extends ApiTransformedOperationName,
  TAction extends string = InferOperationAction<OperationName>,
  TKey extends string = OperationName extends `${TAction}${infer S}` ? S : never,
> = Singularize<TKey> extends OperationEntityName ? Singularize<TKey> : TKey;

export type GetOperationKey<T extends ApiTransformedOperationName> = OperationKeyMap[T];

export type NonEntityOperationKeys = Exclude<OperationKeys, OperationEntityName>;

export type NON_ENTITY_OPERATION = Meta<never, never, never>;

export type ApiOperationMeta = ApiOperationEntityMeta & {
  [key: string]: NON_ENTITY_OPERATION;
};

/**
 * Pregenerated list of all api operation keys mapped to Meta.
 * Enabled constant access on more complex types
 */
type OperationKeyMetaMap = {
  [K in OperationKeys]: K extends keyof OperationEntityMeta ? ApiOperationEntityMeta[K] : never;
};

export type GetOperationMeta<
  OperationName extends ApiTransformedOperationName,
  TOperationKey extends OperationKeys = GetOperationKey<OperationName>,
> = OperationKeyMetaMap[TOperationKey]; // Meta<never, never, never>;

export type IsEntityOperation<
  OperationName extends ApiTransformedOperationName,
  TMeta extends Meta<any, any, any> = GetOperationMeta<OperationName>,
> = TMeta extends Meta<any, infer E, any> ? (Exclude<E, undefined> extends false ? false : true) : false;

export type GetOperationEntity<
  OperationName extends ApiTransformedOperationName,
  TOperationKey extends OperationKeys = GetOperationKey<OperationName>,
> = OperationKeyMetaMap[TOperationKey]['entityType'];

export type GetEntityIdentifier<
  EntityName extends OperationEntityName,
  TMeta = OperationEntityMeta[EntityName],
  TEntityId = 'entityIdentifierType' extends keyof TMeta ? Exclude<TMeta['entityIdentifierType'], undefined> : never,
> = TEntityId;

export type IsListOperation<
  OperationName extends ApiTransformedOperationName,
  TMeta extends Meta<any, any, any> = GetOperationMeta<OperationName>,
> = TMeta extends Meta<any, any, infer L> ? (L extends false ? false : true) : false;

export interface OperationMeta<Name extends ApiTransformedOperationName> {
  name: Name;
  key: GetOperationKey<Name>;
  action: InferOperationAction<Name>;
  type: InferOperationType<Name>;
  entityKey?: GetOperationMeta<Name> extends { entityKey: [...infer T] } ? T : never;
  listKey?: GetOperationMeta<Name> extends { listKey: infer T } ? T : never;
  paginated: IsListOperation<Name>;
}

export interface EntityOperationMeta<Name extends ApiTransformedOperationName> extends OperationMeta<Name> {
  entityKey: Exclude<Required<OperationMeta<Name>>['entityKey'], never>;
}

export function getOperationAction<T extends ApiTransformedOperationName>(operationName: T): InferOperationAction<T> {
  const match = operationName.match(OPERATION_PATTERN);
  if (match == null || match.groups?.action == null)
    throw new Error(`Failed to get action from operation name "${operationName}"`);

  return match.groups?.action as InferOperationAction<T>;
}

/**
 * Returns metadata about the given operation
 * @param operationName the name of the operation
 */
export function getOperationMeta<T extends ApiTransformedOperationName>(operationName: T): OperationMeta<T> {
  const rootMatch = operationName.match(OPERATION_PATTERN);
  if (rootMatch == null || rootMatch.groups == null)
    throw new Error(`Failed to extract action / base from "${operationName}"`);

  const action = rootMatch.groups.action as InferOperationAction<T>;
  const type = (
    MUTATION_ACTIONS.includes(action as any) ? OPERATION_TYPE.MUTATION : OPERATION_TYPE.QUERY
  ) as InferOperationType<T>;

  let base = rootMatch.groups.base;
  const singularBase = pluralize.isPlural(base) ? pluralize.singular(base) : base;
  const meta = OperationEntityMeta[singularBase as keyof OperationEntityMeta] || {};

  if (!isEmpty(meta)) {
    base = singularBase;
  }

  return {
    name: operationName,
    key: base,
    action,
    type,
    ...(meta as any),
    paginated: (action === OPERATION_ACTION.LIST) as any,
  };
}

/**
 * Returns the identifier from the request parameters given an entity key
 * @param entityKey the key(s) in which to look in request parameters for identifier attributes
 * @param requestParameters the query/path parameters for the request
 */
export function getEntityKeyFromParam(entityKey: string[], requestParameters: any) {
  return entityKey.map((v: any) => requestParameters[v]) as [string] | [string, string];
}
