/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors';
import { CustomComponentTypes } from '$common/components';
import {
  DataProductUpdatePolicy,
  DataProductUpdateTriggerScheduleRate,
  DataProductUpdateTriggerType,
} from '@ada/common';
import { Field, Option, componentTypes, validatorTypes } from 'aws-northstar/components/FormRenderer';
import { LL } from '$strings';
import { compact, get } from 'lodash';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

const TRIGGER_OPTIONS: Option[] = Object.values(DataProductUpdateTriggerType).map(
  (value): Option => ({
    value,
    label: LL.ENTITY.DataProduct_.UpdateTriggerType[value].label(),
    description: LL.ENTITY.DataProduct_.UpdateTriggerType[value].description(),
  }),
);

const SCHEDULE_RATES_OPTIONS: (Option & { key: string })[] = Object.values(DataProductUpdateTriggerScheduleRate).map(
  (value): Option & { key: string } => ({
    key: value,
    value: LL.ENTITY.DataProduct_.UpdateTriggerType.SCHEDULE.rates[value].value(),
    label: LL.ENTITY.DataProduct_.UpdateTriggerType.SCHEDULE.rates[value].label(),
    description: LL.ENTITY.DataProduct_.UpdateTriggerType.SCHEDULE.rates[value].description(),
  }),
);

const UPDATE_POLICY_OPTIONS: Option[] = Object.values(DataProductUpdatePolicy).map(
  (value): Option => ({
    value,
    label: LL.ENTITY.DataProduct_.UpdatePolicy[value].label(),
    description: LL.ENTITY.DataProduct_.UpdatePolicy[value].description(),
  }),
);

const UPDATE_TRIGGER_SCHEDULE_RATE = 'updateTrigger.scheduleRate';
const UPDATE_TRIGGER_CUSTOM_RATE = 'updateTrigger.customRate';
const UPDATE_TRIGGER_UPDATE_POLICY = 'updateTrigger.updatePolicy';

const SCHEDULE_FIELDS = [UPDATE_TRIGGER_SCHEDULE_RATE, UPDATE_TRIGGER_CUSTOM_RATE, UPDATE_TRIGGER_UPDATE_POLICY];

export const SCHEDULERATE_CUSTOM = LL.ENTITY.DataProduct_.UpdateTriggerType.SCHEDULE.rates.CUSTOM.value();

const UPDATE_TRIGGER_TRIGGER_TYPE = 'updateTrigger.triggerType';

export function generateDataUpdateFields(
  { ID, CONFIG }: Connectors.IConnector,
  additionalDataUpdateFields?: Field[],
): Field[] {
  if (
    CONFIG.supports.updateTriggers === false ||
    Object.values(CONFIG.supports.updateTriggers).includes(true) !== true
  ) {
    return [];
  }

  const updateTriggers = CONFIG.supports.updateTriggers;
  const scheduleRates = CONFIG.supports.updateTriggerScheduleRate;
  const supportsSchedule =
    CONFIG.supports.updateTriggers.SCHEDULE === true && CONFIG.supports.updateTriggerScheduleRate != null;
  const supportsCustom = supportsSchedule === true && CONFIG.supports.updateTriggerScheduleRate?.CUSTOM === true;
  const supportsUpdatePolicy =
    !!CONFIG.supports.updateTriggerUpdatePolicy &&
    Object.values(CONFIG.supports.updateTriggerUpdatePolicy).filter((v) => v).length > 1;

  return [
    {
      component: componentTypes.SUB_FORM,
      title: LL.ENTITY.DataProduct_.UpdateTriggerType.heading(),
      name: `_updates_${ID}`,
      condition: {
        when: 'sourceType',
        is: ID,
      },
      fields: compact([
        // Listener to cleanup dynamic "scheduling" based fields
        // Tried using conditionals but inconsistent behaivor
        {
          component: CustomComponentTypes.FIELD_LISTENER,
          name: '$schedule_listener',
          target: UPDATE_TRIGGER_TRIGGER_TYPE,
          hideField: true,
          listener: (
            { change }: ReturnType<typeof useFormApi>,
            current: DataProductUpdateTriggerType,
            // previous: DataProductUpdateTriggerType,
          ) => {
            if (current !== DataProductUpdateTriggerType.SCHEDULE) {
              // clear all schedule based input fields
              SCHEDULE_FIELDS.forEach((field) => change(field, undefined));
            }
          },
        },
        {
          component: componentTypes.RADIO,
          label: LL.ENTITY.DataProduct_.UpdateTriggerType.label(),
          description: LL.ENTITY.DataProduct_.UpdateTriggerType.description(),
          name: UPDATE_TRIGGER_TRIGGER_TYPE,
          options: TRIGGER_OPTIONS.filter(
            (option) => updateTriggers[option.value as DataProductUpdateTriggerType] === true,
          ),
          isRequired: true,
          validate: [
            {
              type: validatorTypes.REQUIRED,
            },
          ],
        },
        supportsSchedule
          ? {
              component: componentTypes.SELECT,
              name: UPDATE_TRIGGER_SCHEDULE_RATE,
              label: LL.ENTITY.DataProduct_.UpdateTriggerType.SCHEDULE.label(),
              description: LL.ENTITY.DataProduct_.UpdateTriggerType.SCHEDULE.description(),
              options: SCHEDULE_RATES_OPTIONS.filter((option) => {
                return scheduleRates![option.key as DataProductUpdateTriggerScheduleRate] === true;
              }),
              condition: [
                {
                  when: UPDATE_TRIGGER_TRIGGER_TYPE,
                  is: DataProductUpdateTriggerType.SCHEDULE,
                },
              ],
              isRequired: true,
              validate: [
                {
                  type: validatorTypes.REQUIRED,
                },
              ],
            }
          : null,
        supportsCustom
          ? {
              component: componentTypes.TEXT_FIELD,
              name: UPDATE_TRIGGER_CUSTOM_RATE,
              label: LL.ENTITY.DataProduct_.UpdateTriggerType.SCHEDULE.rates.CUSTOM.label(),
              description: LL.ENTITY.DataProduct_.UpdateTriggerType.SCHEDULE.rates.CUSTOM.description(),
              helperText: LL.ENTITY.DataProduct_.UpdateTriggerType.SCHEDULE.rates.CUSTOM.hintText(),
              isRequired: true,
              condition: {
                when: UPDATE_TRIGGER_SCHEDULE_RATE,
                is: SCHEDULERATE_CUSTOM,
              },
              validate: [
                {
                  type: validatorTypes.REQUIRED,
                },
                {
                  type: validatorTypes.PATTERN,
                  pattern: /^(cron|rate)\(.*\)$/,
                  message: 'Must be a valid cron or rate expression',
                },
              ],
            }
          : null,
        supportsUpdatePolicy
          ? {
              component: componentTypes.RADIO,
              label: 'Update Policy',
              description: 'Select how you would like your data to be imported',
              name: 'updateTrigger.updatePolicy',
              options: UPDATE_POLICY_OPTIONS.filter(({ value }) => {
                return get(CONFIG.supports.updateTriggerUpdatePolicy, value) === true;
              }),
              isRequired: true,
              validate: [
                {
                  type: validatorTypes.REQUIRED,
                },
              ],
            }
          : null,
        ...(additionalDataUpdateFields || []),
      ]),
    },
  ];
}
