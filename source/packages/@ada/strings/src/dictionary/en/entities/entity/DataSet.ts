/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types';

// In the UI we consistently call "DataSet" by "Table", only references within DataProduct
// pages around the schema components.

export const DataSet: StringEntityDefinition<'DataSet'> = {
	DataSet: 'Table',
	DataSets: 'Tables',
	data_set: 'table',
	data_sets: 'tables',

	description: 'A managed data table in a data set',
	descriptions: 'List of managed data tables in a data set'
}

export const DataSet_ = {
	preview: `${DataSet.DataSet} preview`,
	name: `{name:string} ${DataSet.data_set}`,
	default: `Default ${DataSet.data_set}`,
} as const;

export default DataSet;
