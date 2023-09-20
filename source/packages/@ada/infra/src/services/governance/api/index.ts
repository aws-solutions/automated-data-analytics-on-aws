/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  AttributePolicy,
  AttributePolicyIdentifierList,
  AttributePolicyList,
  AttributeValuePolicy,
  AttributeValuePolicyList,
  DataProductPermissions,
  DataProductPolicy,
  DefaultLensPolicy,
} from './types';
import { AttributeType, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { CountedTable } from '../../../common/constructs/dynamodb/counted-table';
import { CounterTable } from '../../../common/constructs/dynamodb/counter-table';
import { EntityManagementTables } from '../../api/components/entity/constructs/entity-management-tables';
import { InternalTokenKey } from '../../../common/constructs/kms/internal-token-key';
import { JsonSchemaType, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { LensProperty, asEntity, asInput } from '../../../common/constructs/api';
import { MicroserviceApi, MicroserviceApiProps } from '../../../common/services';
import { StatusCodes } from 'http-status-codes/build/cjs';
import { TypescriptFunction } from '@ada/infra-common';
import { getUniqueName } from '@ada/cdk-core';

export interface GovernanceServiceApiProps extends MicroserviceApiProps {
  counterTable: CounterTable;
  internalTokenKey: InternalTokenKey;
  entityManagementTables: EntityManagementTables;
}

export interface BuiltLambdaFunctions {
  putDataProductPolicyLambda: TypescriptFunction;
  getDataProductPolicyLambda: TypescriptFunction;
  getDataProductPolicyPermissionsLambda: TypescriptFunction;
  deleteDataProductPolicyLambda: TypescriptFunction;
  putAttributePolicyLambda: TypescriptFunction;
  batchPutAttributePolicyLambda: TypescriptFunction;
  getAttributePolicyLambda: TypescriptFunction;
  getAttributePoliciesForAttribute: TypescriptFunction;
  getAttributePoliciesForGroup: TypescriptFunction;
  deleteAttributePolicyLambda: TypescriptFunction;
  batchDeleteAttributePolicyLambda: TypescriptFunction;
  putAttributeValuePolicyLambda: TypescriptFunction;
  batchPutAttributeValuePolicyLambda: TypescriptFunction;
  getAttributeValuePolicyLambda: TypescriptFunction;
  getAttributeValuePoliciesForAttribute: TypescriptFunction;
  getAttributeValuePoliciesForGroup: TypescriptFunction;
  deleteAttributeValuePolicyLambda: TypescriptFunction;
  batchDeleteAttributeValuePolicyLambda: TypescriptFunction;
  putDefaultLensPolicyLambda: TypescriptFunction;
  getDefaultLensPolicyLambda: TypescriptFunction;
  deleteDefaultLensPolicyLambda: TypescriptFunction;
}

/**
 * Api construct for governance service
 */
export default class GovernanceApi extends MicroserviceApi {
  public readonly functions: BuiltLambdaFunctions;

  private readonly dataProductPolicyTable: Table;
  private readonly attributePolicyTable: Table;
  private readonly attributeValuePolicyTable: Table;
  private readonly defaultLensPolicyTable: Table;

  private readonly attributePolicyTableNamespaceAndAttributeIdIndexName: string;
  private readonly attributeValuePolicyTableNamespaceAndAttributeIdIndexName: string;

  constructor(scope: Construct, id: string, props: GovernanceServiceApiProps) {
    super(scope, id, props);

    const { counterTable, internalTokenKey, entityManagementTables, federatedApi } = props;

    this.dataProductPolicyTable = new CountedTable(this, 'DataProductPolicyTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'domainId',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'dataProductId',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    this.attributePolicyTable = new CountedTable(this, 'AttributesPolicyTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'group',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'namespaceAndAttributeId',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    this.attributePolicyTableNamespaceAndAttributeIdIndexName = getUniqueName(this, 'AttributesPolicyTable-NamespaceAndAttributeId');

    this.attributePolicyTable.addGlobalSecondaryIndex({
      indexName: this.attributePolicyTableNamespaceAndAttributeIdIndexName,
      partitionKey: { name: 'namespaceAndAttributeId', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    this.attributeValuePolicyTable = new CountedTable(this, 'AttributesValuePolicyTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'group',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'namespaceAndAttributeId',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    this.attributeValuePolicyTableNamespaceAndAttributeIdIndexName = getUniqueName(this, 'AttributeValuePolicyTable-NamespaceAndAttributeId');

    this.attributeValuePolicyTable.addGlobalSecondaryIndex({
      indexName: this.attributeValuePolicyTableNamespaceAndAttributeIdIndexName,
      partitionKey: { name: 'namespaceAndAttributeId', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    this.defaultLensPolicyTable = new CountedTable(this, 'DefaultLensPolicyTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'domainId',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'dataProductId',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    const buildLambda = (handlerFile: string) =>
      new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        package: 'governance-service',
        handlerFile: require.resolve(`./handlers/${handlerFile}`),
        environment: {
          DATA_PRODUCT_POLICY_TABLE_NAME: this.dataProductPolicyTable.tableName,
          ATTRIBUTE_POLICY_TABLE_NAME: this.attributePolicyTable.tableName,
          ATTRIBUTE_VALUE_POLICY_TABLE_NAME: this.attributeValuePolicyTable.tableName,
          DEFAULT_LENS_POLICY_TABLE_NAME: this.defaultLensPolicyTable.tableName,
          ATTRIBUTE_POLICY_TABLE_NAMESPACEANDATTRIBUTE_ID_INDEX_NAME:
            this.attributePolicyTableNamespaceAndAttributeIdIndexName,
          ATTRIBUTE_VALUE_POLICY_TABLE_NAMESPACEANDATTRIBUTE_ID_INDEX_NAME:
            this.attributeValuePolicyTableNamespaceAndAttributeIdIndexName,
        },
        apiLayer: {
          endpoint: federatedApi.url,
        },
        counterTable,
        internalTokenKey,
        entityManagementTables,
      });

    this.functions = this.buildLambdas(buildLambda);

    this.addRoutes();
  }

  private buildLambdas = (buildLambda: (handler: string) => TypescriptFunction): BuiltLambdaFunctions => {
    const putDataProductPolicyLambda = buildLambda('put-data-product-policy');
    this.dataProductPolicyTable.grantReadWriteData(putDataProductPolicyLambda);
    const getDataProductPolicyLambda = buildLambda('get-data-product-policy');
    this.dataProductPolicyTable.grantReadData(getDataProductPolicyLambda);
    const getDataProductPolicyPermissionsLambda = buildLambda('get-data-product-policy-permissions');
    this.dataProductPolicyTable.grantReadData(getDataProductPolicyPermissionsLambda);
    const deleteDataProductPolicyLambda = buildLambda('delete-data-product-policy');
    this.dataProductPolicyTable.grantReadWriteData(deleteDataProductPolicyLambda);

    const putAttributePolicyLambda = buildLambda('put-attribute-policy');
    this.attributePolicyTable.grantReadWriteData(putAttributePolicyLambda);
    const batchPutAttributePolicyLambda = buildLambda('put-attribute-policy-batch');
    this.attributePolicyTable.grantReadWriteData(batchPutAttributePolicyLambda);
    const getAttributePolicyLambda = buildLambda('get-attribute-policy');
    this.attributePolicyTable.grantReadData(getAttributePolicyLambda);
    const getAttributePoliciesForGroup = buildLambda('get-attribute-policies-for-group');
    this.attributePolicyTable.grantReadData(getAttributePoliciesForGroup);
    const deleteAttributePolicyLambda = buildLambda('delete-attribute-policy');
    this.attributePolicyTable.grantReadWriteData(deleteAttributePolicyLambda);
    const batchDeleteAttributePolicyLambda = buildLambda('delete-attribute-policy-batch');
    this.attributePolicyTable.grantReadWriteData(batchDeleteAttributePolicyLambda);

    const putAttributeValuePolicyLambda = buildLambda('put-attribute-value-policy');
    this.attributeValuePolicyTable.grantReadWriteData(putAttributeValuePolicyLambda);
    const batchPutAttributeValuePolicyLambda = buildLambda('put-attribute-value-policy-batch');
    this.attributeValuePolicyTable.grantReadWriteData(batchPutAttributeValuePolicyLambda);
    const getAttributeValuePolicyLambda = buildLambda('get-attribute-value-policy');
    this.attributeValuePolicyTable.grantReadData(getAttributeValuePolicyLambda);
    const getAttributeValuePoliciesForGroup = buildLambda('get-attribute-value-policies-for-group');
    this.attributeValuePolicyTable.grantReadData(getAttributeValuePoliciesForGroup);
    const getAttributeValuePoliciesForAttribute = buildLambda('get-attribute-value-policies-for-attribute');
    this.attributeValuePolicyTable.grantReadData(getAttributeValuePoliciesForAttribute);
    const getAttributePoliciesForAttribute = buildLambda('get-attribute-policies-for-attribute');
    this.attributePolicyTable.grantReadData(getAttributePoliciesForAttribute);
    const deleteAttributeValuePolicyLambda = buildLambda('delete-attribute-value-policy');
    this.attributeValuePolicyTable.grantReadWriteData(deleteAttributeValuePolicyLambda);
    const batchDeleteAttributeValuePolicyLambda = buildLambda('delete-attribute-value-policy-batch');
    this.attributeValuePolicyTable.grantReadWriteData(batchDeleteAttributeValuePolicyLambda);

    const putDefaultLensPolicyLambda = buildLambda('put-default-lens-policy');
    this.defaultLensPolicyTable.grantReadWriteData(putDefaultLensPolicyLambda);
    this.dataProductPolicyTable.grantReadWriteData(putDefaultLensPolicyLambda);
    const getDefaultLensPolicyLambda = buildLambda('get-default-lens-policy');
    this.defaultLensPolicyTable.grantReadData(getDefaultLensPolicyLambda);
    this.dataProductPolicyTable.grantReadData(getDefaultLensPolicyLambda);
    const deleteDefaultLensPolicyLambda = buildLambda('delete-default-lens-policy');
    this.defaultLensPolicyTable.grantReadWriteData(deleteDefaultLensPolicyLambda);
    this.dataProductPolicyTable.grantReadData(deleteDefaultLensPolicyLambda);

    return {
      putDataProductPolicyLambda,
      getDataProductPolicyLambda,
      getDataProductPolicyPermissionsLambda,
      deleteDataProductPolicyLambda,
      putAttributePolicyLambda,
      batchPutAttributePolicyLambda,
      getAttributePolicyLambda,
      getAttributePoliciesForGroup,
      getAttributePoliciesForAttribute,
      deleteAttributePolicyLambda,
      batchDeleteAttributePolicyLambda,
      putAttributeValuePolicyLambda,
      batchPutAttributeValuePolicyLambda,
      getAttributeValuePolicyLambda,
      getAttributeValuePoliciesForAttribute,
      getAttributeValuePoliciesForGroup,
      deleteAttributeValuePolicyLambda,
      batchDeleteAttributeValuePolicyLambda,
      putDefaultLensPolicyLambda,
      getDefaultLensPolicyLambda,
      deleteDefaultLensPolicyLambda,
    };
  };

  private addRoutes() {
    this.api.addRoutes({
      paths: {
        // /goverance/policy
        '/policy': {
          paths: {
            // /goverance/policy/default-lens
            '/default-lens': {
              paths: {
                '/domain': {
                  paths: {
                    '/{domainId}': {
                      paths: {
                        '/data-product': {
                          paths: {
                            '/{dataProductId}': {
                              // GET /goverance/policy/default-lens/domain/{domainId}/data-product/{dataProductId}
                              GET: {
                                integration: new LambdaIntegration(this.functions.getDefaultLensPolicyLambda),
                                response: {
                                  name: 'DefaultLensPolicyGetOutput',
                                  description: 'Get default lens policy by data product id',
                                  schema: asEntity(DefaultLensPolicy),
                                  errorStatusCodes: [
                                    StatusCodes.BAD_REQUEST,
                                    StatusCodes.NOT_FOUND,
                                    StatusCodes.FORBIDDEN,
                                  ],
                                },
                              },
                              // PUT /goverance/policy/default-lens/domain/{domainId}/data-product/{dataProductId}
                              PUT: {
                                integration: new LambdaIntegration(this.functions.putDefaultLensPolicyLambda),
                                request: {
                                  name: 'DefaultLensPolicyInput',
                                  description: 'Details of new default lens policy',
                                  schema: asInput(DefaultLensPolicy, ['defaultLensId', 'defaultLensOverrides']),
                                },
                                response: {
                                  name: 'DefaultLensPolicyPutOutput',
                                  description: 'Create or update new default lens policy by data product id',
                                  schema: asEntity(DefaultLensPolicy),
                                  errorStatusCodes: [
                                    StatusCodes.BAD_REQUEST,
                                    StatusCodes.NOT_FOUND,
                                    StatusCodes.FORBIDDEN,
                                  ],
                                },
                              },
                              // DELETE /goverance/policy/default-lens/domain/{domainId}/data-product/{dataProductId}
                              DELETE: {
                                integration: new LambdaIntegration(this.functions.deleteDefaultLensPolicyLambda),
                                response: {
                                  name: 'DefaultLensPolicyDeleteOutput',
                                  description: 'Delete default lens policy by data product id',
                                  schema: asEntity(DefaultLensPolicy),
                                  errorStatusCodes: [
                                    StatusCodes.BAD_REQUEST,
                                    StatusCodes.NOT_FOUND,
                                    StatusCodes.FORBIDDEN,
                                  ],
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            // /governance/policy/attributes
            '/attributes': {
              // GET /governance/policy/attributes?namespaceAndAttributeIds=attributeId1,attributeId2&group=group
              GET: {
                integration: new LambdaIntegration(this.functions.getAttributePoliciesForGroup),
                requestParameters: {
                  namespaceAndAttributeIds: {
                    required: true,
                    schema: {
                      type: 'array',
                      items: {
                        type: 'string',
                      },
                    },
                  },
                  group: true,
                },
                response: {
                  name: 'AttributePoliciesOutput',
                  description: 'A map of attribute id to the lens id that applies for the given group and attributes',
                  schema: {
                    type: JsonSchemaType.OBJECT,
                    properties: {
                      attributeIdToLensId: {
                        type: JsonSchemaType.OBJECT,
                        additionalProperties: LensProperty,
                      },
                    },
                    required: ['attributeIdToLensId'],
                  },
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
              PUT: {
                integration: new LambdaIntegration(this.functions.batchPutAttributePolicyLambda),
                request: {
                  name: 'BatchPutAttributePolicyInput',
                  description: 'List of attribute policies to write',
                  schema: AttributePolicyList,
                },
                response: {
                  name: 'BatchPutAttributePolicyOutput',
                  description: 'The written attribute policies',
                  schema: AttributePolicyList,
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
                },
              },
              DELETE: {
                integration: new LambdaIntegration(this.functions.batchDeleteAttributePolicyLambda),
                request: {
                  name: 'BatchDeleteAttributePolicyInput',
                  description: 'List of attribute policies to delete',
                  schema: AttributePolicyIdentifierList,
                },
                response: {
                  name: 'BatchDeleteAttributePolicyOutput',
                  description: 'The deleted attribute policies',
                  schema: AttributePolicyList,
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
                },
              },
              paths: {
                '/{ontologyNamespace}': {
                  paths: {
                    '/{attributeId}': {
                      // GET /governance/policy/attributes/{ontologyNamespace}/{attributeId}
                      paths: {
                        // 
                        'attribute': {
                          GET: {
                            integration: new LambdaIntegration(this.functions.getAttributePoliciesForAttribute),
                            response: {
                              name: 'AttributePoliciesForAttributeOutput',
                              description: 'A list of attributes for the given attributes',
                              schema: AttributePolicyList,
                              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                            },
                          },
                        },
                        // /governance/policy/attributes/{ontologyNamespace}/{attributeId}/group
                        '/group': {
                          paths: {
                            // /governance/policy/attributes/{ontologyNamespace}/{attributeId}/group/{group}
                            '/{group}': {
                              // PUT /governance/policy/attributes/{ontologyNamespace}/{attributeId}/group/{group}
                              PUT: {
                                integration: new LambdaIntegration(this.functions.putAttributePolicyLambda),
                                request: {
                                  name: 'AttributePolicyInput',
                                  description: 'Details of new Attribute Policy',
                                  schema: asInput(AttributePolicy, ['lensId']),
                                },
                                response: {
                                  name: 'AttributePolicyOutput',
                                  description: 'Create or update new attribute policy',
                                  schema: asEntity(AttributePolicy),
                                  errorStatusCodes: [
                                    StatusCodes.BAD_REQUEST,
                                    StatusCodes.NOT_FOUND,
                                    StatusCodes.FORBIDDEN,
                                  ],
                                },
                              },
                              // GET /governance/policy/attributes/{ontologyNamespace}/{attributeId}/group/{group}
                              GET: {
                                integration: new LambdaIntegration(this.functions.getAttributePolicyLambda),
                                response: {
                                  name: 'AttributePolicyGetOutput',
                                  description: 'The attribute policy for the given group and attribute id',
                                  schema: asEntity(AttributePolicy),
                                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
                                },
                              },
                              // DELETE /governance/policy/attributes/{ontologyNamespace}/{attributeId}/group/{group}
                              DELETE: {
                                integration: new LambdaIntegration(this.functions.deleteAttributePolicyLambda),
                                response: {
                                  name: 'AttributePolicyDeleteOutput',
                                  description: 'The attribute policy that was deleted',
                                  schema: asEntity(AttributePolicy),
                                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            // /governance/policy/attribute-values
            '/attribute-values': {
              // GET /governance/policy/attribute-values?namespaceAndAttributeIds=attributeId1,attributeId2&group=group
              GET: {
                integration: new LambdaIntegration(this.functions.getAttributeValuePoliciesForGroup),
                requestParameters: {
                  namespaceAndAttributeIds: {
                    required: true,
                    schema: {
                      type: 'array',
                      items: {
                        type: 'string',
                      },
                    },
                  },
                  group: true,
                },
                response: {
                  name: 'AttributeValuePoliciesOutput',
                  description: 'The attribute value policies discovered from the given attributesId and group',
                  schema: {
                    type: JsonSchemaType.OBJECT,
                    properties: {
                      attributeIdToSqlClause: {
                        type: JsonSchemaType.OBJECT,
                        additionalProperties: {
                          type: JsonSchemaType.STRING,
                          description: 'The sql clause to apply for the attribute',
                        },
                      },
                    },
                    required: ['attributeIdToSqlClause'],
                  },
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
              PUT: {
                integration: new LambdaIntegration(this.functions.batchPutAttributeValuePolicyLambda),
                request: {
                  name: 'BatchPutAttributeValuePolicyInput',
                  description: 'List of attribute value policies to write',
                  schema: AttributeValuePolicyList,
                },
                response: {
                  name: 'BatchPutAttributeValuePolicyOutput',
                  description: 'The written attribute value policies',
                  schema: AttributeValuePolicyList,
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
                },
              },
              DELETE: {
                integration: new LambdaIntegration(this.functions.batchDeleteAttributeValuePolicyLambda),
                request: {
                  name: 'BatchDeleteAttributeValuePolicyInput',
                  description: 'List of attribute value policies to delete',
                  schema: AttributePolicyIdentifierList,
                },
                response: {
                  name: 'BatchDeleteAttributeValuePolicyOutput',
                  description: 'The deleted attribute value policies',
                  schema: AttributeValuePolicyList,
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
                },
              },
              paths: {
                '/{ontologyNamespace}': {
                  paths: {
                    // /governance/policy/attribute-values/{ontologyNamespace}/{attributeId}
                    '/{attributeId}': {
                      paths: {
                        // /governance/policy/attribute-values/{ontologyNamespace}/{attributeId}/attribute
                        'attribute': {
                          GET: {
                            integration: new LambdaIntegration(this.functions.getAttributeValuePoliciesForAttribute),
                            response: {
                              name: 'AttributeValuePoliciesForAttributeOutput',
                              description: 'A list of attribute values for the given attribute',
                              schema: AttributeValuePolicyList,
                              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                            },
                          },
                        },
                        // /governance/policy/attribute-values/{ontologyNamespace}/{attributeId}/group
                        '/group': {
                          paths: {
                            // /governance/policy/attribute-values/{ontologyNamespace}/{attributeId}/group/{group}
                            '/{group}': {
                              // PUT /governance/policy/attribute-values/{ontologyNamespace}/{attributeId}/group/{group}
                              PUT: {
                                integration: new LambdaIntegration(this.functions.putAttributeValuePolicyLambda),
                                request: {
                                  name: 'AttributeValuePolicyInput',
                                  description: 'Details of new Attribute Value Policy',
                                  schema: asInput(AttributeValuePolicy, ['sqlClause']),
                                },
                                response: {
                                  name: 'AttributeValuePolicyOutput',
                                  description: 'Create or update new attribute value policy',
                                  schema: asEntity(AttributeValuePolicy),
                                  errorStatusCodes: [
                                    StatusCodes.BAD_REQUEST,
                                    StatusCodes.NOT_FOUND,
                                    StatusCodes.FORBIDDEN,
                                  ],
                                },
                              },
                              // GET /governance/policy/attribute-values/{ontologyNamespace}/{attributeId}/group/{group}
                              GET: {
                                integration: new LambdaIntegration(this.functions.getAttributeValuePolicyLambda),
                                response: {
                                  name: 'AttributeValuePolicyGetOutput',
                                  description: 'The attribute value policy for the given attribute id and group',
                                  schema: asEntity(AttributeValuePolicy),
                                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
                                },
                              },
                              // DELETE /governance/policy/attribute-values/{ontologyNamespace}/{attributeId}/group/{group}
                              DELETE: {
                                integration: new LambdaIntegration(this.functions.deleteAttributeValuePolicyLambda),
                                response: {
                                  name: 'AttributeValuePolicyDeleteOutput',
                                  description: 'The attribute policy that was deleted',
                                  schema: asEntity(AttributeValuePolicy),
                                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            // /governance/policy/domain
            '/domain': {
              paths: {
                // /governance/policy/domain/{domainId}
                '/{domainId}': {
                  paths: {
                    // /governance/policy/domain/{domainId}/data-product
                    '/data-product': {
                      paths: {
                        // /governance/policy/domain/{domainId}/data-product/{dataProductId}
                        '/{dataProductId}': {
                          // GET /governance/policy/domain/{domainId}/data-product/{dataProductId}
                          GET: {
                            integration: new LambdaIntegration(this.functions.getDataProductPolicyLambda),
                            response: {
                              name: 'GetDataProductPolicyOutput',
                              description: 'Get a policy for a data product',
                              schema: asEntity(DataProductPolicy),
                              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                            },
                          },
                          // PUT /governance/policy/domain/{domainId}/data-product/{dataProductId}
                          PUT: {
                            integration: new LambdaIntegration(this.functions.putDataProductPolicyLambda),
                            request: {
                              name: 'PutDataProductPolicyInput',
                              description: 'Details of new data product policy',
                              schema: asInput(DataProductPolicy, ['permissions']),
                            },
                            response: {
                              name: 'PutDataProductPolicyOutput',
                              description: 'Create or update new data product policy by dataProductId',
                              schema: asEntity(DataProductPolicy),
                              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                            },
                          },
                          // DELETE /governance/policy/domain/{domainId}/data-product/{dataProductId}
                          DELETE: {
                            integration: new LambdaIntegration(this.functions.deleteDataProductPolicyLambda),
                            response: {
                              name: 'DeleteDataProductPolicyOutput',
                              description: 'Delete data product policy',
                              schema: asEntity(DataProductPolicy),
                              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                            },
                          },
                          paths: {
                            // GET /governance/policy/domain/{domainid}/data-product/{dataProductId}/permissions?groups={group}
                            '/permissions': {
                              GET: {
                                integration: new LambdaIntegration(
                                  this.functions.getDataProductPolicyPermissionsLambda,
                                ),
                                requestParameters: {
                                  groups: {
                                    required: true,
                                    schema: {
                                      type: 'array',
                                      items: {
                                        type: 'string',
                                      },
                                    },
                                  },
                                },
                                response: {
                                  name: 'GetDataProductPolicyPermissionsOutput',
                                  description: 'Get permissions for a group and associated data product policy',
                                  schema: asEntity(DataProductPermissions),
                                  errorStatusCodes: [
                                    StatusCodes.BAD_REQUEST,
                                    StatusCodes.NOT_FOUND,
                                    StatusCodes.FORBIDDEN,
                                  ],
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}
