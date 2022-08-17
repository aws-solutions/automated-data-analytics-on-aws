/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CustomComponentTypes, FormRenderer } from '$common/components/form-renderer';
import { Modal, componentTypes, validatorTypes } from 'aws-northstar';
import { Schema } from 'aws-northstar/components/FormRenderer';
import { Tags } from '@ada/api';
import { apiHooks, useApiInvalidation } from '$api';
import { nameToIdentifier } from '$common/utils';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useNotificationContext } from '$northstar-plus';
import { useQueryWorkbench } from '../context';
import { useUserId } from '$core/provider/UserProvider';
import React, { useCallback, useMemo, useState } from 'react';

/* eslint-disable sonarjs/no-duplicate-string */

interface FormData {
  shared: boolean;
  domain: string;
  name: string;
  description?: string;
  tags: Tags;
}

export interface SaveQueryDialogProps {
  onClose: () => void;
}

export const SaveQueryDialog: React.FC<SaveQueryDialogProps> = ({ onClose }) => {
  const { LL } = useI18nContext();
  const { addError, addSuccess } = useNotificationContext();
  const userId = useUserId();
  const { getQuery } = useQueryWorkbench();
  const [domains] = apiHooks.useAllDataProductDomains();
  const { invalidateEntityLists } = useApiInvalidation();
  const [visible, setVisible] = useState<boolean>(true);

  const [saveQuery, { isLoading: isSubmitting }] = apiHooks.usePutQuerySavedQuery({
    onError: (error, { queryId }) => {
      console.error('Failed to save query', error);
      addError({
        header: LL.ENTITY.SavedQuery__FAILED_TO_CREATE(queryId),
        content: error.message,
      });
    },
    onSuccess: (result) => {
      console.debug('Successfuly saved query', result);
      addSuccess({
        header: LL.ENTITY.SavedQuery__CREATED(result.queryId),
        content: result.description,
      });
      if (result.type === 'PUBLIC') {
        invalidateEntityLists('QuerySavedQuery');
      } else {
        invalidateEntityLists('QueryNamespaceSavedQuery');
      }
      close();
    },
  });

  const schema = useMemo<Schema>(() => {
    if (domains == null) {
      return {
        fields: [],
      };
    }
    return {
      fields: [
        {
          component: componentTypes.SWITCH,
          name: 'shared',
          label: LL.VIEW.QUERY.SAVED_QUERY.shared.label(),
          description: LL.VIEW.QUERY.SAVED_QUERY.shared.description(),
        },
        {
          component: componentTypes.SELECT,
          name: 'domain',
          label: LL.VIEW.QUERY.SAVED_QUERY.domain.label(),
          description: LL.VIEW.QUERY.SAVED_QUERY.domain.description(),
          options: domains.map((domain) => ({ value: domain.domainId, label: domain.name })),
          condition: { when: 'shared', is: true, then: { visible: true } },
          validate: [
            {
              type: validatorTypes.REQUIRED,
            },
          ],
        },
        {
          component: CustomComponentTypes.ENTITY_NAME,
          name: 'name',
          label: LL.ENTITY['SavedQuery@'].name.label(),
          description: LL.ENTITY['SavedQuery@'].name.description(),
          isRequired: true,
        },
        {
          component: componentTypes.TEXT_FIELD,
          name: 'description',
          label: LL.ENTITY['SavedQuery@'].description.label(),
          description: LL.ENTITY['SavedQuery@'].description.description(),
          validate: [
            {
              type: validatorTypes.MIN_LENGTH,
              threshold: 10,
            },
            {
              type: validatorTypes.MAX_LENGTH,
              threshold: 250,
            },
          ],
        },
        {
          component: CustomComponentTypes.TAG_GROUP,
          name: 'tags',
          label: LL.ENTITY['SavedQuery@'].tags.label(),
          description: LL.ENTITY['SavedQuery@'].tags.description(),
        },
      ],
    };
  }, [domains]);

  const initialValues = useMemo(() => {
    return {
      shared: false,
    };
  }, []);

  const submit = useCallback(
    (formData: FormData) => {
      const { shared, domain, name, description, tags } = formData;
      const namespace = shared !== true ? userId : domain;
      const queryId = nameToIdentifier(name);
      const query = getQuery();

      saveQuery({
        namespace,
        queryId,
        savedQueryInput: {
          description,
          query,
          tags,
        },
      });
    },
    [saveQuery, getQuery],
  );

  const close = useCallback(() => {
    setVisible(false);
    onClose && onClose();
  }, [onClose]);

  return (
    <Modal title={LL.ENTITY.SavedQuery()} visible={visible} onClose={isSubmitting ? undefined : close}>
      <FormRenderer
        schema={schema}
        onSubmit={submit as any}
        onCancel={close}
        isSubmitting={isSubmitting}
        initialValues={initialValues}
      />
    </Modal>
  );
};
