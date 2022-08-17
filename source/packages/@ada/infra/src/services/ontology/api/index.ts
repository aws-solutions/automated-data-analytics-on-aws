/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as mocks from './mocks';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { CountedTable } from '../../../common/constructs/dynamodb/counted-table';
import { CounterTable } from '../../../common/constructs/dynamodb/counter-table';
import { EntityManagementTables } from '../../api/components/entity/constructs/entity-management-tables';
import { InternalTokenKey } from '../../../common/constructs/kms/internal-token-key';
import { JsonSchemaType, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { MicroserviceApi, MicroserviceApiProps } from '../../../common/services';
import { Ontology } from './types';
import { OntologyNamespace } from '@ada/common';
import { StatusCodes } from 'http-status-codes/build/cjs';
import { TypescriptFunction } from '@ada/infra-common';
import { asEntity, asInput } from '../../../common/constructs/api';
import { defaultPiiOntologies } from '../../../common/services/types/ontology';
import { successMockIntegration } from '../../../utils/api';
import InvokeMicroserviceLambda from '../../../common/constructs/api/invoke-microservice-lambda';

export interface OntologyApiProps extends MicroserviceApiProps {
  counterTable: CounterTable;
  internalTokenKey: InternalTokenKey;
  entityManagementTables: EntityManagementTables;
}

/**
 * Ontology service api
 */
export default class OntologyApi extends MicroserviceApi {
  readonly listOntologiesLambda: TypescriptFunction;
  readonly getOntologyLambda: TypescriptFunction;
  readonly putOntologyLambda: TypescriptFunction;
  readonly deleteOntologyLambda: TypescriptFunction;

  constructor(scope: Construct, id: string, props: OntologyApiProps) {
    super(scope, id, props);

    const { counterTable, internalTokenKey, entityManagementTables, federatedApi } = props;

    // Stores details about an ontology attribute
    const ontologyTable = new CountedTable(this, 'OntologyAttributesTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'ontologyNamespace',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'ontologyId',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    // Stores a mapping of alias to ontology attribute for quick lookup in GET /ontology/findByAlias
    const aliasToOntologyAttributeTable = new CountedTable(this, 'AliasToOntologyAttributeTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'alias',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    // Utility method for lambda handlers
    const buildLambda = (handlerFile: string) =>
      new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        package: 'ontology-service',
        handlerFile: require.resolve(`./handlers/${handlerFile}`),
        environment: {
          ONTOLOGY_TABLE_NAME: ontologyTable.tableName,
          ALIAS_TO_ONTOLOGY_TABLE_NAME: aliasToOntologyAttributeTable.tableName,
        },
        apiLayer: {
          endpoint: federatedApi.url,
        },
        counterTable,
        internalTokenKey,
        entityManagementTables,
      });

    this.listOntologiesLambda = buildLambda('list-ontology');
    ontologyTable.grantReadData(this.listOntologiesLambda);

    this.getOntologyLambda = buildLambda('get-ontology');
    ontologyTable.grantReadData(this.getOntologyLambda);

    this.putOntologyLambda = buildLambda('put-ontology');
    ontologyTable.grantReadWriteData(this.putOntologyLambda);
    aliasToOntologyAttributeTable.grantReadWriteData(this.putOntologyLambda);

    this.deleteOntologyLambda = buildLambda('delete-ontology');
    ontologyTable.grantReadWriteData(this.deleteOntologyLambda);
    aliasToOntologyAttributeTable.grantReadWriteData(this.deleteOntologyLambda);

    this.addRoutes();
  }

  private addRoutes() {
    this.api.addRoutes({
      // GET /ontology
      GET: {
        integration: new LambdaIntegration(this.listOntologiesLambda),
        paginated: true,
        response: {
          name: 'GetOntologiesOutput',
          description: 'The list of all ontologies',
          schema: {
            type: JsonSchemaType.OBJECT,
            properties: {
              ontologies: {
                type: JsonSchemaType.ARRAY,
                items: asEntity(Ontology),
              },
            },
            required: ['ontologies'],
          },
          errorStatusCodes: [StatusCodes.BAD_REQUEST],
        },
      },
      paths: {
        '/{ontologyNamespace}': {
          paths: {
            '/{ontologyId}': {
              // GET /ontology/{ontologyNamespace}/{ontologyId}
              GET: {
                integration: new LambdaIntegration(this.getOntologyLambda),
                response: {
                  name: 'GetOntologyOutput',
                  description: 'The ontology with the given id',
                  schema: asEntity(Ontology),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
                },
              },
              // DELETE /ontology/{ontologyNamespace}/{ontologyId}
              DELETE: {
                integration: new LambdaIntegration(this.deleteOntologyLambda),
                response: {
                  name: 'DeleteOntologyOutput',
                  description: 'The ontology that was deleted',
                  schema: asEntity(Ontology),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
              // PUT /ontology/{ontologyNamespace}/{ontologyId}
              PUT: {
                integration: new LambdaIntegration(this.putOntologyLambda),
                request: {
                  name: 'PutOntologyInput',
                  description: 'Details about the new ontology',
                  schema: asInput(Ontology, ['name', 'aliases']),
                },
                response: {
                  name: 'PutOntologyOutput',
                  description: 'The created/updated ontology',
                  schema: asEntity(Ontology),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
            },
          },
        },
        // /ontology/findByAlias
        '/findByAlias': {
          // GET /ontology/findByAlias
          GET: {
            integration: successMockIntegration({
              aliases: {
                email_address: mocks.MOCK_ONTOLOGY,
              },
              nextToken: 'abc123',
            }),
            paginated: true,
            requestParameters: {
              aliases: true,
            },
            response: {
              name: 'FindOntologiesByAliasOutput',
              description: 'The matching ontology for each given alias',
              schema: {
                type: JsonSchemaType.OBJECT,
                properties: {
                  aliases: {
                    type: JsonSchemaType.OBJECT,
                    description: 'A map of alias to the matching ontology attribute',
                    additionalProperties: asEntity(Ontology),
                  },
                },
                required: ['aliases'],
              },
              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
            },
          },
        },
      },
    });

    InvokeMicroserviceLambda.makeSequential(defaultPiiOntologies.map((pii) => {
      return new InvokeMicroserviceLambda(this, `PiiOntologies-${pii.name}`, {
        lambda: this.putOntologyLambda,
        pathParameters: { ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS, ontologyId: pii.ontologyId },
        body: pii,
      });
    }));
  }
}
