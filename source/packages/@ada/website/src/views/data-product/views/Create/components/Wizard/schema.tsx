/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, Button, Container, KeyValuePair, Stack } from 'aws-northstar';
import { CardSelect, CardSelectOption, CustomComponentTypes, CustomWrapper } from '$common/components';
import { CodeViewer } from '$common/components/CodeViewer';
import { ConfirmedButton } from '$northstar-plus';
import { ConnectorBadgeList } from '$connectors/common/ConnectorBadge';
import { ConnectorIcons } from '$connectors/icons';
import { Connectors } from '@ada/connectors';
import { CustomValidatorTypes } from '$common/components/form-renderer/validators';
import { DataProductSummaryRenderer } from '$views/data-product/components/summary/Summary';
import { DataProductUpdateTriggerType } from '@ada/common';
import { FormData, FormDataSchema, formDataToDataProduct } from '../../utils';
import { LL } from '$strings';
import { SchemaPreviewStep } from '../SchemaPreview';
import { SchemaRenderer } from '$views/data-product/components/schema/SchemaRenderer';
import { TransformBuilder } from '../TransformsPlanner';
import { ValidatorFunction } from '@data-driven-forms/react-form-renderer/validators';
import { WizardStep } from '$northstar-plus/layouts/WizardLayout';
import { componentTypes } from 'aws-northstar/components/FormRenderer/types';
import { isEmpty, omit } from 'lodash';
import { sourceTypeSubForm } from '$connectors/common';
import { validatorTypes } from 'aws-northstar/components/FormRenderer';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';
import type { Domain, Group, Script } from '@ada/api';

/* eslint-disable sonarjs/no-duplicate-string */

export const customComponents = {
  'card-select': CardSelect as any,
  'custom-wrapper': CustomWrapper as any,
};

function isPreviewSupported(sourceType: Connectors.ID): boolean {
  return Connectors.find(sourceType).CONFIG.supports.preview === true;
}

