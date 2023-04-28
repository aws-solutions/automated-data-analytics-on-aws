/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Chip, ChipProps } from '@material-ui/core';
import { Connectors } from '@ada/connectors';
import { Inline } from 'aws-northstar';
import React from 'react';

const ConnectorBadge: React.FC<ChipProps> = (props) => {
  return <Chip {...props} />;
};

export const Experimental: React.FC = () => {
  return <ConnectorBadge label="Experimental" variant="outlined" size="small" color="primary" />;
};

export const Deprecated: React.FC = () => {
  return <ConnectorBadge label="Deprecated" variant="outlined" size="small" color="secondary" />;
};

export const PIIDisabled: React.FC = () => {
  return <ConnectorBadge label="Automatic PII Not Available" variant="outlined" size="small" color="secondary" />;
};

export const ConnectorBadgeList: React.FC<{ connector: Connectors.IConnector }> = ({ connector }) => {
  const badges: React.ReactNode[] = [];

  if (connector.CONFIG.deprecated === true) {
    badges.push(<Deprecated key="deprecated" />);
  }

  if (connector.CONFIG.stability === Connectors.Stability.EXPERIMENTAL) {
    badges.push(<Experimental key="experimental" />);
  }

  if (connector.CONFIG.supports.disableAutomaticPii) {
    badges.push(<PIIDisabled key="pii-not-supported" />);
  }

  if (badges.length > 0) {
    return <Inline spacing="xs">{badges}</Inline>;
  }

  return null;
};
