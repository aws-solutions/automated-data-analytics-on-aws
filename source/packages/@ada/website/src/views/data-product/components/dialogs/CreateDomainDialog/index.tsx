/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CustomComponentTypes, FormRenderer } from '$common/components/form-renderer';
import { CustomValidatorTypes } from '$common/components/form-renderer/validators';
import { Modal, componentTypes } from 'aws-northstar';
import { Schema } from 'aws-northstar/components/FormRenderer';
import { apiHooks } from '$api';
import { nameToIdentifier } from '$common/utils';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useNotificationContext } from '$northstar-plus';
import React, { useCallback, useMemo, useState } from 'react';

export interface CreateDomainDialogProps {
  onClose: () => void;
}

export const CreateDomainDialog: React.FC<CreateDomainDialogProps> = ({ onClose }) => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const { addError, addSuccess } = useNotificationContext();
  const [domains] = apiHooks.useAllDataProductDomains();
  const [visible, setVisible] = useState<boolean>(true);

  const [createDomain, { isLoading: isSubmitting }] = apiHooks.usePutDataProductDomain({
    onError: (error, variables) => {
      addError({
        header: LL.ENTITY.Domain__FAILED_TO_CREATE(variables.domainId),
        content: error.message,
      });
    },
    onSuccess: (result) => {
      addSuccess({
        header: LL.ENTITY.Domain__CREATED(result.domainId),
      });
      history.push(`/data-product/${result.domainId}`);
      close();
    },
  });

  const schema = useMemo<Schema>(() => {
    return {
      fields: [
        {
          component: CustomComponentTypes.ENTITY_NAME,
          name: 'name',
          label: LL.ENTITY['Domain@'].name.label(),
          description: LL.ENTITY['Domain@'].name.description(),
          validate: [
            {
              type: CustomValidatorTypes.NOT_EXISTING,
              existing: (domains || []).map((domain) => domain.domainId),
            },
          ],
        },
        {
          component: componentTypes.TEXT_FIELD,
          name: 'description',
          label: LL.ENTITY['Domain@'].description.label(),
          description: LL.ENTITY['Domain@'].description.description(),
          validate: [],
        },
      ],
    };
  }, [domains]);

  const initialValues = useMemo(() => {
    return {};
  }, []);

  const submit = useCallback(
    (formData: any) => {
      const { name, description } = formData;
      const domainId = nameToIdentifier(name);
      createDomain({
        domainId,
        domainInput: {
          domainId,
          name,
          description,
        },
      });
    },
    [createDomain],
  );

  const close = useCallback(() => {
    setVisible(false);
    onClose && onClose();
  }, [onClose]);

  return (
    <Modal
      title={LL.VIEW.DATA_PRODUCT.Domain.CREATE.title()}
      visible={visible}
      onClose={isSubmitting ? undefined : close}
    >
      <FormRenderer
        schema={schema}
        onSubmit={submit}
        onCancel={close}
        isSubmitting={isSubmitting}
        initialValues={initialValues}
      />
    </Modal>
  );
};
