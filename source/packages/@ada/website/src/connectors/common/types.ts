/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors';


export type SourceTypeSummaryProps<T extends any> = {
  sourceType: Connectors.ID;
  sourceDetails: T;
  /**
   * List of property names to hide.
   */
  propertiesToHide?: string[];
  /**
   * Indicates is source details is collapsible, used for creation wizard.
   */
  collapsible?: boolean;
};

export type SourceTypeSummaryComponent<T extends any> = React.FC<SourceTypeSummaryProps<T>>;
