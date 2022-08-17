/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, Button, Modal, Stack, componentTypes, validatorTypes } from 'aws-northstar';
import { CustomComponentTypes, FormRenderer } from '$common/components/form-renderer';
import { Schema } from 'aws-northstar/components/FormRenderer';
import { SummaryRenderer, useNotificationContext } from '$northstar-plus';
import { Token } from '@ada/api';
import { apiHooks } from '$api';
import { nameToIdentifier } from '$common/utils';
import { useI18nContext } from '$strings';
import { useUserId } from '$core/provider/UserProvider';
import React, { useCallback, useMemo, useState } from 'react';
import copyToClipboard from 'clipboard-copy';
import moment from 'moment';

export interface CreateApiKeyDialogProps {
  onClose: () => void;
}

interface FormData {
  name: string;
  enabled: boolean;
  expirationDays: number;
}

function tokenCredentials(token: Required<Token>) {
  const { tokenId, clientId, clientSecret, authToken, authUrl } = token;

  return {
    name: tokenId,
    clientId,
    clientSecret,
    authToken,
    authUrl,
  };
}

export const CreateApiKeyDialog: React.FC<CreateApiKeyDialogProps> = ({ onClose }) => {
  const { LL } = useI18nContext();
  const { addError, addSuccess, addBrief } = useNotificationContext();
  const userId = useUserId();
  const [visible, setVisible] = useState<boolean>(true);

  const [userMachine] = apiHooks.useIdentityMachine({ machineId: userId }, { retry: false });
  const [createMachine, { isLoading: isCreatingMaching }] = apiHooks.usePutIdentityMachineAsync();

  const [token, setToken] = useState<Required<Token>>();
  const [showCredentials, setShowCredentials] = useState(false);
  const copyTokenToClipboard = useCallback(() => {
    const creds = tokenCredentials(token!);

    copyToClipboard(JSON.stringify(creds, null, 2));

    addBrief({
      header: LL.VIEW.notify.brief.clipboard.success(),
      content: LL.ENTITY.Token() + ' ' + creds.name,
      type: 'success',
    });
  }, [token]);

  const [createApiKey, { isLoading: isSubmitting }] = apiHooks.usePutIdentityMachineToken({
    onError: (error) => {
      console.error('Failed to create API Key', error);
      addError({
        header: LL.ENTITY.Token__FAILED_TO_CREATE(),
        content: error.message,
      });
    },
    onSuccess: (result) => {
      console.debug('Created API Key', result);
      setToken(result as Required<Token>);

      addSuccess({
        header: LL.ENTITY.Token__CREATED(result.tokenId),
        content: LL.VIEW.USER.ApiKey.wizard.notify.onetime(),
      });
    },
  });

  const expirationOptions = useMemo(
    () => [
      {
        label: '24 hours',
        value: moment.duration(24, 'hours').asDays(),
      },
      {
        label: '1 week',
        value: moment.duration(1, 'week').asDays(),
      },
      {
        label: '1 month',
        value: moment.duration(1, 'month').asDays(),
      },
      {
        label: '3 months',
        value: moment.duration(3, 'months').asDays(),
      },
      {
        label: '6 months',
        value: moment.duration(6, 'months').asDays(),
      },
      {
        label: '1 year',
        value: moment.duration(365, 'days').asDays(),
      },
    ],
    [],
  );

  const schema = useMemo<Schema>(() => {
    return {
      fields: [
        {
          component: CustomComponentTypes.ENTITY_NAME,
          name: 'name',
          label: LL.ENTITY['Token@'].name.label(),
          description: LL.ENTITY['Token@'].name.description(),
        },
        {
          component: componentTypes.SWITCH,
          name: 'enabled',
          label: LL.ENTITY['Token@'].enabled.label(),
          description: LL.ENTITY['Token@'].enabled.description(),
        },
        {
          component: componentTypes.SELECT,
          name: 'expirationDays',
          label: LL.ENTITY['Token@'].expiration.label(),
          description: LL.ENTITY['Token@'].expiration.description(),
          options: expirationOptions,
          isRequired: true,
          validate: [
            {
              type: validatorTypes.REQUIRED,
            },
          ],
        },
        {
          component: componentTypes.CUSTOM,
          name: '_warning',
          CustomComponent: () => (
            <Alert type="warning">{LL.VIEW.USER.ApiKey.wizard.notify.loginExpirationWarning()}</Alert>
          ),
          condition: { when: 'expirationDays', greaterThan: 91 },
        },
      ],
    };
  }, []);

  const initialValues = useMemo<Partial<FormData>>(() => {
    return {
      enabled: true,
      expirationDays: expirationOptions.find((o) => o.label === '1 month')?.value || 30,
    };
  }, [expirationOptions]);

  const submit = useCallback(
    async (formData: FormData) => {
      const { name, enabled, expirationDays = 30 } = formData;
      try {
        let machineId = userMachine?.machineId;

        if (machineId == null) {
          console.info('CreateApiKeyDialog:: User does not have machine - creating to store first api key');
          const machine = await createMachine({
            machineId: userId,
            machineInput: { description: `User ${userId} machine for API Keys` },
          });
          console.info('CreateApiKeyDialog:: user machine created', machine);
          machineId = machine.machineId;
        }

        createApiKey({
          machineId,
          tokenId: nameToIdentifier(name),
          tokenInput: {
            enabled,
            expiration: moment().add(expirationDays, 'days').toISOString(),
          },
        });
      } catch (error: any) {
        console.warn(error);
      }
    },
    [createApiKey, userMachine, userId, createMachine],
  );

  const close = useCallback(() => {
    setVisible(false);
    onClose && onClose();
  }, [onClose]);

  if (token) {
    return (
      <Modal
        title={LL.VIEW.USER.ApiKey.wizard.title()}
        subtitle={LL.VIEW.USER.ApiKey.wizard.description()}
        visible={visible}
        onClose={close}
      >
        <Stack>
          <Alert type="warning">{LL.VIEW.USER.ApiKey.wizard.notify.onetime()}</Alert>

          <SummaryRenderer
            options={{ autoMask: !showCredentials }}
            sections={[
              {
                title: LL.ENTITY.Token(),
                properties: [
                  [
                    {
                      label: LL.ENTITY['Token@'].name.label(),
                      value: token.tokenId,
                    },
                  ],
                  [
                    {
                      label: LL.ENTITY['Token@'].expiration.label(),
                      value: token.expiration,
                    },
                  ],
                ],
              },
              {
                title: LL.VIEW.USER.ApiKey.SUMMARY.SECTION.clientCredentials.title(),
                properties: [
                  [
                    {
                      label: LL.ENTITY['Token@'].clientId.label(),
                      value: token.clientId,
                    },
                  ],
                  [
                    {
                      label: LL.ENTITY['Token@'].clientSecret.label(),
                      value: token.clientSecret,
                    },
                  ],
                ],
              },
              {
                title: LL.VIEW.USER.ApiKey.SUMMARY.SECTION.authEndpoint.title(),
                properties: [
                  [
                    {
                      label: LL.ENTITY['Token@'].authUrl.label(),
                      value: token.authUrl,
                    },
                  ],
                  [
                    {
                      label: LL.ENTITY['Token@'].authToken.label(),
                      value: token.authToken,
                    },
                  ],
                ],
              },
            ]}
          />

          <Button onClick={() => setShowCredentials((current) => !current)}>{showCredentials
            ? LL.VIEW.USER.ApiKey.SUMMARY.ACTIONS.hide.text()
            : LL.VIEW.USER.ApiKey.SUMMARY.ACTIONS.show.text()
          }</Button>
          <Button variant="primary" onClick={copyTokenToClipboard}>
            {LL.VIEW.action.copyToClipboard.text()}
          </Button>
        </Stack>
      </Modal>
    );
  }

  return (
    <Modal
      title={LL.VIEW.USER.ApiKey.wizard.title()}
      subtitle={LL.VIEW.USER.ApiKey.wizard.description()}
      visible={visible}
      onClose={isSubmitting ? undefined : close}
    >
      <FormRenderer
        schema={schema}
        onSubmit={submit as any}
        onCancel={close}
        isSubmitting={isSubmitting || isCreatingMaching}
        initialValues={initialValues}
      />
    </Modal>
  );
};
