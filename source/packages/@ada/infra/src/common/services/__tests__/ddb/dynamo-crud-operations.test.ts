/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { getCreateAndUpdateDetails } from '../../ddb';

describe('dynamo-crud-operations', () => {
  describe('getCreateAndUpdateDetails', () => {
    const now = '2021-01-01T00:00:00.000Z';

    beforeEach(() => {
      jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return the create and update details when an item is first created', () => {
      expect(getCreateAndUpdateDetails('test-user', undefined)).toEqual({
        createdBy: 'test-user',
        updatedBy: 'test-user',
        createdTimestamp: now,
        updatedTimestamp: now,
      });
    });

    it('should return the create and update details when an item is subsequently updated', () => {
      expect(
        getCreateAndUpdateDetails('test-user', {
          createdBy: 'another-user',
          updatedBy: 'yet-another-user',
          createdTimestamp: '1991-01-01T00:00:00.000Z',
          updatedTimestamp: '2001-01-01T00:00:00.000Z',
        }),
      ).toEqual({
        createdBy: 'another-user',
        updatedBy: 'test-user',
        createdTimestamp: '1991-01-01T00:00:00.000Z',
        updatedTimestamp: now,
      });
    });
  });
});