export const buildSteps = (_domains: Domain[], _groups: Group[], _scripts: Script[]): WizardStep[] => [
  {
    title: LL.VIEW.DATA_PRODUCT.Wizard.title(),
    description: LL.VIEW.DATA_PRODUCT.Wizard.subtitle(),

    fields: [
      {
        component: componentTypes.SELECT,
        name: 'domainId',
        label: LL.ENTITY['DataProduct@'].domainId.label(),
        description: LL.ENTITY['DataProduct@'].domainId.description(),
        hintText: LL.ENTITY['DataProduct@'].domainId.hintText(),
        isRequired: true,
        options: _domains.map((_domain) => ({ value: _domain.domainId, label: _domain.name })),
        validate: [
          {
            type: validatorTypes.REQUIRED,
          },
        ],
      },
      {
        component: CustomComponentTypes.ENTITY_NAME,
        name: 'name',
        label: LL.ENTITY['DataProduct@'].name.label(),
        description: LL.ENTITY['DataProduct@'].name.description(),
        isRequired: true,
        validate: [
          {
            type: validatorTypes.REQUIRED,
          },
        ],
      },
      {
        component: componentTypes.TEXT_FIELD,
        name: 'description',
        label: LL.ENTITY['DataProduct@'].description.label(),
        description: LL.ENTITY['DataProduct@'].description.description(),
        validate: [],
      },
      // reset "sourceDetails" and "updateTrigger" whenever source type changes
      {
        component: CustomComponentTypes.FIELD_LISTENER,
        name: 'source-type-listener',
        target: 'sourceType',
        hideField: true,
        listener: (
          { change }: ReturnType<typeof useFormApi>,
          current: FormData['sourceType'],
          _previous: FormData['sourceType'],
        ) => {
          // set the configuration data based on selected source
          if (current) {
            change('isPreviewSupported', isPreviewSupported(current));
          }
          // reset dependent fields
          change('sourceDetails', {});
          change('updateTrigger', {});
        },
      },
      {
        component: CustomComponentTypes.CARD_SELECT,
        name: 'sourceType',
        label: LL.ENTITY['DataProduct@'].sourceType.label(),
        description: LL.ENTITY['DataProduct@'].sourceType.description(),
        isRequired: true,
        options: Connectors.getAllConnectors().reduce((_options, _connector): CardSelectOption[] => {
          const ConnectorIcon = ConnectorIcons[_connector.ID];
          return _options.concat([
            {
              value: _connector.ID,
              icon: <ConnectorIcon width={40} height={40} />,
              title: _connector.METADATA.label,
              subtitle: _connector.METADATA.description,
              content: <ConnectorBadgeList connector={_connector} />
            },
          ]);
        }, [] as CardSelectOption[]),
        validate: [
          {
            type: validatorTypes.REQUIRED,
          },
        ],
      },
      {
        component: componentTypes.SWITCH,
        name: 'enableAutomaticPii',
        label: LL.ENTITY['DataProduct@'].enableAutomaticPii.label(),
        description: LL.ENTITY['DataProduct@'].enableAutomaticPii.description(),
        hintText: LL.ENTITY['DataProduct@'].enableAutomaticPii.hintText(),
      },
      {
        component: CustomComponentTypes.TAG_GROUP,
        name: 'tags',
        label: LL.ENTITY['DataProduct@'].tags.label(),
        description: LL.ENTITY['DataProduct@'].tags.description(),
      },
    ],
  },
  {
    title: LL.VIEW.DATA_PRODUCT.Wizard.SourceDetails.title(),
    description: LL.VIEW.DATA_PRODUCT.Wizard.SourceDetails.subtitle(),
    onNextButtonClick: (_event, _wizard) => {
      // always reset the schemas after source details have been changed
      _wizard.form.change('inferredSchema', {});
      _wizard.form.change('transformedSchema', {});

      if (_wizard.form.getState().values.isPreviewSupported !== true) {
        // if source type does not support preview, skip the schema+transform steps
        return _wizard.props.activeStepIndex + 3;
      }

      return undefined;
    },
    fields: [
      // reset preview whenever the "sourceDetails" change
      {
        component: CustomComponentTypes.FIELD_LISTENER,
        name: 'source-details-listener',
        target: 'sourceDetails',
        hideField: true,
        listener: (
          { change }: ReturnType<typeof useFormApi>,
          _current: FormData['sourceDetails'],
          _previous: FormData['sourceDetails'],
        ) => {
          change('inferredSchema', {});
          change('transformedSchema', {});
          change('skipPreview', false);
          change('skipTransform', false);
          change('canSkipPreview', false);
        },
      },
      // conditionally expose fields for all source type details
      ...Connectors.getAllConnectors().flatMap((_connector) => {
        return sourceTypeSubForm(_connector, _connector.VIEW.Wizard.fields);
      }),
    ],
  },
  {
    title: LL.VIEW.DATA_PRODUCT.Wizard.Schema.title(),
    isOptional: true,
    actionsRenderer: (wizardState, actions) => {
      const { change } = wizardState.form;
      const { valid, submitting, values } = wizardState.form.getState();
      const { skipPreview, canSkipPreview } = values;
      const disableNext = !skipPreview && (!valid || submitting || wizardState.props.isLoadingNextStep);

      const onSkipConfirm = () => {
        change('inferredSchema', {});
        change('transformedSchema', {});
        change('skipPreview', true);
        change('skipTransform', true);
        wizardState.props.setActiveStepIndex((current) => current + 2);
      };

      // [cancel, previous] + add [next-transform, next-skip-transform]
      return actions.slice(0, 2).concat([
        <ConfirmedButton
          key="skip"
          title={LL.VIEW.DATA_PRODUCT.Wizard.ACTIONS.skipPreview.confirm.title()}
          subtitle={LL.VIEW.DATA_PRODUCT.Wizard.ACTIONS.skipPreview.confirm.subtitle()}
          buttonText={LL.VIEW.DATA_PRODUCT.Wizard.ACTIONS.skipPreview.buttonText()}
          onConfirm={onSkipConfirm}
          disabled={canSkipPreview === false}
        >
          {LL.VIEW.DATA_PRODUCT.Wizard.ACTIONS.skipPreview.confirm.content()}
        </ConfirmedButton>,
        <Button
          key="next-with-transform"
          disabled={disableNext}
          onClick={() => {
            wizardState.form.change('skipTransform', false);
            wizardState.props.setActiveStepIndex((current) => current + 1);
          }}
        >
          {LL.VIEW.DATA_PRODUCT.Wizard.ACTIONS.transformSchema.text()}
        </Button>,
        <Button
          key="next-skip-transform"
          disabled={disableNext}
          variant="primary"
          onClick={() => {
            wizardState.form.change('skipTransform', true);
            wizardState.props.setActiveStepIndex((current) => current + 2);
          }}
        >
          {LL.VIEW.DATA_PRODUCT.Wizard.ACTIONS.continueWithCurrentSchema.text()}
        </Button>,
      ]);
    },
    fields: [
      // replace "transformedSchema" with "inferredSchema" whenever updated
      {
        component: CustomComponentTypes.FIELD_LISTENER,
        name: 'inferred-schema-listener',
        target: 'inferredSchema',
        hideField: true,
        listener: (
          { change }: ReturnType<typeof useFormApi>,
          current: FormData['inferredSchema'],
          _previous: FormData['inferredSchema'],
        ) => {
          change('transformedSchema', current);
        },
      },
      {
        component: componentTypes.CUSTOM,
        name: 'inferredSchema',
        CustomComponent: SchemaPreviewStep,
        isRequired: true,
        validate: [
          {
            type: validatorTypes.REQUIRED,
          },
          {
            type: CustomValidatorTypes.CUSTOM,
            validate: schemaStepValidator(LL),
          },
        ],
      },
    ],
  },
  {
    title: LL.VIEW.DATA_PRODUCT.Wizard.Transforms.title(),
    isOptional: true,
    fields: [
      {
        component: componentTypes.CUSTOM,
        name: 'transformedSchema',
        CustomComponent: (props: any) => <TransformBuilder scripts={_scripts} {...props} />,
        validate: [
          {
            type: validatorTypes.REQUIRED,
          },
          {
            type: CustomValidatorTypes.CUSTOM,
            validate: schemaStepValidator(LL),
          },
        ],
      },
    ],
  },
  {
    title: LL.VIEW.wizard.STEP.review.title(),
    onPreviousButtonClick: (_event, _wizard) => {
      const { values } = _wizard.form.getState();
      const { isPreviewSupported, skipPreview, skipTransform } = values; //NOSONAR (S1117:ShadowVar) - ignore for readability
      if (!isPreviewSupported || skipPreview) {
        return _wizard.props.activeStepIndex - 3;
      }
      if (skipTransform) {
        return _wizard.props.activeStepIndex - 2;
      } else {
        return _wizard.props.activeStepIndex - 1;
      }
    },
    fields: [
      {
        component: componentTypes.REVIEW,
        name: 'review',
        Template: ({ data }: { data: FormData }) => {
          const dataProduct = formDataToDataProduct(data);
          const skipPreview = data.skipPreview === true;
          const isPreviewSupported = data.isPreviewSupported === true; //NOSONAR (S1117:ShadowVar) - ignore for readability
          const preview =
            !isPreviewSupported || skipPreview
              ? undefined
              : (data.skipTransform ? data.inferredSchema : data.transformedSchema)?.preview; //NOSONAR

          return (
            <Stack>
              <Stack>
                <KeyValuePair label={LL.ENTITY['DataProduct@'].name.label()} value={dataProduct.name} />
                <KeyValuePair label={LL.ENTITY['DataProduct@'].description.label()} value={dataProduct.description} />
              </Stack>
              <DataProductSummaryRenderer
                {...dataProduct}
                title={LL.VIEW.DATA_PRODUCT.Wizard.REVIEW.Details.title()}
                sourceDetailsCollapsible={false}
              />
              <Container
                title={LL.VIEW.DATA_PRODUCT.Wizard.REVIEW.Permissions.title()}
              >
                <Alert>{LL.VIEW.DATA_PRODUCT.Wizard.REVIEW.Permissions.content()}</Alert>
              </Container>
              {preview && (
                <Container
                  title={LL.VIEW.DATA_PRODUCT.Wizard.REVIEW.Schema.title()}
                  subtitle={LL.VIEW.DATA_PRODUCT.Wizard.REVIEW.Schema.subtitle()}
                  gutters={false}
                >
                  <SchemaRenderer preview={omit(preview, 'initialDataSets')} />
                </Container>
              )}
              {data.customTransforms && !isEmpty(data.customTransforms) && (
                <Container
                  title={LL.VIEW.DATA_PRODUCT.Wizard.REVIEW.CustomTransforms.title()}
                  subtitle={LL.VIEW.DATA_PRODUCT.Wizard.REVIEW.CustomTransforms.title()}
                >
                  {Object.entries(data.customTransforms).map(([key, customTransform]) => (
                    <KeyValuePair
                      key={key}
                      label={customTransform.name}
                      value={
                        <CodeViewer
                          mode="python"
                          disableSelection
                          minLines={8}
                          maxLines={20}
                          value={customTransform.inlineScriptContent}
                        />
                      }
                    />
                  ))}
                </Container>
              )}
            </Stack>
          );
        },
      },
    ],
  },
];

