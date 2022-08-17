/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  Alert,
  Button,
  DeleteConfirmationDialog,
  Heading,
  KeyValuePair,
  Link,
  LoadingIndicator,
  Stack,
  StatusIndicator,
  Text,
} from 'aws-northstar';
import { LLSafeHtmlString, useI18nContext } from '$strings';
import { PageLayout, useNotificationContext } from '$northstar-plus';
import { TearDownDetails } from '@ada/api';
import { apiHooks } from '$api';
import { awsConsoleCloudFormationUrl } from '$common/utils';
import { parse as parseArn } from '@aws-sdk/util-arn-parser';
import React, { Fragment, useCallback, useState } from 'react';
import copyToClipboard from 'clipboard-copy';

export const TeardownPage: React.FC = () => {
  const { LL } = useI18nContext();
  const { addSuccess, addError, addBrief } = useNotificationContext();
  const [strategy, setStrategy] = useState<'destroyData' | 'retainData'>();
  const isDestroyData = strategy === 'destroyData';
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [details, setDetails] = useState<TearDownDetails>();

  const onError = useCallback(
    (error) => {
      setIsProcessing(false);
      addError({
        header: LL.VIEW.ADMIN.Teardown.notify.error.header(),
        content: error.message,
      });
    },
    [strategy],
  );
  const onSuccess = useCallback(
    (result: TearDownDetails) => {
      setDetails(result);
      setIsProcessing(false);

      addSuccess({
        header: LL.VIEW.ADMIN.Teardown.notify.success.header(),
        content: LL.VIEW.ADMIN.Teardown.notify.success.content(),
        dismissible: false,
      });
    },
    [strategy],
  );

  const [startTeardownWithRetainData] = apiHooks.useDeleteAdministrationStartTearDownRetainData({
    onError,
    onSuccess,
  });
  const [startTeardownWithDestroyData] = apiHooks.useDeleteAdministrationStartTearDownDestroyData({
    onError,
    onSuccess,
  });

  const retainData = useCallback(() => {
    setStrategy('retainData');
    setShowConfirm(true);
  }, []);

  const destroyData = useCallback(() => {
    setStrategy('destroyData');
    setShowConfirm(true);
  }, []);

  const cancelHandler = useCallback(() => {
    setStrategy(undefined);
    setShowConfirm(false);
  }, []);

  const deleteHandler = useCallback(() => {
    setIsProcessing(true);
    setShowConfirm(false);
    switch (strategy) {
      case 'retainData':
        startTeardownWithRetainData({});
        break;
      case 'destroyData':
        startTeardownWithDestroyData({});
        break;
    }
  }, [strategy]);

  const copyDetails = useCallback(() => {
    if (details == null) {
      return;
    }
    copyToClipboard(
      JSON.stringify(
        {
          ...details,
          stackLink: awsConsoleCloudFormationUrl(details.coreStackId),
        },
        null,
        2,
      ),
    );
    addBrief({
      type: 'success',
      header: LL.VIEW.notify.brief.clipboard.success(),
    });
  }, [details]);

  return (
    <PageLayout title={LL.VIEW.ADMIN.Teardown.title()} subtitle={LL.VIEW.ADMIN.Teardown.subtitle()}>
      <Stack spacing="l">
        <Text variant="p">
          <LLSafeHtmlString string="VIEW.ADMIN.Teardown.htmlBody" />
        </Text>

        {isProcessing && <LoadingIndicator label={LL.VIEW.loading.Processing()} />}

        {!details && !isProcessing && (
          <Stack spacing="l">
            <Alert type="warning">
              <LLSafeHtmlString string="VIEW.ADMIN.Teardown.htmlWarning" />
            </Alert>

            <Stack spacing="s">
              <Heading variant="h4">{LL.VIEW.ADMIN.Teardown.strategy.retainData.heading()}</Heading>
              <Text variant="p">
                <LLSafeHtmlString string="VIEW.ADMIN.Teardown.strategy.retainData.htmlDetails" />
              </Text>
              <Button variant="primary" onClick={retainData} disabled={isProcessing}>
                {LL.VIEW.ADMIN.Teardown.strategy.retainData.buttonText()}
              </Button>
            </Stack>

            <Stack spacing="s">
              <Heading variant="h4">{LL.VIEW.ADMIN.Teardown.strategy.destroyData.heading()}</Heading>
              <Text variant="p">
                <LLSafeHtmlString string="VIEW.ADMIN.Teardown.strategy.destroyData.htmlDetails" />
              </Text>
              <Button variant="primary" onClick={destroyData} disabled={isProcessing}>
                {LL.VIEW.ADMIN.Teardown.strategy.destroyData.buttonText()}
              </Button>
            </Stack>
          </Stack>
        )}

        {details && (
          <Stack>
            <Heading variant="h3">
              {LL.VIEW.ADMIN.Teardown.success.heading()}
            </Heading>
            <Alert type="warning">
              <LLSafeHtmlString string="VIEW.ADMIN.Teardown.success.htmlWarning" />
            </Alert>
            <KeyValuePair label={LL.VIEW.ADMIN.Teardown.success.details.message.label()} value={details.message} />
            <KeyValuePair
              label={LL.VIEW.ADMIN.Teardown.success.details.coreStack.label()}
              value={
                <Link forceExternal target="_blank" href={awsConsoleCloudFormationUrl(details.coreStackId)}>
                  {details.coreStackId}
                </Link>
              }
            />
            {details.retainedResources && (
              <KeyValuePair
                label={LL.VIEW.ADMIN.Teardown.success.details.retained.label()}
                value={
                  <ol>
                    {details.retainedResources.map((arn) => (
                      <Fragment key={arn}>
                        <ArnResourceLink arn={arn} />
                      </Fragment>
                    ))}
                  </ol>
                }
              />
            )}
            <StatusIndicator statusType={isDestroyData ? 'negative' : 'positive'}>
              {strategy && LL.VIEW.ADMIN.Teardown.success.details.dataIndicator[strategy]()}
            </StatusIndicator>
            <Button onClick={copyDetails}>Copy details</Button>
          </Stack>
        )}
      </Stack>

      {strategy && showConfirm && (
        <DeleteConfirmationDialog
          visible
          title={LL.VIEW.ADMIN.Teardown.strategy[strategy].confirm.title()}
          confirmationText={LL.VIEW.ADMIN.Teardown.strategy[strategy].confirm.confirmationText()}
          deleteButtonText={LL.VIEW.ADMIN.Teardown.strategy[strategy].confirm.deleteButtonText()}
          label={
            <LLSafeHtmlString string={`VIEW.ADMIN.Teardown.strategy.${strategy}.confirm.htmlLabel`} />
          }
          onCancelClicked={cancelHandler}
          onDeleteClicked={deleteHandler}
        >
          <LLSafeHtmlString string={`VIEW.ADMIN.Teardown.strategy.${strategy}.confirm.htmlBody`} />
        </DeleteConfirmationDialog>
      )}
    </PageLayout>
  );
};

