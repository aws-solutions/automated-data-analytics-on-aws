/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Field } from 'aws-northstar/components/FormRenderer';
import { Grid } from 'aws-northstar';
import React from 'react';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

// https://data-driven-forms.org/examples/custom-layout-component#heading-customlayoutcomponent
export const TwoColumns: React.FC<{ fields: Field[] }> = ({ fields }) => {
  const { renderForm } = useFormApi();

  return (
    <Grid container spacing={3}>
      {fields.map((field) => (
        <Grid key={field.name} item xs={6}>
          {renderForm([field])}
        </Grid>
      ))}
    </Grid>
  );
};