export const getInitialValues = (_urlParams: URLSearchParams, domainId?: string): Partial<FormData> => ({
  domainId,
  name: undefined,
  sourceType: undefined,
  enableAutomaticTransforms: true,
  enableAutomaticPii: true,
  // discoverable: true,
  tags: [],
  inferredSchema: {
    preview: undefined,
    sourceDetails: undefined,
    transforms: undefined,
  },
  transformedSchema: {
    preview: undefined,
    sourceDetails: undefined,
    transforms: undefined,
  },
  customTransforms: {},
  updateTrigger: {
    triggerType: DataProductUpdateTriggerType.ON_DEMAND,
  },
});

const schemaStepValidator = (_LL: typeof LL) => ((value: FormDataSchema, allValues: FormData) => {
  if (allValues.skipPreview) return undefined;
  if (value == null || value.preview == null) {
    return LL.VIEW.DATA_PRODUCT.Wizard.Schema.PREVIEW.VALIDATOR.missingOrInvalid();
  }
  const status = value.preview.status;
  switch (status) {
    case 'ABORTED':
    case 'TIMED_OUT':
      return LL.VIEW.DATA_PRODUCT.Wizard.Schema.PREVIEW.VALIDATOR.status(status);
    case 'FAILED':
      return value.preview.error || LL.VIEW.DATA_PRODUCT.Wizard.Schema.PREVIEW.VALIDATOR.status(status);
    case 'RUNNING':
      return LL.VIEW.DATA_PRODUCT.Wizard.Schema.PREVIEW.VALIDATOR.running();
  }
  if (value.preview.error) {
    return value.preview.error;
  }

  return undefined;
}) as ValidatorFunction;
