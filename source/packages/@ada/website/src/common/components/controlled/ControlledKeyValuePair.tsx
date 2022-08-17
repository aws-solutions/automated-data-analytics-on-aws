/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Badge, Box, KeyValuePair, Toggle } from 'aws-northstar';
import React from 'react';
import startCase from 'lodash/startCase';

export interface ControlledKeyValuePairProps {
  label: string;
  value: any;
}

const getValueTemplate = (value: any) => {
  if (Array.isArray(value)) {
    return value.map((q, idx) => (
      <Box key={`container-${idx}`} marginRight="5px" display="inline">
        <Badge key={`badge-${idx}`} content={q} />
      </Box>
    ));
  }

  if (value === true || value === false) {
    return <Toggle disabled label={startCase(value.toString())} checked={value} />;
  }

  return value;
};

export const ControlledKeyValuePair: React.FC<ControlledKeyValuePairProps> = ({ label, value }) => {
  return <KeyValuePair label={label} value={getValueTemplate(value)} />;
};
