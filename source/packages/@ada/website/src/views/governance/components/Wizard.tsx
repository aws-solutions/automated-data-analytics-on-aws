/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, Stack } from 'aws-northstar';
import { AttributePolicy, AttributeValuePolicy, Ontology, OntologyIdentifier, OntologyInput } from '@ada/api';
import { CustomComponentTypes, ErrorAlert } from '$common/components';
import { CustomValidatorTypes } from '$common/components/form-renderer/validators';
import { ID_VALIDATION, OntologyNamespace, ReservedDomains, buildNamespaceAndAttributeId } from '@ada/common';
import {
  LENSE_OPTIONS,
  LENSE_OPTIONS_WITH_NULLABLE,
  NONE_LENS_OPTION,
} from '$common/entity/ontology';
import { NO_REFRESH_OPTIONS, apiHooks } from '$api';
import { OntologyGovernanceGroup, useOntologyGovernanceAttribute } from '../hooks';
import { Skeletons, WizardLayout, WizardStep, useNotificationContext } from '$northstar-plus';
import { componentTypes } from 'aws-northstar/components/FormRenderer/types';
import { getOntologyIdString, isDataEqual, nameToIdentifier } from '$common/utils';
import { getSortedGroupArray } from '../utils/getSortedGroupArray';
import { omit, pick } from 'lodash';
import { useFormApi } from '@data-driven-forms/react-form-renderer';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '$strings';
import { validatorTypes } from 'aws-northstar/components/FormRenderer';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

/* eslint-plugin-disable sonarjs */

const RESERVED_NAMESPACES = (Object.values(ReservedDomains) as string[]).concat([
  OntologyNamespace.PII_CLASSIFICATIONS,
]);

// Can't import from @ada/infra in website, so have to just hardocde here
const SYSTEM = 'system';

const ALLOWED_SYSTEM_MUTABLES: (keyof OntologyInput)[] = ['defaultLens', 'aliases'];

interface FormData extends Ontology {
  updatedTimestamp?: string;
  existing?: boolean;
  system?: boolean;
  groups?: OntologyGovernanceGroup[];
}

export const CreateOntologyWizard: React.FC = () => {
  const initialValues = useMemo<Partial<FormData>>(() => {
    return {
      ontologyNamespace: OntologyNamespace.DEFAULT,
      aliases: [],
      columnGovernance: {
      },
      rowGovernance: {
      },
      groups: [],
    };
  }, []);

  return <Wizard initialValues={initialValues} />;
};

const renderCustomComponent = (
  content: string,
  system?: boolean,
) => () => {
  if (system) {
    return <Alert type="info">{content}</Alert>;
  }
  return null;
};

export const UpdateOntologyWizard: React.FC<{ id: OntologyIdentifier }> = ({ id }) => {
  const [existingOntology, { isLoading: isLoadingExisting, error }] = apiHooks.useOntology(id, NO_REFRESH_OPTIONS);
  const [governance, { isLoading: isLoadingGoverance }] = useOntologyGovernanceAttribute(id);

  const [initialValues, setInitialValues] = useState<Partial<FormData>>();

  useEffect(() => {
    if (initialValues == null && !isLoadingGoverance && !isLoadingExisting) {
      setInitialValues({
        ...existingOntology,

        existing: true,
        system: existingOntology?.createdBy === SYSTEM,
        groups: getSortedGroupArray(governance),
      });
    }
  }, [isLoadingExisting, isLoadingGoverance]);

  if (initialValues == null || error) {
    return (
      <Stack>
        {error && <ErrorAlert error={error} />}

        <Skeletons.Wizard />
      </Stack>
    );
  }

  return <Wizard initialValues={initialValues} />;
};

