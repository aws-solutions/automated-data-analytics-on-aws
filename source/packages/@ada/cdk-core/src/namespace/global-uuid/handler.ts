/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Data, Properties } from './common';
import ShortUniqueId from 'short-unique-id';

// only use 'alphanum_lower' to support lowest common denominator of resource names
// S3 buckets do not allow upper case
const uuid = new ShortUniqueId({ length: 6, dictionary: 'alphanum_lower', debug: true });
console.info('ShortUniqueId:', {
  example: uuid(),
  availableUUIDs: uuid.availableUUIDs(), // 21,767,82,336
  collisionProbability: uuid.collisionProbability(), // 0.00002686287159884045
  uniqueness: uuid.uniqueness(), // 0.9999731371284012
  approxMaxBeforeCollision: uuid.approxMaxBeforeCollision(), // 58474.62439059198
});

interface Event {
  RequestType: 'Create' | 'Update' | 'Delete';
  ResourceProperties: Properties;
  // https://docs.aws.amazon.com/cdk/api/latest/docs/custom-resources-readme.html#handling-lifecycle-events-onevent
  OldResourceProperties?: Required<Properties>;
}

interface Response {
  IsComplete: boolean;
  Data?: Data;
}

/**
 * Generates a unique (enough) hash based on the invoked lambda arn and stack name of the lambda.
 *
 * The lambda arn contains the account and region as to make the hash unique to prevent collisions.
 * @param event
 * @param context
 * @returns
 */
export async function handler(event: Event, _context: any): Promise<Response> {
  // Only generate UUID during "Create" resource
  switch (event.RequestType) {
    case 'Create': {
      return {
        IsComplete: true,
        Data: {
          uuid: uuid(),
        },
      };
    }
    case 'Update': {
      if (event.OldResourceProperties?.uuid == null) {
        console.error(event);
        throw new Error('Existing UUID is not persisted in event.OldResourceProperties.uuid');
      }

      return {
        IsComplete: true,
        // propagate resource properties from "Create" during "Update"
        Data: event.OldResourceProperties,
      };
    }
    default: {
      return {
        IsComplete: true,
      };
    }
  }
}
