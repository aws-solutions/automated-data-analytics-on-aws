/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AUTH_FIELDS } from '../common/wizard';
import { Field } from '@data-driven-forms/react-form-renderer/common-types';
import { FormField } from 'aws-northstar';
import { SourceTypeDefinitions } from '@ada/common';
import { SqlEditor } from '$common/components/query';
import { componentTypes } from 'aws-northstar/components/FormRenderer/types';
import { sourceTypeSubForm } from '../../common';
import { validatorTypes } from 'aws-northstar/components/FormRenderer';

const SOURCE_DEF = SourceTypeDefinitions.GOOGLE_BIGQUERY;

export const CREATE_FIELDS: Field[] = sourceTypeSubForm(SOURCE_DEF, [
  {
    component: componentTypes.CUSTOM,
    name: 'sourceDetails.query',
    label: 'Query',
    description: 'Enter the query to be executed in BigQuery to retrieve the data',
    validate: [
      {
        type: validatorTypes.REQUIRED,
      },
    ],
    CustomComponent: ({ input, label, description }: any) => (
      <FormField controlId="sourceDetails-query" label={label} description={description}>
        <SqlEditor
          defaultValue={input.value}
          onChange={(query) => input.onChange({ target: { value: query } })}
          placeholder={`SELECT state_name, country\nFROM \`table-project-id\`.\`data-set-name\`.\`table-name\`\nWHERE country = "US"`}
          maxLines={10}
        />
      </FormField>
    ),
  },
  ...AUTH_FIELDS,
]);
