/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* eslint quote-props: off */
import { Construct } from 'constructs';
import { CounterTable } from '../../../common/constructs/dynamodb/counter-table';
import { DataProduct, DataProductPreview, DataProductPreviewIdentifier } from './types';
import { EntityManagementTables } from '../../api/components/entity/constructs/entity-management-tables';
import { InternalTokenKey } from '../../../common/constructs/kms/internal-token-key';
import { Key } from 'aws-cdk-lib/aws-kms';
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { MicroserviceApi, MicroserviceApiProps } from '@ada/microservice-common';
import { NotificationBus } from '../../api/components/notification/constructs/bus';
import { StatusCodes } from 'http-status-codes/build/cjs';
import { TypescriptFunction, TypescriptFunctionProps } from '@ada/infra-common';
import { asNonEntityInput } from '../../../common/constructs/api';
import SchemaPreview from '../components/schema-preview';

export interface SchemaPreviewApiProps extends MicroserviceApiProps {
  readonly schemaPreview: SchemaPreview;
  readonly productPreviewKey: Key;
  readonly counterTable: CounterTable;
  readonly notificationBus: NotificationBus;
  readonly internalTokenKey: InternalTokenKey;
  readonly entityManagementTables: EntityManagementTables;
}

export interface BuiltLambdaFunctions {
  postDataProductPreviewLambda: TypescriptFunction;
  getDataProductPreviewLambda: TypescriptFunction;
}

/**
 * Api construct for data product schema preview
 */
export default class SchemaPreviewApi extends MicroserviceApi {
  public readonly functions: BuiltLambdaFunctions;

  constructor(scope: Construct, id: string, props: SchemaPreviewApiProps) {
    super(scope, id, props);

    const buildLambdaHandler = (handlerFile: string, additionalProps?: Partial<TypescriptFunctionProps>) =>
      new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        package: 'data-product-service',
        handlerFile: require.resolve(`./handlers/${handlerFile}`),
        environment: {
          DATA_PRODUCT_PREVIEW_STATE_MACHINE_ARN: props.schemaPreview.stateMachine.stateMachineArn,
          KEY_ID: props.productPreviewKey.keyId,
        },
        apiLayer: {
          endpoint: props.federatedApi.url,
        },
        notificationBus: props.notificationBus,
        counterTable: props.counterTable,
        internalTokenKey: props.internalTokenKey,
        entityManagementTables: props.entityManagementTables,
        ...additionalProps,
      });

    this.functions = this.buildLambdas(buildLambdaHandler, props);

    this.addRoutes();
  }

  private buildLambdas = (
    buildLambda: (handler: string, additionalProps?: Partial<TypescriptFunctionProps>) => TypescriptFunction,
    props: SchemaPreviewApiProps,
  ): BuiltLambdaFunctions => {
    const postDataProductPreviewLambda = buildLambda('post-data-product-preview');
    props.schemaPreview.stateMachine.grantStartExecution(postDataProductPreviewLambda);
    props.productPreviewKey.grantEncrypt(postDataProductPreviewLambda);

    const getDataProductPreviewLambda = buildLambda('get-data-product-preview');
    props.schemaPreview.stateMachine.grantRead(getDataProductPreviewLambda);
    props.schemaPreview.bucket.grantRead(getDataProductPreviewLambda);

    return {
      postDataProductPreviewLambda,
      getDataProductPreviewLambda,
    };
  };

  private addRoutes() {
    this.api.addRoutes({
      paths: {
        // /data-product-preview/domain
        '/domain': {
          paths: {
            // /data-product-preview/domain/{domainId}
            '/{domainId}': {
              // PUT /data-product-preview/domain/{domainId}
              paths: {
                // /data-product-preview/domain/{domainId}/data-product
                '/data-product': {
                  // GET /data-product-preview/domain/{domainId}/data-product
                  paths: {
                    // /data-product-preview/domain/{domainId}/data-product/{dataProductId}
                    '/{dataProductId}': {
                      POST: {
                        integration: new LambdaIntegration(this.functions.postDataProductPreviewLambda),
                        requestParameters: {
                          sampleSize: {
                            required: false,
                            schema: {
                              type: 'integer',
                            },
                          },
                        },
                        request: {
                          name: 'PostDataProductPreviewInput',
                          description: 'Details about the data product to preview',
                          schema: asNonEntityInput(DataProduct, ['sourceType', 'transforms'], false, 'Preview'),
                        },
                        response: {
                          name: 'PostDataProductPreviewOutput',
                          description: 'An execution id for tracking the preview of a data product',
                          schema: DataProductPreviewIdentifier,
                          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
                        },
                      },
                      paths: {
                        '/{previewId}': {
                          GET: {
                            integration: new LambdaIntegration(this.functions.getDataProductPreviewLambda),
                            response: {
                              name: 'GetDataProductPreviewStatusOutput',
                              description: 'The data product preview, or just its status if the preview is ongoing',
                              schema: DataProductPreview,
                              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
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
