/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataSet } from './DataSet';
import { Domain } from './Domain';
import type { StringEntityDefinition } from '../types'

export const DataProduct: StringEntityDefinition<'DataProduct'> = {
	DataProduct: 'Data Product',
	DataProducts: 'Data Products',
	data_product: 'data product',
	data_products: 'data products',

	description: `Representation of one or more ${DataSet.data_sets} that can be queried`,
  descriptions: `List of managed ${DataSet.data_set} representations`,

	properties: {
    domainId: {
      label: Domain.Domain,
      description: `The ${Domain.domain} the data product is associated`,
      hintText: `Choose the ${Domain.domain} in which to create the data product in`
    },
    name: {
      label: 'Name',
      description: 'The unique name of the data product with in the domain',
    },
    description: {
      label: 'Description',
      description: 'The description of the data product',
    },
    updateTrigger: {
			label: 'Update Trigger',
      description: 'Type of data import lifecycle policy',
		},
    enableAutomaticPii: {
      label: 'Automatic PII',
      description: 'Indicates if PII columns in data will be automatically detected during import',
      hintText: 'Enables automatic redaction of sensitive data during query execution through governance',
    },
    sourceType: {
      label: 'Source Type',
      description: 'Specifies the source type of the data',
    },
    transforms: {
      label: 'Transforms',
      description: 'List of transforms that are applied to the data during import',
    },
    tags: {
      label: 'Tags',
      description: 'List of tags applied to the data product',
    },
    latestDataUpdateTimestamp: {
      label: 'Last Data Update',
      description: 'The time at which the data product data was last updated',
    },
    defaultLensId: {
      label: 'Default Lens',
      description: 'Define the default lens to apply to the data product',
    },
	}
}

export const DataProduct_ = {
  identifier: {
    label: 'Identifier',
  },
  status: {
    label: 'Status',
  },

	permissions: `${DataProduct.DataProduct} permissions`,
	policy: `${DataProduct.DataProduct} policy`,

  UpdateTriggerType: {
    label: 'Update Trigger',
    description: 'How data updates are triggered after initial import',
    heading: 'Data updates',
    AUTOMATIC: {
      label: 'Automatic',
      description: 'Trigger updates when new data is detected',
    },
    ON_DEMAND: {
      label: 'On Demand',
      description: 'Manually trigger update',
    },
    SCHEDULE: {
      label: 'Schedule',
      description: 'Trigger updates based on a recurring schedule',
      rates: {
        HOURLY: {
          value: 'rate(1 hour)',
          label: 'Hourly',
          description: 'Import data on an hourly frequency',
        },
        DAILY: {
          value: 'rate(1 day)',
          label: 'Daily',
          description: 'Import data on a daily frequency',
        },
        WEEKLY: {
          value: 'rate(7 days)',
          label: 'Weekly',
          description: 'Import data on a weekly frequency',
        },
        MONTHLY: {
          value: 'rate(30 days)',
          label: 'Monthly',
          description: 'Import data on a monthly frequency',
        },
        CUSTOM: {
          value: 'custom',
          label: 'Custom (cron or rate)',
          description: 'Import data on a custom frequency using cron or rate expression',
          hintText: 'eg. cron(0 9 * * ? *) or rate(1 day)',
        },
      },
    },
  },
  UpdatePolicy: {
    APPEND: {
      label: 'Append',
      description: 'Imported data will be appended to existing data',
    },
    REPLACE: {
      label: 'Replace',
      description: 'Existing data will be replaced',
    },
  },
  AccessLevel: {
    label: 'Access Level',
    READ_ONLY: {
      label: 'Read Only',
      description: 'Provides user with the ability to view and query the data product',
    },
    FULL: {
      label: 'Full',
      description: 'Provides user with full access to the data product',
    },
  },
} as const;

export default DataProduct;
