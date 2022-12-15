/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as Connectors from '@ada/connectors';
import { COMMON_CLIENT_FIELD_DEFAULTS } from '$views/identity-provider/components/IdpWizard/schema/provider-types/common';
import {
  ColumnsMetadata,
  CreateAndUpdateDetails,
  DataProductEntity,
  DataProductPolicy,
  DataSet,
  DefaultLensPolicy,
  DomainEntity,
  GroupEntity,
  IdentityProviderEntity,
  OntologyEntity,
  QueryExecution,
  QueryResult,
  QueryResultColumnMetadata,
  QueryResultData,
  UserEntity,
} from '@ada/api';
import {
  DataProductAccess,
  DataProductDataStatus,
  DataProductInfrastructureStatus,
  DataProductUpdateTriggerType,
  DataSetIds,
  DefaultGroupIds,
  LensIds,
  OIDCProvider,
  OntologyNamespace,
  ROOT_ADMIN_ID,
  SAMLProvider,
} from '@ada/common';
import { DataProductWithCreateAndUpdateDetails } from '$api/data-product';
import { SYSTEM_USER, TEST_USER } from '$common/entity/user';
import { startCase } from 'lodash';

export * from './data-product/preview';

export * from './notifications';

export * from './api-access-policies';

/// ///////////////////////////////////////////////
// Common
/// ///////////////////////////////////////////////
export const CREATED_TIMESTAMP = '2021-02-01T00:00:00Z';

export const UPDATED_TIMESTAMP = '2021-01-01T00:00:00Z';

export const ENTITY_CRUD: Required<CreateAndUpdateDetails> = {
  createdBy: TEST_USER.id,
  createdTimestamp: CREATED_TIMESTAMP,
  updatedBy: TEST_USER.id,
  updatedTimestamp: UPDATED_TIMESTAMP,
};

export const ROOT_ENTITY_CRUD: Required<CreateAndUpdateDetails> = {
  createdBy: ROOT_ADMIN_ID,
  createdTimestamp: CREATED_TIMESTAMP,
  updatedBy: ROOT_ADMIN_ID,
  updatedTimestamp: UPDATED_TIMESTAMP,
};

export const SYSTEN_ENTITY_CRUD: Required<CreateAndUpdateDetails> = {
  createdBy: SYSTEM_USER,
  createdTimestamp: CREATED_TIMESTAMP,
  updatedBy: SYSTEM_USER,
  updatedTimestamp: UPDATED_TIMESTAMP,
};

/// ///////////////////////////////////////////////
// Users
/// ///////////////////////////////////////////////
export const USER_ENTITY: UserEntity = {
  ...TEST_USER,
  username: TEST_USER.id,
};

export const USERS = [USER_ENTITY];

/// ///////////////////////////////////////////////
// Groups
/// ///////////////////////////////////////////////
export const GROUP_SYSTEM_DEFAULT: GroupEntity = {
  groupId: DefaultGroupIds.DEFAULT,
  description: 'Default users group',
  claims: [],
  members: [TEST_USER.id],
  apiAccessPolicyIds: [],
  createdBy: SYSTEM_USER,
  autoAssignUsers: false,
};

export const GROUP_SYSTEM_POWER: GroupEntity = {
  groupId: DefaultGroupIds.POWER_USER,
  description: 'Power users group',
  claims: [],
  members: [TEST_USER.id],
  apiAccessPolicyIds: [],
  createdBy: SYSTEM_USER,
  autoAssignUsers: false,
};

export const GROUP_SYSTEM_ADMIN: GroupEntity = {
  groupId: DefaultGroupIds.ADMIN,
  description: 'Admin users group',
  claims: [],
  members: [TEST_USER.id],
  apiAccessPolicyIds: [],
  createdBy: SYSTEM_USER,
  autoAssignUsers: false,
};

export const GROUP_CUSTOM_1: GroupEntity = {
  groupId: 'group-1',
  description: 'Custom group one',
  claims: [],
  members: [TEST_USER.id],
  apiAccessPolicyIds: [],
  createdBy: TEST_USER.id,
};

export const GROUP_CUSTOM_2: GroupEntity = {
  groupId: 'group-2',
  description: 'Custom group two',
  claims: [],
  members: [TEST_USER.id],
  apiAccessPolicyIds: [],
  createdBy: TEST_USER.id,
};

