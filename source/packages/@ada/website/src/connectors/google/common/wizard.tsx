/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Common as ConnectorsCommon } from '@ada/connectors';
import { CustomComponentTypes, FileUploadComponent } from '$common/components/form-renderer';
import { CustomValidatorTypes, JSONSCHEMA_VALIDATOR } from '$common/components/form-renderer/validators';
import { Field } from '@data-driven-forms/react-form-renderer/common-types';
import { FormField, Inline, KeyValuePair } from 'aws-northstar';
import { Option, componentTypes } from 'aws-northstar/components/FormRenderer/types';
import { ValidatorFunction } from '@data-driven-forms/react-form-renderer/validators';
import { camelCase, get, isEmpty, pick } from 'lodash';
import { getPersistentGoogleServiceAccountDetails } from './google-session-credentials';
import { validatorTypes } from 'aws-northstar/components/FormRenderer';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

type TFormData = Required<Omit<ConnectorsCommon.Google.IGoogleServiceAccountAuth, 'privateKeySecretName'>>

const SOURCE_DETAILS_KEY = 'sourceDetails'

const FORM_KEY_PREFIX = '__googleAuth'

const SOURCE_KEY = `${FORM_KEY_PREFIX}.source`;
const FILE_KEY = `${FORM_KEY_PREFIX}.file`;
const ERROR_KEY = `${FORM_KEY_PREFIX}.error`

enum SOURCES  {
  FILE = 'file',
  MANUAL = 'manual',
  PERSISTENT = 'persistent',
}

function extractGoogleServiceAccountDetails(
  details: ConnectorsCommon.Google.IGoogleServiceAccountAuth | string
): TFormData {
  try {
    if (typeof details === 'string') {
      details = Object.fromEntries(Object.entries(JSON.parse(details)).map(([key, value]) => {
        return [camelCase(key), value];
      })) as unknown as TFormData;
    }

    return pick(details, ConnectorsCommon.Google.GOOGLE_SERVICE_ACCOUNT_JSON_KEYS) as TFormData;
  } catch (error: any) {
    console.warn(error);
    throw error;
  }
}

const GOOGLE_AUTH_VALIDATOR = JSONSCHEMA_VALIDATOR({ schema: ConnectorsCommon.Google.GOOGLE_AUTH_SCHEMA })

const googleAuthValidator = ((_value: any, allValues: TFormData) => {
  const error: string | null = get(allValues, ERROR_KEY)
  if (error) {
    return error;
  }

  const sourceDetails = allValues[SOURCE_DETAILS_KEY as keyof TFormData];

  if (sourceDetails == null || isEmpty(sourceDetails)) {
    return 'Invalid credential details provided'
  }

  return GOOGLE_AUTH_VALIDATOR(sourceDetails);
}) as ValidatorFunction;

