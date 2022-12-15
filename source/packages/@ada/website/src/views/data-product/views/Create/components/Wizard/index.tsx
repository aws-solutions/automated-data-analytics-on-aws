/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as Connectors from '@ada/connectors';
import * as schema from './schema';
import { DataProductInput } from '@ada/api';
import { DefaultGroupIds } from '@ada/common';
import { ErrorAlert } from '$common/components/errors';
import { FormData, formDataToDataProduct } from '../../utils';
import { HookError, ListAllOptions, NO_REFRESH_OPTIONS, apiHooks } from '$api';
import { Skeletons, WizardLayout, WizardStep, useNotificationContext } from '$northstar-plus';
import { isEmpty, omit, pick } from 'lodash';
import { setPersistentGoogleServiceAccountDetails } from '$connectors/google/common/google-session-credentials';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '$strings';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { DataProductTransform } from '@ada/api';

const OMITTED_INPUT_KEYS: (keyof DataProductInput)[] = [
  // both dataSet and source dataset are handled on backend
  'dataSets',
  'sourceDataSets',
];

const LIST_ALL_OPTIONS: ListAllOptions = {
  // prevent data updates from resetting form states
  ...NO_REFRESH_OPTIONS,
  waitForAll: true,
}

export interface CreateDataProductWizardProps {
  // readonly isSubmitting?: boolean;
  readonly domainId?: string;
}