const Wizard: React.FC<{ initialValues: Partial<FormData> }> = ({ initialValues }) => {
  const history = useHistory();
  const { LL } = useI18nContext();

  const LL_ONTOLOGY_ATTR = LL.ENTITY['Ontology@'];

  const steps = useMemo<WizardStep[]>(() => {
    const { system } = initialValues;

    return [
      {
        title: LL.VIEW.GOVERNANCE.wizard.step.details.title(),
        description: LL.VIEW.GOVERNANCE.wizard.step.details.description(),
        fields: [
          {
            component: componentTypes.CUSTOM,
            name: '__system_warning',
            hidenField: !system,
            CustomComponent: renderCustomComponent(LL.VIEW.GOVERNANCE.wizard.alert.systemEntity(), system),
          },
          {
            // TODO: use freeform select without restricted global
            component: CustomComponentTypes.ENTITY_IDENTIFIER,
            name: 'ontologyNamespace',
            label: LL_ONTOLOGY_ATTR.namespace.label(),
            description: LL_ONTOLOGY_ATTR.namespace.description(),
            helperText: LL_ONTOLOGY_ATTR.namespace.hintText(),
            isRequired: true,
            resolveProps: (_props, _field, form) => {
              const { existing, system: isSystem } = form.getState().initialValues as FormData;
              const isReadOnly = existing || isSystem;
              return {
                isReadOnly,
                disabled: isReadOnly,
              };
            },
            validate: [
              {
                type: validatorTypes.REQUIRED,
              },
              {
                type: validatorTypes.PATTERN,
                pattern: new RegExp(ID_VALIDATION.pattern!),
              },
              {
                type: CustomValidatorTypes.CUSTOM,
                validate: (value: string, allValues: FormData) => {
                  if (!allValues.system && RESERVED_NAMESPACES.includes(value.toLowerCase() as any)) {
                    return LL.VIEW.GOVERNANCE.ERROR.reservedNamespace(RESERVED_NAMESPACES.join(', '));
                  }

                  return undefined;
                },
              },
            ],
          },
          {
            component: CustomComponentTypes.ENTITY_NAME,
            name: 'name',
            label: LL_ONTOLOGY_ATTR.name.label(),
            description: LL_ONTOLOGY_ATTR.name.description(),
            isRequired: true,
            resolveProps: (_props, _field, form) => {
              const { existing, system: isSystem } = form.getState().initialValues as FormData;
              const isReadOnly = existing || isSystem;
              return {
                isReadOnly,
                disabled: isReadOnly,
              };
            },
            validate: [
              {
                type: validatorTypes.REQUIRED,
              },
            ],
          },
          {
            component: componentTypes.TEXT_FIELD,
            name: 'description',
            label: LL_ONTOLOGY_ATTR.description.label(),
            description: LL_ONTOLOGY_ATTR.description.description(),
            resolveProps: (_props, _field, form) => {
              const { system: isSystem } = form.getState().initialValues as FormData;
              return {
                isReadOnly: isSystem,
                disabled: isSystem,
              };
            },
            validate: [],
          },
          {
            component: CustomComponentTypes.FIELD_ARRAY,
            name: 'aliases',
            label: LL_ONTOLOGY_ATTR.aliases.label(),
            description: LL_ONTOLOGY_ATTR.aliases.description(),
            addButtonText: LL.VIEW.GOVERNANCE.Alias.add(),
            placeholder: LL.VIEW.GOVERNANCE.Alias.enter(),
            fields: [
              {
                component: componentTypes.TEXT_FIELD,
                name: 'name',
                validate: [
                  {
                    type: validatorTypes.REQUIRED,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        title: LL.VIEW.GOVERNANCE.wizard.step.governance.title(),
        description: LL.VIEW.GOVERNANCE.wizard.step.governance.description(),
        fields: [
          // Basic
          {
            component: componentTypes.SELECT,
            name: 'defaultLens',
            label: LL_ONTOLOGY_ATTR.defaultLens.label(),
            description: LL_ONTOLOGY_ATTR.defaultLens.description(),
            isRequired: true,
            options: LENSE_OPTIONS,
            validate: [
              {
                type: validatorTypes.REQUIRED,
              },
            ],
          },
          {
            component: CustomComponentTypes.GOVERNANCE_EDIT,
            name: 'groups',
            fields: [
              {
                component: componentTypes.SELECT,
                name: `column`,
                label: LL.ENTITY.AttributePolicy(),
                description: LL.ENTITY.AttributePolicy_description(),
                isOptional: true,
                options: LENSE_OPTIONS_WITH_NULLABLE,
              },
              {
                component: CustomComponentTypes.CODE_EDITOR,
                name: `row`,
                label: LL.ENTITY.AttributeValuePolicy(),
                description: LL.ENTITY.AttributeValuePolicy_description(),
                mode: 'sql',
                // @ts-ignore
                resolveProps: (_props, _field, form) => {
                  const { ontologyNamespace = 'abc', name = 'attribute' } = form.getState().values;
                  const id = getOntologyIdString({ ontologyId: nameToIdentifier(name), ontologyNamespace });

                  return {
                    helpText: `eg. "${id}" > 100`,
                    hintText: `eg. "${id}" > 100`,
                  };
                },
                validate: [
                  {
                    type: CustomValidatorTypes.SQL_CLAUSE,
                  },
                ],
              },
            ],
          }
        ],
      },
    ];
  }, [initialValues.system, initialValues.existing]);

  const [onSubmit, { isSubmitting }] = useSaveOntology();

  const cancelHandler = useCallback(() => {
    history.goBack();
  }, [history]);

  return (
    <WizardLayout
      steps={steps}
      initialValues={initialValues}
      isSubmitting={isSubmitting}
      onSubmit={onSubmit as any}
      onCancel={cancelHandler}
    />
  );
};

const useSaveOntology = () => {
  const history = useHistory();
  const { LL } = useI18nContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addError, addSuccess } = useNotificationContext();

  const [batchPutAttributes] = apiHooks.usePutGovernancePolicyAttributesAsync();
  const [batchDeleteAttributes] = apiHooks.useDeleteGovernancePolicyAttributesAsync();
  const [batchPutAttributeValues] = apiHooks.usePutGovernancePolicyAttributeValuesAsync();
  const [batchDeleteAttributeValues] = apiHooks.useDeleteGovernancePolicyAttributeValuesAsync();
  const [putOntology] = apiHooks.usePutOntologyAsync();

  /* eslint-disable sonarjs/cognitive-complexity */
  const saveHandler = useCallback(
    async (formData: FormData, form: ReturnType<typeof useFormApi>) => { //NOSONAR (S3776:Cognitive Complexity) - won't fix
      try {
        setIsSubmitting(true);
        const formState = form.getState();
        const isExisting = formData.existing === true;
        const isSystem = formData.system === true;
        const modified = formState.modified || {};
        const { name, ontologyNamespace, description, defaultLens, updatedTimestamp, aliases } = formData;

        const ontologyId = nameToIdentifier(name);
        if (formData.ontologyId && formData.ontologyId !== ontologyId) {
          throw new Error(`Form name and ontologyId are inconsistent for update`);
        }

        const namespaceAndAttributeId = buildNamespaceAndAttributeId(ontologyNamespace, ontologyId);

        if (isExisting !== true) {
          // CREATE NEW
          await putOntology({
            ontologyId,
            ontologyNamespace,
            ontologyInput: {
              name: name,
              defaultLens,
              description,
              aliases,
            },
          });

          const attributePolicies: AttributePolicy[] = [];
          const attributeValuePolicies: AttributeValuePolicy[] = [];

          (formData.groups || []).forEach((groupRecord) => {

            if (groupRecord.column && groupRecord.column !== NONE_LENS_OPTION.value) {
              attributePolicies.push({
                group: groupRecord.groupId,
                namespaceAndAttributeId,
                lensId: groupRecord.column,
              })
            }

            if (groupRecord.row && groupRecord.row !== NONE_LENS_OPTION.value) {
              attributeValuePolicies.push({
                group: groupRecord.groupId,
                namespaceAndAttributeId,
                sqlClause: groupRecord.row,
              });
            }
          });

          const operations: Promise<any>[] = [];

          if (attributePolicies.length > 0) {
            operations.push(batchPutAttributes({
              putGovernancePolicyAttributesRequest: {
                policies: attributePolicies,
              }
            }));
          }

          if (attributeValuePolicies.length > 0) {
            operations.push(batchPutAttributeValues({
              putGovernancePolicyAttributeValuesRequest: {
                policies: attributeValuePolicies,
              }
            }))
          }

          operations.length > 0 && await Promise.all(operations);

          addSuccess({
            header: LL.ENTITY.Ontology__CREATED(name),
          });
        } else {
          // UPDATE EXISTING
          const entityKeys = ['defaultLens', 'aliases', 'description'] as (keyof Ontology)[];
          const isEntityModified = isDataEqual(pick(formData, entityKeys), pick(formState.values, entityKeys));

          // can not update system
          if (isEntityModified) {
            if (isSystem === true) {
              // ensure that only `defaultLens` is mutable for system ontologies
              if (Object.keys(omit(pick(modified, entityKeys), ALLOWED_SYSTEM_MUTABLES)).length > 0) {
                throw new Error(
                  `Only ${LL.ENTITY['Ontology@'].defaultLens.label()} and ${LL.ENTITY['Ontology@'].aliases.label()} are allowed to be edited for system ${LL.ENTITY.Ontology()}`,
                );
              }
            }

            await putOntology({
              ontologyId,
              ontologyNamespace,
              ontologyInput: {
                name: name,
                defaultLens,
                description,
                aliases,
                updatedTimestamp,
              },
            });
          }

          const attributePolicies: AttributePolicy[] = [];
          const attributeValuePolicies: AttributeValuePolicy[] = [];

          const deleledAttributePolicies: AttributePolicy[] = [];
          const deletedAttributeValuePolicies: AttributeValuePolicy[] = [];

          (formData.groups || []).forEach((groupRecord) => {
            // Original groupRecords
            const initValue = formState.initialValues.groups.find((g: any) => g.groupId === groupRecord.groupId);

            if (!groupRecord.column || groupRecord.column === NONE_LENS_OPTION.value) {
              // DELETE if previously had value but now is empy
              if (initValue?.column) {
                deleledAttributePolicies.push({
                  group: groupRecord.groupId,
                  namespaceAndAttributeId,
                  lensId: initValue?.column,
                });
              }
            } else if (initValue?.column !== groupRecord.column) {
              // SET if has value and modified
              attributePolicies.push({
                group: groupRecord.groupId,
                namespaceAndAttributeId,
                lensId: groupRecord.column,
              })
            }

            if (!groupRecord.row) {
              // DELETE if previously had value but now is empy
              if (initValue?.row) {
                deletedAttributeValuePolicies.push({
                  group: groupRecord.groupId,
                  namespaceAndAttributeId,
                  sqlClause: '',
                });
              }
            } else if (initValue?.row !== groupRecord.row) {
              // SET if has value and modified
              attributeValuePolicies.push({
                group: groupRecord.groupId,
                namespaceAndAttributeId,
                sqlClause: groupRecord.row,
              });
            }
          });

          (formState.initialValues.groups || [])
            .filter((g: any) => !formData.groups?.find(xg => xg.groupId === g.groupId))
            .forEach((groupRecord: any) => {
              if (groupRecord.column) {
                deleledAttributePolicies.push({
                  group: groupRecord.groupId,
                  namespaceAndAttributeId,
                  lensId: groupRecord.column,
                });
              }

              if (groupRecord.row) {
                deletedAttributeValuePolicies.push({
                  group: groupRecord.groupId,
                  namespaceAndAttributeId,
                  sqlClause: groupRecord.row,
                });
              }
            });

          const operations: Promise<any>[] = [];

          if (attributePolicies.length > 0) {
            operations.push(batchPutAttributes({
              putGovernancePolicyAttributesRequest: {
                policies: attributePolicies,
              }
            }));
          }

          if (attributeValuePolicies.length > 0) {
            operations.push(batchPutAttributeValues({
              putGovernancePolicyAttributeValuesRequest: {
                policies: attributeValuePolicies,
              }
            }));
          }

          if (deleledAttributePolicies.length > 0) {
            operations.push(batchDeleteAttributes({
              deleteGovernancePolicyAttributesRequest: {
                policies: deleledAttributePolicies,
              }
            }));
          }

          if (deletedAttributeValuePolicies.length > 0) {
            operations.push(batchDeleteAttributeValues({
              deleteGovernancePolicyAttributeValuesRequest: {
                policies: deletedAttributeValuePolicies,
              }
            }));
          }

          operations.length > 0 && await Promise.all(operations);

          addSuccess({
            header: LL.ENTITY.Ontology__UPDATED(name),
          });
        }

        history.push(`/governance/${getOntologyIdString({ ontologyId, ontologyNamespace })}`);
      } catch (error: any) {
        addError({
          /* eslint-disable-next-line no-restricted-globals */
          header: LL.ENTITY.Ontology__FAILED_TO_CREATE_OR_UPDATE(name!), //NOSONAR
          content: error.message,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [history, addSuccess, addError],
  );
  /* eslint-enable sonarjs/cognitive-complexity */

  return [saveHandler, { isSubmitting }] as const;
};
