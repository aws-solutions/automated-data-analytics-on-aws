/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AUTH_FIELDS } from '../common/wizard';
import { CustomComponentTypes } from '$common/components';
import { DataProductUpdatePolicy, DataProductUpdateTriggerType, SourceTypeDefinitions } from '@ada/common';
import { Field } from '@data-driven-forms/react-form-renderer/common-types';
import { LL } from '$strings';
import { Option, validatorTypes } from 'aws-northstar/components/FormRenderer';
import { componentTypes } from 'aws-northstar/components/FormRenderer/types';
import { gaMetadataDimensions, gaMetadataMetrics } from './metadata';
import { sourceTypeSubForm } from '../../common';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

const SOURCE_DEF = SourceTypeDefinitions.GOOGLE_ANALYTICS;

const UPDATE_POLICY_OPTIONS: Option[] = Object.values(DataProductUpdatePolicy).map(
  (value): Option => ({
    value,
    label: LL.ENTITY.DataProduct_.UpdatePolicy[value].label(),
    description: LL.ENTITY.DataProduct_.UpdatePolicy[value].description(),
  }),
);

const UPDATE_TRIGGER_TRIGGER_TYPE = 'updateTrigger.triggerType';

export const CREATE_FIELDS: Field[] = sourceTypeSubForm(
  SOURCE_DEF,
  [
    {
      component: componentTypes.TEXT_FIELD,
      name: 'sourceDetails.viewId',
      label: 'View Id',
      description: '',
      placeholder: '12345678',
      validate: [
        {
          type: validatorTypes.REQUIRED,
        },
        {
          type: validatorTypes.PATTERN,
          pattern: /^\d+$/,
          message: 'Must be number',
        },
      ],
    },
    {
      component: componentTypes.SELECT,
      name: 'sourceDetails.dimensions',
      label: 'Dimensions',
      options: gaMetadataDimensions.map((value) => ({ value, label: value })),
      multiSelect: true,
      freeSolo: true,
      description: '',
      placeholder: 'Select from default or enter your custom dimensions',
      validate: [
        {
          type: validatorTypes.REQUIRED,
        },
      ],
    },
    {
      component: componentTypes.SELECT,
      name: 'sourceDetails.metrics',
      label: 'Metrics',
      multiSelect: true,
      freeSolo: true,
      description: '',
      placeholder: 'Select from default or enter your custom metrics',
      options: gaMetadataMetrics.map((value) => ({ value, label: value })),
      validate: [
        {
          type: validatorTypes.REQUIRED,
        },
      ],
    },
    ...AUTH_FIELDS,
  ],
  [
    // clear updatePolicy unless schedule
    {
      component: CustomComponentTypes.FIELD_LISTENER,
      name: '__update-trigger-type-listener',
      target: UPDATE_TRIGGER_TRIGGER_TYPE,
      hideField: true,
      listener: (
        { change }: ReturnType<typeof useFormApi>,
        current: DataProductUpdateTriggerType | undefined,
        _previous: DataProductUpdateTriggerType | undefined,
      ) => {
        if (current !== DataProductUpdateTriggerType.SCHEDULE) {
          change('updateTrigger.updatePolicy', undefined);
        }
      },
    },
    {
      component: componentTypes.RADIO,
      label: 'Update Policy',
      description: 'Select how you would like your data to be imported',
      name: 'updateTrigger.updatePolicy',
      options: UPDATE_POLICY_OPTIONS,
      isRequired: true,
      validate: [
        {
          type: validatorTypes.REQUIRED,
        },
      ],
      condition: {
        when: UPDATE_TRIGGER_TRIGGER_TYPE,
        is: DataProductUpdateTriggerType.SCHEDULE,
      },
    },
    {
      component: componentTypes.DATE_PICKER,
      name: 'sourceDetails.since',
      label: 'Since',
      description: '',
      placeholder: 'YYYY/MM/DD',
      isRequired: true,
      validate: [
        {
          type: validatorTypes.REQUIRED,
        },
      ],
      condition: {
        when: UPDATE_TRIGGER_TRIGGER_TYPE,
        is: DataProductUpdateTriggerType.ON_DEMAND,
      },
    },
    {
      component: componentTypes.DATE_PICKER,
      name: 'sourceDetails.until',
      label: 'Until',
      description: '',
      placeholder: 'YYYY/MM/DD',
      isRequired: true,
      validate: [
        {
          type: validatorTypes.REQUIRED,
        },
      ],
      condition: {
        when: UPDATE_TRIGGER_TRIGGER_TYPE,
        is: DataProductUpdateTriggerType.ON_DEMAND,
      },
    },
  ],
);
