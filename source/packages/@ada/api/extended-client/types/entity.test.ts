/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { entityIdentifier, entityIdentifierFromString, entityIdentifierToString, identifierFromEntityIdentifier } from './entity'

describe('api/extended-client/types', () => {
	describe('entity', () => {
		describe('entityIdentifierToString', () => {
			it('should convert entity identifier to string', () => {
				expect(entityIdentifierToString({ type: 'Type', identifierParts: ['Part1', 'Part2']})).toEqual('Type::Part1:Part2');
			})
		})
		describe('entityIdentifierFromString', () => {
			it('should convert entity string to identifier', () => {
				expect(entityIdentifierFromString('Type::Part1:Part2')).toEqual({ type: 'Type', identifierParts: ['Part1', 'Part2']});
			})
			it('should throw if missing parts', () => {
				expect(() => entityIdentifierFromString('Invalid')).toThrow();
			})
		})

		describe('entityIdentifier', () => {
			it('should create identitier', () => {
				expect(entityIdentifier('DataProductDomain', { domainId: 'DOMAIN_ID' })).toEqual({ type: 'DataProductDomain', identifierParts: ['DOMAIN_ID']});
			})
			it('should throw if missing parts', () => {
				expect(() => entityIdentifierFromString('Invalid')).toThrow();
			})
		})
		describe('identifierFromEntityIdentifier', () => {
			it('should get entity identifier', () => {
				expect(identifierFromEntityIdentifier('DataProductDomain', { type: 'DataProductDomain', identifierParts: ['DOMAIN_ID'] })).toEqual({ domainId: 'DOMAIN_ID' });
			})
			it('should throw for unmatching types', () => {
				expect(() => identifierFromEntityIdentifier('DataProductDomain', { type: 'Different', identifierParts: ['DOMAIN_ID'] })).toThrow();
			})
		})
	})
})
