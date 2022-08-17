/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Box, Theme, makeStyles } from 'aws-northstar';
import { FormRenderer } from '$common/components/form-renderer/FormRenderer';
import { FormRendererProps, Schema } from 'aws-northstar/components/FormRenderer';
import { PageLayout } from '../PageLayout';
import { WIZARD_LAYOUT } from '../AppLayout';
import { WizardStep } from './types';
import React, { useMemo } from 'react';
import WizardMapping from './components/Wizard';

export * from './types';

export interface WizardLayoutProps extends Omit<FormRendererProps, 'schema'> {
  steps: WizardStep[];
}

export const WizardLayout: React.FC<WizardLayoutProps> = ({
  steps,
  customComponentWrapper: customComponentWrapperProp,
  children,
  ...props
}) => {
  const schema = useMemo<Schema>(() => {
    return {
      fields: [
        {
          component: 'wizard',
          name: 'wizard',
          fields: steps.map((step, index) => {
            return {
              name: `step-${index + 1}`,
              ...step,
            };
          }),
        },
      ],
    };
  }, [steps]);

  const customComponentWrapper = useMemo<FormRendererProps['customComponentWrapper']>(() => {
    return {
      ...customComponentWrapperProp,
      wizard: WizardMapping,
    };
  }, [customComponentWrapperProp]);

  const classes = useStyles();

  return (
    <PageLayout layout={WIZARD_LAYOUT}>
      <Box className={classes.formContainer}>
        <FormRenderer {...props} schema={schema} customComponentWrapper={customComponentWrapper} />
      </Box>
      {children}
    </PageLayout>
  );
};

const useStyles = makeStyles<Theme>(() => ({
  // TODO: jerjonas - remove important - the scoped css with minWidth:0 is `> main div` which
  // for some reason is more explicit that this
  formContainer: {
    minWidth: 'initial !important',

    '& div': {
      minWidth: 'initial !important',
    },

    '& nav': {
      whiteSpace: 'nowrap',
      '& *': {
        textOverflow: 'ellipsis',
      },
    },
  },
}));