export const GROUPS = [GROUP_SYSTEM_DEFAULT, GROUP_SYSTEM_POWER, GROUP_SYSTEM_ADMIN, GROUP_CUSTOM_1, GROUP_CUSTOM_2];

/// ///////////////////////////////////////////////
// Domains
/// ///////////////////////////////////////////////
export const DOMAIN: DomainEntity = {
  domainId: 'domain1',
  name: 'Test',
  description: 'Test domain',
};

export const DOMAINS = [DOMAIN];

/// ///////////////////////////////////////////////
// Governance
/// ///////////////////////////////////////////////
export const ONTOLOGY_PII_LOCATION: OntologyEntity = {
  createdBy: SYSTEM_USER,
  createdTimestamp: '2021-01-01T00:00:00Z',
  updatedTimestamp: '2021-01-01T00:00:00Z',
  ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS,
  ontologyId: 'location',
  name: 'Location',
  description: 'PII location',
  aliases: [{ name: 'address' }],
  defaultLens: LensIds.HASHED,
};

export const ONTOLOGY_PII_PHONENUMBER: OntologyEntity = {
  createdBy: SYSTEM_USER,
  createdTimestamp: '2021-01-01T00:00:00Z',
  updatedTimestamp: '2021-01-01T00:00:00Z',
  ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS,
  ontologyId: 'phone-number',
  name: 'PhoneNumber',
  aliases: [{ name: 'phone_number' }],
  defaultLens: LensIds.HASHED,
};

export const ONTOLOGY_CUSTOM_NAME: OntologyEntity = {
  createdBy: ROOT_ADMIN_ID,
  createdTimestamp: '2021-01-01T00:00:00Z',
  updatedTimestamp: '2021-01-01T00:00:00Z',
  ontologyNamespace: 'custom',
  ontologyId: 'name',
  name: 'Name',
  aliases: [],
};

export const ONTOLOGY_NEW: Required<OntologyEntity> = {
  createdBy: ROOT_ADMIN_ID,
  createdTimestamp: '2021-01-01T00:00:00Z',
  updatedBy: ROOT_ADMIN_ID,
  updatedTimestamp: '2021-01-01T00:00:00Z',
  ontologyNamespace: 'new_ns',
  ontologyId: 'new_attribute',
  name: 'New Attribute',
  aliases: [{ name: 'new' }, { name: 'not_old' } ],
  defaultLens: 'hashed',
  description: 'This is new attribute',
};

export const ONTOLOGIES = [ONTOLOGY_PII_LOCATION, ONTOLOGY_PII_PHONENUMBER, ONTOLOGY_CUSTOM_NAME];

/// ///////////////////////////////////////////////
// Data Sets
/// ///////////////////////////////////////////////
export const DATA_SET_1: DataSet = {
  identifiers: {
    catalog: 'catalog',
    database: 'database',
    table: 'dataSet1',
  },
  columnMetadata: {
    name: {
      dataType: 'string',
    },
    phone_number: {
      dataType: 'string',
      ontologyAttributeId: ONTOLOGY_PII_PHONENUMBER.ontologyId,
      ontologyNamespace: ONTOLOGY_PII_PHONENUMBER.ontologyNamespace,
    },
  },
} as const;

export const DATA_SET_2: DataSet = {
  identifiers: {
    catalog: 'catalog',
    database: 'database',
    table: 'dataSet2',
  },
  columnMetadata: {
    address: {
      dataType: 'string',
      ontologyAttributeId: ONTOLOGY_PII_LOCATION.ontologyId,
      ontologyNamespace: ONTOLOGY_PII_LOCATION.ontologyNamespace,
    },
    age: {
      dataType: 'int',
    },
  },
} as const;

/// ///////////////////////////////////////////////
// DataProducts
/// ///////////////////////////////////////////////
export const DATA_PRODUCT: DataProductEntity = {
  domainId: DOMAIN.domainId,
  dataProductId: 'the_data_product',
  name: 'The Data Product',
  description: 'The data product description',
  dataStatus: DataProductDataStatus.READY,
  infrastructureStatus: DataProductInfrastructureStatus.READY,
  createdBy: 'creator',
  createdTimestamp: '2021-01-01T00:00:00Z',
  updatedBy: 'updater',
  updatedTimestamp: '2021-01-01T00:00:01Z',
  sourceType: Connectors.AmazonS3.ID,
  sourceDetails: { bucket: 'bucket', key: 'key' },
  dataSets: {
    [DataSetIds.DEFAULT]: DATA_SET_1,
    dataSet2: DATA_SET_2,
  },
  tags: [],
  updateTrigger: { triggerType: DataProductUpdateTriggerType.AUTOMATIC },
  transforms: [],
  parentDataProducts: [],
  childDataProducts: [],
};