export const CreateDataProductWizard: React.FC<CreateDataProductWizardProps> = ({ domainId }) => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const { addSuccess, addError, addBrief } = useNotificationContext();

  const [domains, domainsQueryInfo] = apiHooks.useAllDataProductDomains({}, LIST_ALL_OPTIONS);
  const [groups, groupsQueryInfo] = apiHooks.useAllIdentityGroups({}, LIST_ALL_OPTIONS);
  const [scripts, scriptsQueryInfo] = apiHooks.useAllDataProductScripts({}, LIST_ALL_OPTIONS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // use async variant of `mutateAsync` to handle promise direclty
  const [createScriptAsync] = apiHooks.usePutDataProductScriptsNamespaceScriptAsync();
  const [createDataProduct] = apiHooks.usePostDataProductDomainDataProduct({
    onSuccess: (entity) => {
      addSuccess({
        header: LL.ENTITY.DataProduct__CREATED(entity.name),
      });

      history.push(`/data-product/${entity.domainId}/${entity.dataProductId}`);
    },
    onError: (error, _variables) => {
      addError({
        header: LL.ENTITY.DataProduct__FAILED_TO_CREATE(_variables.dataProductId),
        content: error.message,
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const dataFechingErrors = useMemo<HookError[] | null>(() => {
    const errors: HookError[] = [];
    if (domainsQueryInfo.isError) errors.push(domainsQueryInfo.error || LL.ENTITY.Domains__FAILED_TO_FETCH());
    if (groupsQueryInfo.isError) errors.push(groupsQueryInfo.error || LL.ENTITY.Groups__FAILED_TO_FETCH());
    if (scriptsQueryInfo.isError) errors.push(scriptsQueryInfo.error || LL.ENTITY.Transforms__FAILED_TO_FETCH());

    if (errors.length) {
      console.warn(errors);
      return errors;
    }
    return null;
  }, [
    domainsQueryInfo.isError,
    groupsQueryInfo.isError,
    scriptsQueryInfo.isError,
    domainsQueryInfo.error,
    groupsQueryInfo.error,
    scriptsQueryInfo.error,
  ]);

  const [steps, setSteps] = useState<WizardStep[]>();
  useEffect(() => {
    // - Only set steps once to prevent thrashing form state
    // - Only set steps once all required data is available
    if (steps == null && domains && groups && scripts) {
      setSteps(schema.buildSteps(domains, groups, scripts));
    }
  }, [steps, domains, groups, scripts])

  const initialValues = useMemo(
    () => schema.getInitialValues(new URLSearchParams(history.location.search), domainId),
    [history.location.search, domainId],
  );

  const persistGoogleCreds = useCallback((sourceDetails: any) => {
    try {
      // store the credentials in session storage for reuse between data product creation flows
      const serviceAccountDetails = pick(
        sourceDetails || {},
        Connectors.Common.Google.GOOGLE_SERVICE_ACCOUNT_JSON_KEYS
      );
      if (!isEmpty(serviceAccountDetails)) {
        setPersistentGoogleServiceAccountDetails(serviceAccountDetails as any)
      }
    } catch(_error: any) {
      console.warn(_error);
      // ignore given UX enhancement not requirement
    }
  }, [])

  const onSubmit = useCallback(
    async (formData: FormData) => {
      try {
        setIsSubmitting(true);
        const { customTransforms = {} } = formData;
        const dataProduct = formDataToDataProduct(formData);

        if (Connectors.Common.Google.hasGoogleAuthKeys(dataProduct.sourceDetails)) {
          persistGoogleCreds(dataProduct.sourceDetails)
        }

        // store list of custom transformed being created so we don't duplicate
        const resolvedCustomTranforms: Record<string, Promise<DataProductTransform>> = {};

        // Save inline scripts that were defined during the planner phase.
        // We only save the scripts that are actually used
        const transforms = await Promise.all<DataProductTransform>(
          dataProduct.transforms.map(({ namespace, scriptId, inlineScriptContent, inputArgs }) => {
            const id = `${namespace}.${scriptId}`;
            const isCustom = id in customTransforms;

            if (inlineScriptContent && !isCustom) {
              throw new Error(LL.VIEW.DATA_PRODUCT.Wizard.SUBMIT.CUSTOM_TRANSFORM.error.failedToMap({ id }));
            }

            if (id in resolvedCustomTranforms) {
              // return promise for already creating custom transform
              return resolvedCustomTranforms[id];
            }

            if (isCustom) {
              // eslint-disable-next-line no-async-promise-executor
              return new Promise<DataProductTransform>(async (resolve, reject) => {
                const { namespace, name, description, inlineScriptContent } = customTransforms[id]; //NOSONAR (S1117:ShadowVar) - ignore for readability

                addBrief({
                  type: 'info',
                  header: LL.VIEW.DATA_PRODUCT.Wizard.SUBMIT.CUSTOM_TRANSFORM.notify.creatingScript(),
                  content: name,
                });

                try {
                  const promise = createScriptAsync({
                    // Namespace under the data product's domain
                    namespace,
                    scriptId,
                    scriptInput: {
                      namespace,
                      scriptId,
                      name,
                      description,
                      source: inlineScriptContent,
                    },
                  });

                  // store resolved promise for duplicate transforms in plan
                  // store this before awaiting so we don't duplicate
                  resolvedCustomTranforms[id] = promise.then((_scriptEntity) => ({
                    namespace: _scriptEntity.namespace,
                    scriptId: _scriptEntity.scriptId,
                  }));

                  const scriptEntity = await promise;

                  addSuccess({
                    header: LL.VIEW.DATA_PRODUCT.Wizard.SUBMIT.CUSTOM_TRANSFORM.notify.createdScript({ name }),
                  });

                  resolve({
                    namespace: scriptEntity.namespace,
                    scriptId: scriptEntity.scriptId,
                  });
                } catch (error: any) {
                  addError({
                    header: LL.VIEW.DATA_PRODUCT.Wizard.SUBMIT.CUSTOM_TRANSFORM.notify.failedToCreateScript({ name }),
                    content: error.message,
                  });
                  reject(error);
                }
              });
            } else {
              return Promise.resolve<DataProductTransform>({ namespace, scriptId, inputArgs });
            }
          }),
        );

        const initialFullAccessGroups = [DefaultGroupIds.ADMIN];

        createDataProduct({
          domainId: dataProduct.domainId,
          dataProductId: dataProduct.dataProductId,
          initialFullAccessGroups,
          dataProductInput: {
            ...(omit(dataProduct, OMITTED_INPUT_KEYS) as DataProductInput),
            // apply all resolved inline templates
            transforms,
          },
        });
      } catch (error: any) {
        setIsSubmitting(false);
        addError({
          header: LL.ENTITY.DataProduct__FAILED_TO_CREATE(formData.name),
          content: error.message,
        });
      }
    },
    [createDataProduct, createScriptAsync, addSuccess, addError],
  );

  if (dataFechingErrors) {
    return <ErrorAlert header={LL.VIEW.notify.error.fetch('data')} error={dataFechingErrors} />;
  }

  if (steps == null) {
    return <Skeletons.Wizard />;
  }

  return (
    <WizardLayout
      steps={steps}
      onSubmit={onSubmit as any}
      onCancel={() => history.goBack()}
      initialValues={initialValues}
      isSubmitting={isSubmitting}
      customComponentWrapper={schema.customComponents}
    />
  );
};
