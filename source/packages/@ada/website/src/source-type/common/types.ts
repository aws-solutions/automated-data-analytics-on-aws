/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductSourceDefinition, SourceDetails, SourceType } from '@ada/common';
import { Field } from '@data-driven-forms/react-form-renderer/common-types';
import { SvgIcon } from '@material-ui/core';

// react-scripts/lib/react-app.d.ts
type IconComponent = React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;
export interface UXDataProductSourceDefinition<T extends SourceDetails, TSummary extends SourceDetails = T>
  extends DataProductSourceDefinition {
  CONTENT: {
    Icon: typeof SvgIcon | IconComponent;
    label: string;
    description: string;
  };
  WIZARD: {
    CREATE_FIELDS: Field[];
  };
  SUMMARY: {
    SourceSummary: SourceTypeSummaryComponent<TSummary>;
  };
}

export type SourceTypeSummaryProps<T extends SourceDetails> = {
  sourceType: SourceType;
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

export type SourceTypeSummaryComponent<T extends SourceDetails> = React.FC<SourceTypeSummaryProps<T>>;
