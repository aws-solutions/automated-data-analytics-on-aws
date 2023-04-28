/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Field } from 'aws-northstar/components/FormRenderer';
import { api } from '$api/client';
import React, { FunctionComponent, memo, useEffect, useState } from 'react';
import TextField from 'aws-northstar/components/FormRenderer/components/TextField';
import useFieldApi, { UseFieldApiConfig } from '@data-driven-forms/react-form-renderer/use-field-api';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

export const DynamoDBTableFieldResolveProps: Field['resolveProps'] = (_props, { input }) => {
  return {
    helperText: renderHelperText(input.value),
  };
};

const TABLE_ARN_PATTERN = /^arn:aws:dynamodb:([a-z])+-([a-z])+-\d:\d+:table\/([A-Za-z0-9-]+)$/;
const PATTERN_ROLE_ARN = /^arn:aws:iam::\d{12}:role\/([A-Za-z0-9-]+)$/;

function renderHelperText(tableStreamDetails?: TableStreamDetails, tableArn?: string): React.ReactNode {
  let returnLine = <b>-</b>;

  if (tableStreamDetails?.tableStreamArn)
    returnLine = (
      <>
        <b>Table stream ARN:</b> <i>{tableStreamDetails.tableStreamArn}</i> : <b>{tableStreamDetails.streamViewType}</b>
      </>
    );

  if (tableStreamDetails && tableStreamDetails.crossAccount) {
    returnLine = (
      <b>This table exists in another account, please supply an IAM role that can be used to access the table</b>
    );
  }

  if (tableStreamDetails && !tableStreamDetails.streamEnabled) {
    returnLine = <b>No table stream configured, one may be created if'Automatic updates' are selected</b>;
  }

  if (tableArn?.match(TABLE_ARN_PATTERN) && !tableStreamDetails) {
    returnLine = <b>Retrieving table details...</b>;
  }

  if (tableStreamDetails?.badRequest) {
    returnLine = (
      <>
        <b>Unable to inspect table ARN. Please check the ARN and try again.</b>
      </>
    );
  }

  return <span>{returnLine}</span>;
}

interface TableStreamDetails {
  crossAccount?: boolean;
  tableStreamArn?: string;
  streamViewType?: string;
  streamEnabled?: boolean;
  badRequest?: boolean;
}

export const DynamoDBTableField: FunctionComponent<UseFieldApiConfig> = (props) => {
  const form = useFormApi();
  const { input } = useFieldApi(props);
  const [tableStreamDetails, setTableStreamDetails] = useState<TableStreamDetails | undefined>();
  const [tableArn, setTableArn] = useState<string | undefined>(undefined);
  const [roleArn, setRoleArn] = useState<string | undefined>(undefined);

  const [helperText, setHelperText] = useState<React.ReactNode>(renderHelperText(props.value));

  useEffect(() => {
    setHelperText(renderHelperText(tableStreamDetails, tableArn));
  }, [tableArn, tableStreamDetails]);

  useEffect(() => {
    if (tableArn?.match(TABLE_ARN_PATTERN) && !tableStreamDetails) {
      // get stream from arn
      api
        .getDataProductDynamoDBTableStream({ tableArn: encodeURIComponent(tableArn) })
        .then((data) => {
          setTableStreamDetails({ ...data });
        })
        .catch((response) => {
          if (response.status === 400) {
            setTableStreamDetails({ badRequest: true });
          } else {
            throw new Error(`Error response from get-data-stream api: ${response}`);
          }
        });
    } else if (!tableArn || (!tableArn.match(TABLE_ARN_PATTERN) && tableStreamDetails)) {
      setTableStreamDetails(undefined);
      setRoleArn(undefined);
    }
  }, [form, tableArn, setTableStreamDetails, tableStreamDetails]);

  useEffect(() => {
    form.change(input.name, {
      tableArn,
      roleArn,
    });
  }, [roleArn, tableArn]);

  const tableArnChangeHandler = (value: string) => {
    setTableArn(value);
    setTableStreamDetails(undefined);
  };

  const roleArnChangeHandler = (value: string) => {
    setRoleArn(value);
  };

  // A complex wizard field that requires its own validation instead of the one provided by the index manifest file
  return (
    <>
      <TextField
        validate={[
          { type: 'required' },
          {
            type: 'pattern',
            pattern: TABLE_ARN_PATTERN,
            message: 'Must be a valid arn for Amazon DynamoDB Table',
          } as any,
        ]}
        label={props.label}
        showError
        name={`${input.name}.tableArn`}
        value={tableArn}
        onChange={tableArnChangeHandler}
        helperText={helperText}
        description={props.description}
      />
      {tableStreamDetails?.crossAccount && (
        <TextField
          value={roleArn}
          validate={[
            { type: 'required' },
            {
              type: 'pattern',
              pattern: PATTERN_ROLE_ARN,
              message: 'Must be a valid arn for an IAM Role',
            } as any,
          ]}
          showError
          name={`${input.name}.roleArn`}
          label={'Cross Account Role Arn'}
          onChange={roleArnChangeHandler}
          description={'Enter the IAM Role ARN in the target account that provides access.'}
        />
      )}
    </>
  );
};

export default memo(DynamoDBTableField);
