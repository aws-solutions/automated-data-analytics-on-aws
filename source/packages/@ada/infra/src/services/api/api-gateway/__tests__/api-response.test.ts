/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { StatusCodes } from 'http-status-codes';
import { ApiResponse } from '../api-response';

describe('api-response', () => {
  describe('success', () => {
    it('should return 200 and stringify the body', () => {
      const result = ApiResponse.success({ value: 'test' }).asApiGatewayResult();
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ value: 'test' });
    });
  });

  describe('badRequest', () => {
    it('should return 400 and stringify the body', () => {
      const result = ApiResponse.badRequest({ message: 'test' }).asApiGatewayResult();
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        name: 'Error',
        message: 'test',
        errorId: expect.stringMatching(/\w{10}/),
      });
    });
  });
  describe('internalServerError', () => {
    it('should return 409 (conflict) and stringify the body with errorId', () => {
      const result = ApiResponse.internalServerError({ message: 'test' }).asApiGatewayResult();
      expect(result.statusCode).toBe(StatusCodes.CONFLICT);
      expect(JSON.parse(result.body)).toEqual({
        name: 'Error',
        message: 'Failed to service request',
        details: expect.stringMatching(/\w{10}/),
        errorId: expect.stringMatching(/\w{10}/),
      });
    });
  });
});