const ArnResourceLink: React.FC<{ arn: string }> = ({ arn }) => {
  const { region, resource, service } = parseArn(arn);

  switch (service) {
    case 's3': {
      return (
        <li>
          <Link href={`https://s3.console.aws.amazon.com/s3/buckets/${resource}`} target="_blank" forceExternal>
            <b>S3 Bucket:</b> <pre> {resource}</pre>
          </Link>
        </li>
      );
    }
    case 'kms': {
      const [type, id] = resource.split('/');
      if (type === 'key') {
        return (
          <li>
            <Link
              href={`https://${region}.console.aws.amazon.com/kms/home?#/kms/keys/${id}`}
              target="_blank"
              forceExternal
            >
              <b>KMS Key:</b> <pre> {id}</pre>
            </Link>
          </li>
        );
      }
      return null;
    }
    case 'logs': {
      // https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazoncloudwatchlogs.html#amazoncloudwatchlogs-resources-for-iam-policies
      // arn:${Partition}:logs:${Region}:${Account}:log-group:${LogGroupName}:log-stream:${LogStreamName}
      // arn:${Partition}:logs:${Region}:${Account}:log-group:${LogGroupName}
      // arn:${Partition}:logs:${Region}:${Account}:destination:${DestinationName}
      const [type, logGroupName, logStreamType, logStreamName] = resource.split(':');
      if (type === 'log-group') {
        if (logStreamType == null) {
          return (
            <li>
              <Link
                href={`https://${region}.console.aws.amazon.com/cloudwatch/home?#logsV2:log-groups/log-group/${logGroupName.replace(
                  /\//g,
                  '$252F',
                )}`}
                target="_blank"
                forceExternal
              >
                <b>Log Group:</b> <pre> {logGroupName}</pre>
              </Link>
            </li>
          );
        } else {
          return (
            <li>
              <Link
                href={`https://${region}.console.aws.amazon.com/cloudwatch/home?#logsV2:log-groups/log-group/${logGroupName.replace(
                  /\//g,
                  '$252F',
                )}`}
                target="_blank"
                forceExternal
              >
                <b>Log Stream:</b> <pre> {logStreamName}</pre>
              </Link>
            </li>
          );
        }
      }
      return null;
    }
    default: {
      return (
        <li>
          <pre>{arn}</pre>
        </li>
      );
    }
  }
};
