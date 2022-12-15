/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors';
import { Field, componentTypes } from 'aws-northstar/components/FormRenderer';
import { GOOGLE_AUTH_FIELD } from '../google/common';
import { generateDataUpdateFields } from './update-trigger';

export function sourceTypeSubForm(
  source: Connectors.IConnector,
  fields: Field[],
  additionalDataUpdateFields?: Field[],
): Field[] {
  const [sourceDetails, updateTrigger] = marshalConnectorWizardFields(fields);

  return [
    {
      component: componentTypes.SUB_FORM,
      title: source.METADATA.label,
      description: source.METADATA.description,
      name: `__${source.ID}__details`,
      condition: {
        when: 'sourceType',
        is: source.ID,
        then: { visible: true },
        else: { visible: false },
      },
      fields: sourceDetails,
    },
    ...generateDataUpdateFields(source, updateTrigger.concat(additionalDataUpdateFields || [])),
  ];
}

type FieldsTuple = [sourceDetails: Field[], updateTrigger: Field[]]

export function marshalConnectorWizardFields (wizardFields: Field[]): FieldsTuple {
  return wizardFields.reduce((tuple, _field) => {
    const [sourceDetails, updateTrigger] = tuple;

    // NB: google-auth is currently replaced with subform fields, but it should be
    // converted to a form component and managed separately. Since plan is to move
    // this auth into managed credential store at application level not worth refactoring
    // this to component now.
    if (_field.component === 'google-auth') {
      _field = GOOGLE_AUTH_FIELD
    }

    if (_field.isUpdateTriggerField === true) {
      updateTrigger.push(_field);
    } else {
      sourceDetails.push(_field);
    }

    return [sourceDetails, updateTrigger];
  }, [[], []] as FieldsTuple);
}
