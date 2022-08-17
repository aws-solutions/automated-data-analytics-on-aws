/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { AthenaQueryExecutionState } from '@ada/common';
import { DEFAULT_S3_SOURCE_DATA_PRODUCT, apiGatewayEvent } from '@ada/infra-common/services/testing';
import { DataProduct } from '@ada/api-client';
import { apiClientErrorResponse } from '@ada/api/client/mock';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { calculateTimeout, handler } from '../get-schema';

jest.mock('@ada/api-client');

const mockStartQueryExecution = jest.fn();
const mockGetQueryExecution = jest.fn();
const mockGetObject = jest.fn();

// @ts-ignore mock the timer to avoid timeouts
calculateTimeout = jest.fn();

jest.mock('@ada/microservice-common', () => ({
  ...(jest.requireActual('@ada/microservice-common') as any),
  sendRequest: jest.fn(),
}));

const getDataProductResponse: DataProduct = {
  ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
  dataSets: {
    myDataSet: {
      columnMetadata: {},
      identifiers: {
        catalog: 'AwsDataCatalog',
        database: 'default',
        table: 'test',
      },
    },
  },
};

const getDataProductMultipleDatasetResponse: DataProduct = {
  ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
  dataSets: {
    myDataSet: {
      columnMetadata: {},
      identifiers: {
        catalog: 'AwsDataCatalog',
        database: 'default',
        table: 'test',
      },
    },
    secondDataSet: {
      columnMetadata: {},
      identifiers: {
        catalog: 'AwsDataCatalog',
        database: 'default',
        table: 'second-test',
      },
    },
  },
};

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsStepFunctionsInstance: jest.fn(),
  AwsAthenaInstance: jest.fn().mockImplementation(() => ({
    startQueryExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockStartQueryExecution(...args))),
    }),
    getQueryExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetQueryExecution(...args))),
    }),
  })),
  AwsS3Instance: jest.fn().mockImplementation(() => ({
    getObject: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetObject(...args))),
    }),
  })),
}));

// Helper method for calling the handler
const getSchemaHandler = (
  domainId: string,
  dataProductId: string,
  dataSetId?: string,
): Promise<APIGatewayProxyResult> =>
  handler(
    apiGatewayEvent({
      pathParameters: { domainId, dataProductId },
      ...(dataSetId
        ? {
            queryStringParameters: {
              dataSetId,
            },
          }
        : {}),
    }),
    null,
  );

