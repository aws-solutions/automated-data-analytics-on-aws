/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, Paper, Stack } from 'aws-northstar';
import { Column, Modal } from '$northstar-plus';
import { DataSetIds } from '@ada/common';
import { FlexTable } from '$common/components';
import { LL, LLSafeHtmlBlock } from '$strings';
import { NormalizedDatasetSchema } from '../../context';
import { generateDataColumnDefinitions, sanitiseAccessorForTable } from '$common/utils';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import React, { useState } from 'react';
import orderBy from 'lodash/orderBy';

export interface SampleDataDialogProps {
  title?: string;
  subtitle?: string;
  table: NormalizedDatasetSchema;
  agreed?: boolean;
  onClose: (agreed?: boolean) => void;
}

const generateSampleDataColumnDefinitions = (table: NormalizedDatasetSchema): Column<object>[] => {
  if (table.columns) {
    return orderBy(Object.entries(table.columns), ([, { sortOrder }]) => sortOrder).map(([name]) => ({
      accessor: sanitiseAccessorForTable(name),
      id: sanitiseAccessorForTable(name),
      Header: name,
    }));
  } else {
    // fallback to inferring columns from data
    return generateDataColumnDefinitions(table.sample || []) as any;
  }
};

export const SampleDataDialog: React.FC<SampleDataDialogProps> = ({
  title,
  subtitle,
  table,
  agreed,
  onClose,
}) => {
  const { LL:_LL } = useI18nContext()
  const [agree, setAgree] = useState(agreed);
  return (
    <Modal visible title={title || _LL.VIEW.DATA_PRODUCT.SAMPLE.title()} subtitle={subtitle} onClose={() => onClose(agree)} width="75%">
      <PotentialPiiGate onDisagree={() => onClose(false)} onAgree={() => setAgree(true)} agreed={agree}>
        <FlexTable
          tableTitle={table.name === DataSetIds.DEFAULT ? _LL.ENTITY.DataSet_.default() : _LL.ENTITY['DataSet^'](table.name)}
          tableDescription={table.description}
          columnDefinitions={generateSampleDataColumnDefinitions(table) as any}
          items={table.sample || []}
          disableRowSelect
          disableExpand
          disableSettings
        />
      </PotentialPiiGate>
    </Modal>
  );
};

const PotentialPiiGate: React.FC<{ onDisagree: () => void; onAgree?: () => void; agreed?: boolean }> = ({
  children,
  onAgree,
  onDisagree,
  agreed = false,
}) => {
  const [agree, setAgree] = useState<boolean>(agreed);

  if (agree) {
    return <>{children}</>;
  }

  return (
    <Stack>
      <Alert
        type="warning"
        buttonText={LL.VIEW.DATA_PRODUCT.SAMPLE.WARNING.agreeText()}
        onButtonClick={() => {
          setAgree(true);
          onAgree && onAgree!();
        }}
        dismissible
        dismissAriaLabel={LL.VIEW.DATA_PRODUCT.SAMPLE.WARNING.agreeText()}
        onDismiss={onDisagree}
      >
        <LLSafeHtmlBlock string="VIEW.DATA_PRODUCT.SAMPLE.WARNING.messageHtml" />
      </Alert>

      <Paper elevation={1} style={{ padding: 20 }}>
        {LL.VIEW.DATA_PRODUCT.SAMPLE.WARNING.gateText()}
      </Paper>
    </Stack>
  );
};
