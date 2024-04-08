/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { KeyValuePair, Stack, componentTypes, validatorTypes } from 'aws-northstar';
import { LL } from '$strings';
import { PercentagesSelectorCustomComponent } from '../PercentagesSelectorCustomComponent';
import { WizardStep } from '$northstar-plus';

export type FormData = {
  budgetLimit: string;
  subscriberList?: {
    label: string;
    value: string;
  }[];
  softNotifications?: number[];
}

export const buildSteps = (isNew: boolean, email?: string): WizardStep[] => {
  return [
    {
      title: isNew ? LL.ENTITY.Budget__CREATE() : LL.ENTITY.Budget__UPDATE(),
      description: LL.VIEW.BUDGET.WIZARD.description(),
      fields: [
        {
          component: componentTypes.TEXT_FIELD,
          name: 'budgetLimit',
          type: 'number',
          label: LL.ENTITY['Budget@'].budgetLimit.label(),
          description: LL.ENTITY['Budget@'].budgetLimit.description(),
          placeholder: LL.ENTITY['Budget@'].budgetLimit.placeholder(),
          isRequired: true,
          validate: [
            {
              type: validatorTypes.REQUIRED,
            },
          ],
        },
        {
          component: componentTypes.SELECT,
          name: 'subscriberList',
          label: LL.ENTITY['Budget@'].subscriberList.label(),
          description: LL.ENTITY['Budget@'].subscriberList.description(),
          placeholder: LL.ENTITY['Budget@'].subscriberList.placeholder(),
          options: email ? [
            {
              label: email,
              value: email,
            }
          ] : [],
          multiSelect: true,
          freeSolo: true,
          isRequired: true,
          validate: [
            {
              type: validatorTypes.REQUIRED,
            },
          ],
        },
        {
          component: componentTypes.CUSTOM,
          name: 'softNotifications',
          label: LL.ENTITY['Budget@'].softNotifications.label(),
          description: LL.ENTITY['Budget@'].softNotifications.description(),
          CustomComponent: PercentagesSelectorCustomComponent,
          initialValue: [100]
        },
      ],
    },
    {
      title: LL.VIEW.wizard.STEP.review.title(),
      fields: [
        {
          component: componentTypes.REVIEW,
          name: 'review',
          Template: ({ data }: { data: FormData }) => {
            return (
              <Stack spacing="l">
                <KeyValuePair label={LL.ENTITY['Budget@'].budgetLimit.label()} value={data.budgetLimit} />
                <KeyValuePair
                  label={LL.ENTITY['Budget@'].subscriberList.label()}
                  value={data.subscriberList?.map((item) => item.value).join(', ')}
                />
                <KeyValuePair
                  label={LL.ENTITY['Budget@'].softNotifications.label()}
                  value={data.softNotifications?.join(', ')}
                />
              </Stack>
            );
          },
        },
      ],
    },
  ];
};