export const DATA_PRODUCT_WITH_ONE_DATASET: DataProductWithCreateAndUpdateDetails = {
  ...DATA_PRODUCT,
  dataProductId: 'dataProduct2',
  dataSets: {
    [DataSetIds.DEFAULT]: DATA_SET_2,
  },
};

export const DATA_PRODUCTS = [DATA_PRODUCT, DATA_PRODUCT_WITH_ONE_DATASET];

export const DATA_PRODUCT_POLICY: DataProductPolicy = {
  domainId: DOMAIN.domainId,
  dataProductId: DATA_PRODUCT.dataProductId,
  permissions: {
    admin: {
      access: DataProductAccess.FULL,
    },
  },
};

export const DATA_PRODUCT_POLICIES = [DATA_PRODUCT_POLICY];

export const DEFAULT_LENS: DefaultLensPolicy = {
  domainId: DOMAIN.domainId,
  dataProductId: DATA_PRODUCT.dataProductId,
  defaultLensId: LensIds.CLEAR,
  defaultLensOverrides: {
    [DefaultGroupIds.DEFAULT]: LensIds.HIDDEN,
  },
};

/// ///////////////////////////////////////////////
// IdenittyProviders
/// ///////////////////////////////////////////////
export const IDENTITY_PROVIDER_OIDC: IdentityProviderEntity = {
  ...ROOT_ENTITY_CRUD,
  identityProviderId: 'oidc-provider',
  name: 'Mock OIDC',
  type: 'OIDC',
  description: 'Test OIDC description',
  enabled: true,
  details: {
    clientId: 'test-client-id',
    issuer: 'https://example.com',
    authorizeUrl: 'https://example.com/authorize',
    tokenUrl: 'https://example.com/token',
    jwksUri: 'https://example.com/jwks',
    attributesUrl: 'https://example.com/users',
    scopes: COMMON_CLIENT_FIELD_DEFAULTS.scopes,
    attributeRequestMethod: 'POST',
  } as Partial<OIDCProvider>,
};

export const IDENTITY_PROVIDER_SAML: IdentityProviderEntity = {
  ...ROOT_ENTITY_CRUD,
  type: 'SAML',
  identityProviderId: 'saml-provider',
  description: 'Test SAML description',
  name: 'Mock SAML',
  enabled: false,
  attributeMapping: {
    Username: 'sub',
  },
  details: {
    metadataURL: 'https://metadata.example.com',
    signOut: true,
  } as SAMLProvider,
};

export const IDENTITY_PROVIDERS = [IDENTITY_PROVIDER_OIDC, IDENTITY_PROVIDER_SAML];

/// ///////////////////////////////////////////////
// Query
/// ///////////////////////////////////////////////
export const QUERY_EXECUTION_ID = 'mock-execution-id';

export const QUERY_EXECUTION: QueryExecution = {
  executionId: QUERY_EXECUTION_ID,
};

export const QUERY_EXECUTION_RESULT: QueryResult = {
  columns: columnsMetadataToQueryColumns(DATA_SET_1.columnMetadata),
  data: columnsMetadataToQueryResults(DATA_SET_1.columnMetadata),
  dataIntegrity: 'current',
};

/// ///////////////////////////////////////////////
// Helpers
/// ///////////////////////////////////////////////
function columnsMetadataToQueryColumns(columnMetadata: ColumnsMetadata): QueryResultColumnMetadata[] {
  return Object.entries(columnMetadata).map(([name, column]) => ({
    name,
    type: column.dataType,
    label: startCase(name),
  }));
}

function columnsMetadataToQueryResults(columnMetadata: ColumnsMetadata, count = 10): QueryResultData[] {
  const columns = columnsMetadataToQueryColumns(columnMetadata);

  return Array.from(Array(count)).map((v, i) => {
    return columns.reduce((row, column) => {
      row[column.name] = `${i}_${column.name}`;
      return row;
    }, {} as any);
  });
}
