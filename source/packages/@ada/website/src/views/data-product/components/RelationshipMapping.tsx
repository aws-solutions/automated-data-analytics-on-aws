/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { KeyValuePair } from 'aws-northstar';
import React from 'react';
import type { DataProductIdentifier } from '@ada/api';

export interface RelationshipMappingProps {
  readonly label: string;
  readonly relationships?: DataProductIdentifier[];
}

export const RelationshipMapping: React.FC<RelationshipMappingProps> = ({ label, relationships }) => {
  return relationships && relationships.length > 0 ? (
    <KeyValuePair
      label={label}
      value={
        <ul>
          {relationships.map(({ domainId, dataProductId }) => (
            <li key={`${domainId}.${dataProductId}`}>
              <a href={`/data-product/${domainId}/${dataProductId}`}>{`${domainId}.${dataProductId}`}</a>
            </li>
          ))}
        </ul>
      }
    />
  ) : null;
};