export const GOOGLE_AUTH_FIELD: Field = {
  component: componentTypes.SUB_FORM,
  title: 'Google Auth',
  name: FORM_KEY_PREFIX,
  fields: [
    {
      component: componentTypes.RADIO,
      name: SOURCE_KEY,
      label: 'How would you like to provide the Service Account credentials?',
      isRequired: true,
      validate: [
        {
          type: validatorTypes.REQUIRED,
        },
      ],
      resolveProps: (_props, _field, _formOptions): { options: Partial<Option>[] } => {
        const persistentDetails = getPersistentGoogleServiceAccountDetails();
        const options: Partial<Option>[] = [
          {
            label: 'From JSON file',
            value: SOURCES.FILE,
          },
          {
            label: 'Enter manually',
            value: SOURCES.MANUAL,
          },
        ]
        if (persistentDetails) {
          return {
            options: [{
              label: 'Reuse most recent',
              value: SOURCES.PERSISTENT,
            } as Partial<Option>].concat(options),
          }
        }
        return { options };
      }
    },
    {
      component: CustomComponentTypes.FIELD_LISTENER,
      name: `_${SOURCE_KEY}__listener`,
      target: SOURCE_KEY,
      hideField: true,
      listener: (
        { change }: ReturnType<typeof useFormApi>,
        current: SOURCES,
        _previous: SOURCES,
      ) => {
        if (current === SOURCES.PERSISTENT) {
          const persistentDetails = getPersistentGoogleServiceAccountDetails();
          if (persistentDetails) {
            Object.entries(persistentDetails).forEach(([key, value]) => {
              change(`${SOURCE_DETAILS_KEY}.${key}`, value)
            })
          }
        }
      },
    },
    {
      component: componentTypes.CUSTOM,
      name: FILE_KEY,
      label: 'Service Account JSON file',
      description: 'Choose the json file with Service Account credentials',
      CustomComponent: FileUploadComponent,
      condition: {
        when: SOURCE_KEY,
        is: SOURCES.FILE,
        then: { visible: true },
        else: { visible: false },
      },
      validate: [
        {
          type: validatorTypes.REQUIRED,
        },
      ],
    },
    {
      component: CustomComponentTypes.FIELD_LISTENER,
      name: `_${FILE_KEY}__listener`,
      target: FILE_KEY,
      hideField: true,
      listener: (
        { change }: ReturnType<typeof useFormApi>,
        current: any,
        _previous: any,
      ) => {
        if (current?.content) {
          try {
            change(`${ERROR_KEY}`, null);
            const details = extractGoogleServiceAccountDetails(current.content);
            Object.entries(details).forEach(([key, value]) => {
              change(`${SOURCE_DETAILS_KEY}.${key}`, value)
            })
          } catch (error: any) {
            change(`${ERROR_KEY}`, error.message || String(error))
          }
        }
      },
    },
    {
      component: componentTypes.CUSTOM,
      title: 'Service Account Details',
      name: `${FORM_KEY_PREFIX}.summary`,
      showError: true,
      CustomComponent: ({ meta, data }: any) => {
        return (
          <FormField controlId={`${FORM_KEY_PREFIX}.summary`} errorText={meta.error}>
            <Inline spacing="s">
              <KeyValuePair label="Client Id" value={data[SOURCE_DETAILS_KEY]['clientId']} />
              <KeyValuePair label="Client Email" value={data[SOURCE_DETAILS_KEY]['clientEmail']} />
            </Inline>
          </FormField>
        )
      },
      condition: {
        and: [
          {
            not: {
              when: SOURCE_KEY,
              is: SOURCES.MANUAL,
            }
          },
          {
            or: [
              {
                when: `${FILE_KEY}.content`,
                isNotEmpty: true,
              },
              {
                when: `${SOURCE_DETAILS_KEY}.projectId`,
                isNotEmpty: true,
              },
            ]
          }
        ]
      },
      validate: [
        {
          type: CustomValidatorTypes.CUSTOM,
          validate: googleAuthValidator,
        },
      ],
    },
    {
      component: componentTypes.SUB_FORM,
      title: 'Service Account Details',
      name: `${FORM_KEY_PREFIX}.sourceDetails`,
      expandableSectionVariant: 'borderless',
      condition: {
        when: SOURCE_KEY,
        is: SOURCES.MANUAL,
        then: { visible: true },
        else: { visible: false },
      },
      fields: ([
        {
          component: componentTypes.TEXT_FIELD,
          name: 'sourceDetails.projectId',
          placeholder: 'eg. grape-spaceship-123',
        },
        {
          component: componentTypes.TEXT_FIELD,
          name: 'sourceDetails.clientId',
          placeholder: 'eg. 11xxxxxxxxxxxxxxxxxxx',
        },
        {
          component: componentTypes.TEXT_FIELD,
          name: 'sourceDetails.clientEmail',
          placeholder: 'eg. <service-account-name>@<project-id>.iam.gserviceaccount.com',
        },
        {
          component: componentTypes.TEXT_FIELD,
          name: 'sourceDetails.privateKeyId',
          placeholder: 'eg. a67xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxe',
        },
        {
          component: componentTypes.TEXTAREA,
          name: 'sourceDetails.privateKey',
          rows: 80,
          placeholder: '-----BEGIN PRIVATE KEY-----\nprivate key content\n-----END PRIVATE KEY-----\n',
        },
      ] as AuthField[]).map((field) => {
        const fieldSchema = ConnectorsCommon.Google.GOOGLE_AUTH_SCHEMA.properties![field.name.split('.')[1]];
        field.label = field.label || fieldSchema.title;
        field.description = field.description || fieldSchema.description;
        field.validate = (field.validate || []).concat([
          {
            type: validatorTypes.REQUIRED,
          },
          {
            type: CustomValidatorTypes.JSONSCHEMA,
            schema: fieldSchema,
          }
        ])
        return field;
      }),
    }
  ] as Field[],
};

interface AuthField extends Omit<Field, 'name'> {
  name: `sourceDetails.${keyof ConnectorsCommon.Google.IGoogleServiceAccountAuth}`
}