describe('get-schema', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return an error if it cannot retrieve the data product details', async () => {
    API.getDataProductDomainDataProduct.mockRejectedValue(apiClientErrorResponse(404, { message: 'not found' }));

    const response = await getSchemaHandler('my-domain', 'my-product-id');
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(404);
    expect(body.message).toBe('not found');
  });

  it.each([AthenaQueryExecutionState.QUEUED, AthenaQueryExecutionState.RUNNING])(
    'should return an error if the query is still on %s state after 10 executions',
    async (athenaState) => {
      API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse);
      mockStartQueryExecution.mockReturnValue({ QueryExecutionId: 'athena-query-execution-id' });
      mockGetQueryExecution.mockReturnValue({
        QueryExecution: {
          Status: {
            State: athenaState,
          },
        },
      });

      const response = await getSchemaHandler('my-domain', 'test-data-product');
      const body = JSON.parse(response.body);

      expect(mockStartQueryExecution).toBeCalledWith({
        QueryString: 'DESCRIBE `AwsDataCatalog`.`default`.`test`',
        ResultConfiguration: {
          OutputLocation: `s3://${process.env.ATHENA_OUTPUT_BUCKET_NAME}/test-user`,
        },
        QueryExecutionContext: {
          Catalog: 'AwsDataCatalog',
          Database: 'default',
        },
      });
      expect(mockGetQueryExecution).toBeCalledTimes(10);
      expect(response.statusCode).toBe(400);
      expect(body.message).toBe('Failed to retrieve the schema for data product test-data-product');
    },
  );

  it.each([AthenaQueryExecutionState.CANCELLED, AthenaQueryExecutionState.FAILED])(
    'should return an error if the query is completed but unsuccessfully',
    async (athenaState) => {
      API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse);
      mockStartQueryExecution.mockReturnValue({ QueryExecutionId: 'athena-query-execution-id' });
      mockGetQueryExecution.mockReturnValue({
        QueryExecution: {
          Status: {
            State: athenaState,
          },
        },
      });

      const response = await getSchemaHandler('my-domain', 'test-data-product');
      const body = JSON.parse(response.body);

      expect(mockStartQueryExecution).toBeCalledWith({
        QueryString: 'DESCRIBE `AwsDataCatalog`.`default`.`test`',
        ResultConfiguration: {
          OutputLocation: `s3://${process.env.ATHENA_OUTPUT_BUCKET_NAME}/test-user`,
        },
        QueryExecutionContext: {
          Catalog: 'AwsDataCatalog',
          Database: 'default',
        },
      });
      expect(mockGetQueryExecution).toBeCalledTimes(1);
      expect(response.statusCode).toBe(400);
      expect(body.message).toBe('Failed to retrieve the schema for data product test-data-product');
    },
  );

  it('should return an error if the content of the file returned by athena is empty', async () => {
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse);
    mockStartQueryExecution.mockReturnValue({ QueryExecutionId: 'athena-query-execution-id' });
    mockGetQueryExecution.mockReturnValue({
      QueryExecution: {
        Status: {
          State: AthenaQueryExecutionState.SUCCEEDED,
        },
        ResultConfiguration: {
          OutputLocation: 's3://a-bucket/a/path/to/file.txt',
        },
      },
    });
    mockGetObject.mockReturnValue({
      Body: '',
    });

    const response = await getSchemaHandler('my-domain', 'test-data-product');
    const body = JSON.parse(response.body);

    expect(mockStartQueryExecution).toBeCalledWith({
      QueryString: 'DESCRIBE `AwsDataCatalog`.`default`.`test`',
      ResultConfiguration: {
        OutputLocation: `s3://${process.env.ATHENA_OUTPUT_BUCKET_NAME}/test-user`,
      },
      QueryExecutionContext: {
        Catalog: 'AwsDataCatalog',
        Database: 'default',
      },
    });
    expect(mockGetQueryExecution).toBeCalledTimes(1);
    expect(response.statusCode).toBe(400);
    expect(body.message).toBe('Failed to retrieve the schema for data product test-data-product');
  });

  it('should return an error if there are multiple datasets and the consumer does not specify the one to be described', async () => {
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductMultipleDatasetResponse);
    mockStartQueryExecution.mockReturnValue({ QueryExecutionId: 'athena-query-execution-id' });

    const response = await getSchemaHandler('my-domain', 'test-data-product');
    const body = JSON.parse(response.body);

    expect(mockStartQueryExecution).not.toBeCalled();
    expect(mockGetQueryExecution).not.toBeCalled();
    expect(response.statusCode).toBe(400);
    expect(body.message).toBe(
      'Failed to retrieve the schema for data product test-data-product. test-data-product has multiple dataset, please specify the one you want to use',
    );
  });

  it('should return an error if the dataset provided as input does not exists', async () => {
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductMultipleDatasetResponse);
    mockStartQueryExecution.mockReturnValue({ QueryExecutionId: 'athena-query-execution-id' });

    const response = await getSchemaHandler('my-domain', 'test-data-product', 'invented-data-set-id');
    const body = JSON.parse(response.body);

    expect(mockStartQueryExecution).not.toBeCalled();
    expect(mockGetQueryExecution).not.toBeCalled();
    expect(response.statusCode).toBe(400);
    expect(body.message).toBe(
      'Failed to retrieve the schema for data product test-data-product. The provided dataSetId does not exists in test-data-product',
    );
  });

  it('should return return the schema if the athena file content is parsed correctly', async () => {
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse);
    mockStartQueryExecution.mockReturnValue({ QueryExecutionId: 'athena-query-execution-id' });
    mockGetQueryExecution.mockReturnValue({
      QueryExecution: {
        Status: {
          State: AthenaQueryExecutionState.SUCCEEDED,
        },
        ResultConfiguration: {
          OutputLocation: 's3://a-bucket/a/path/to/file.txt',
        },
      },
    });
    mockGetObject.mockReturnValue({
      Body: `request_timestamp   	string              	                    
      elb_name            	string              	                    
      request_ip          	string              	                    
      request_port        	int                 	                    
      backend_ip          	string              	                    
      backend_port        	int                 	                    
      request_processing_time	double              	                    
      backend_processing_time	double              	                    
      client_response_time	double              	                    
      elb_response_code   	string              	                    
      backend_response_code	string              	                    
      received_bytes      	bigint              	                    
      sent_bytes          	bigint              	                    
      request_verb        	string              	                    
      url                 	string              	                    
      protocol            	string              	                    
      user_agent          	string              	                    
      ssl_cipher          	string              	                    
      ssl_protocol        	string`,
    });

    const response = await getSchemaHandler('my-domain', 'test-data-product');
    const body = JSON.parse(response.body);

    expect(mockStartQueryExecution).toBeCalledWith({
      QueryString: 'DESCRIBE `AwsDataCatalog`.`default`.`test`',
      ResultConfiguration: {
        OutputLocation: `s3://${process.env.ATHENA_OUTPUT_BUCKET_NAME}/test-user`,
      },
      QueryExecutionContext: {
        Catalog: 'AwsDataCatalog',
        Database: 'default',
      },
    });
    expect(mockGetQueryExecution).toBeCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(body).toStrictEqual({
      schema: {
        backend_ip: 'string',
        backend_port: 'int',
        backend_processing_time: 'double',
        backend_response_code: 'string',
        client_response_time: 'double',
        elb_name: 'string',
        elb_response_code: 'string',
        protocol: 'string',
        received_bytes: 'bigint',
        request_ip: 'string',
        request_port: 'int',
        request_processing_time: 'double',
        request_timestamp: 'string',
        request_verb: 'string',
        sent_bytes: 'bigint',
        ssl_cipher: 'string',
        ssl_protocol: 'string',
        url: 'string',
        user_agent: 'string',
      },
    });
  });

  it('should return return the schema if the athena file content is parsed correctly even if there are comments in the result', async () => {
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse);
    mockStartQueryExecution.mockReturnValue({ QueryExecutionId: 'athena-query-execution-id' });
    mockGetQueryExecution.mockReturnValue({
      QueryExecution: {
        Status: {
          State: AthenaQueryExecutionState.SUCCEEDED,
        },
        ResultConfiguration: {
          OutputLocation: 's3://a-bucket/a/path/to/file.txt',
        },
      },
    });
    mockGetObject.mockReturnValue({
      Body: `player.username     	string              	                    
      player.characteristics.race	string              	                    
      player.characteristics.class	string              	                    
      player.characteristics.subclass	string              	                    
      player.characteristics.power	int                 	                    
      player.characteristics.playercountry	string              	                    
      player.arsenal.kinetic.name	string              	                    
      player.arsenal.kinetic.type	string              	                    
      player.arsenal.kinetic.power	int                 	                    
      player.arsenal.kinetic.element	string              	                    
      player.arsenal.energy.name	string              	                    
      player.arsenal.energy.type	string              	                    
      player.arsenal.energy.power	int                 	                    
      player.arsenal.energy.element	string              	                    
      player.arsenal.power.name	string              	                    
      player.arsenal.power.type	string              	                    
      player.arsenal.power.power	int                 	                    
      player.arsenal.power.element	string              	                    
      player.armor.head   	string              	                    
      player.armor.arms   	string              	                    
      player.armor.chest  	string              	                    
      player.armor.leg    	string              	                    
      player.armor.classitem	string              	                    
      player.location.map 	string              	                    
      player.location.waypoint	string              	                    
      partition_0         	string              	                    
      partition_1         	string              	                    
            
      # Partition Information	 	 
      # col_name            	data_type           	comment             
            
      partition_0         	string              	                    
      partition_1         	string`,
    });

    const response = await getSchemaHandler('my-domain', 'test-data-product');
    const body = JSON.parse(response.body);

    expect(mockStartQueryExecution).toBeCalledWith({
      QueryString: 'DESCRIBE `AwsDataCatalog`.`default`.`test`',
      ResultConfiguration: {
        OutputLocation: `s3://${process.env.ATHENA_OUTPUT_BUCKET_NAME}/test-user`,
      },
      QueryExecutionContext: {
        Catalog: 'AwsDataCatalog',
        Database: 'default',
      },
    });
    expect(mockGetQueryExecution).toBeCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(body).toStrictEqual({
      schema: {
        partition_0: 'string',
        partition_1: 'string',
        'player.armor.arms': 'string',
        'player.armor.chest': 'string',
        'player.armor.classitem': 'string',
        'player.armor.head': 'string',
        'player.armor.leg': 'string',
        'player.arsenal.energy.element': 'string',
        'player.arsenal.energy.name': 'string',
        'player.arsenal.energy.power': 'int',
        'player.arsenal.energy.type': 'string',
        'player.arsenal.kinetic.element': 'string',
        'player.arsenal.kinetic.name': 'string',
        'player.arsenal.kinetic.power': 'int',
        'player.arsenal.kinetic.type': 'string',
        'player.arsenal.power.element': 'string',
        'player.arsenal.power.name': 'string',
        'player.arsenal.power.power': 'int',
        'player.arsenal.power.type': 'string',
        'player.characteristics.class': 'string',
        'player.characteristics.playercountry': 'string',
        'player.characteristics.power': 'int',
        'player.characteristics.race': 'string',
        'player.characteristics.subclass': 'string',
        'player.location.map': 'string',
        'player.location.waypoint': 'string',
        'player.username': 'string',
      },
    });
  });

  it('should return return the schema if the athena file content is parsed correctly using a custom datasetId', async () => {
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductMultipleDatasetResponse);
    mockStartQueryExecution.mockReturnValue({ QueryExecutionId: 'athena-query-execution-id' });
    mockGetQueryExecution.mockReturnValue({
      QueryExecution: {
        Status: {
          State: AthenaQueryExecutionState.SUCCEEDED,
        },
        ResultConfiguration: {
          OutputLocation: 's3://a-bucket/a/path/to/file.txt',
        },
      },
    });
    mockGetObject.mockReturnValue({
      Body: `request_timestamp   	string              	                    
      elb_name            	string              	                    
      request_ip          	string              	                    
      request_port        	int                 	                    
      backend_ip          	string              	                    
      backend_port        	int                 	                    
      request_processing_time	double              	                    
      backend_processing_time	double              	                    
      client_response_time	double              	                    
      elb_response_code   	string              	                    
      backend_response_code	string              	                    
      received_bytes      	bigint              	                    
      sent_bytes          	bigint              	                    
      request_verb        	string              	                    
      url                 	string              	                    
      protocol            	string              	                    
      user_agent          	string              	                    
      ssl_cipher          	string              	                    
      ssl_protocol        	string`,
    });

    const response = await getSchemaHandler('my-domain', 'test-data-product', 'secondDataSet');
    const body = JSON.parse(response.body);

    expect(mockStartQueryExecution).toBeCalledWith({
      QueryString: 'DESCRIBE `AwsDataCatalog`.`default`.`second-test`',
      ResultConfiguration: {
        OutputLocation: `s3://${process.env.ATHENA_OUTPUT_BUCKET_NAME}/test-user`,
      },
      QueryExecutionContext: {
        Catalog: 'AwsDataCatalog',
        Database: 'default',
      },
    });
    expect(mockGetQueryExecution).toBeCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(body).toStrictEqual({
      schema: {
        backend_ip: 'string',
        backend_port: 'int',
        backend_processing_time: 'double',
        backend_response_code: 'string',
        client_response_time: 'double',
        elb_name: 'string',
        elb_response_code: 'string',
        protocol: 'string',
        received_bytes: 'bigint',
        request_ip: 'string',
        request_port: 'int',
        request_processing_time: 'double',
        request_timestamp: 'string',
        request_verb: 'string',
        sent_bytes: 'bigint',
        ssl_cipher: 'string',
        ssl_protocol: 'string',
        url: 'string',
        user_agent: 'string',
      },
    });
  });
});
