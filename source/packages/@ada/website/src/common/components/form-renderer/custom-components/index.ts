/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessPolicySelectField } from './AccessPolicySelectField';
import { CardSelect } from './CardSelect';
import { CodeEditorField } from './CodeEditorField';
import { CustomWrapper } from './CustomWrapper';
import { DynamoDBTableField } from './DynamoDBTableField';
import { FieldListener } from './FieldListener';
import { FileUploadField } from './FileUploadField';
import { GovernanceEdit } from './GovernanceEdit';
import { StringGroupField, TokenGroupField } from './TokenGroupField';
import { TagGroup } from './TagGroup';
import { TwoColumns } from './TwoColumns';
import { UserSelectField } from './UserSelectField';
import EntityIdentifierField from './EntityIdentifierField';
import EntityNameField from './EntityNameField';
import FieldArray from '$northstar-plus/components/FormRenderer/components/FieldArray';

export * from './CardSelect';

export * from './CustomWrapper';

export * from './TagGroup';

export * from './TokenGroupField';

export * from './TwoColumns';

export * from './EntityIdentifierField';

export * from './EntityNameField';

export * from './CodeEditorField';

export * from './FileUploadField';

export * from './FieldListener';

export * from './UserSelectField';

export * from './GovernanceEdit';

export enum CustomComponentTypes {
  ACCESSPOLICY_SELECT = 'access-policy-select',
  CARD_SELECT = 'card-select',
  CODE_EDITOR = 'code-editor',
  CUSTOM_WRAPPER = 'custom-wrapper',
  DYNAMO_DB_TABLE = 'dynamo-db-table',
  ENTITY_IDENTIFIER = 'entity-identifier',
  ENTITY_NAME = 'entity-name',
  FIELD_ARRAY = 'field-array',
  FIELD_LISTENER = 'field-listener',
  FILE_UPLOAD = 'file-upload',
  STRING_GROUP = 'string-group',
  TAG_GROUP = 'tag-group',
  TOKEN_GROUP = 'token-group',
  TWO_COLUMNS = 'two-columns',
  USER_SELECT = 'user-select',
  GOVERNANCE_EDIT = 'governance-edit',
}

export const DEFAULT_CUSTOM_COMPONENT_WRAPPER = {
  [CustomComponentTypes.CARD_SELECT]: CardSelect as any,
  [CustomComponentTypes.CUSTOM_WRAPPER]: CustomWrapper as any,
  [CustomComponentTypes.TWO_COLUMNS]: TwoColumns as any,
  [CustomComponentTypes.ENTITY_NAME]: EntityNameField as any,
  [CustomComponentTypes.DYNAMO_DB_TABLE]: DynamoDBTableField as any,
  [CustomComponentTypes.ENTITY_IDENTIFIER]: EntityIdentifierField as any,
  [CustomComponentTypes.TAG_GROUP]: TagGroup as any,
  [CustomComponentTypes.TOKEN_GROUP]: TokenGroupField as any,
  [CustomComponentTypes.STRING_GROUP]: StringGroupField as any,
  [CustomComponentTypes.CODE_EDITOR]: CodeEditorField as any,
  [CustomComponentTypes.FILE_UPLOAD]: FileUploadField as any,
  [CustomComponentTypes.FIELD_LISTENER]: FieldListener as any,
  [CustomComponentTypes.USER_SELECT]: UserSelectField as any,
  [CustomComponentTypes.FIELD_ARRAY]: FieldArray as any,
  [CustomComponentTypes.ACCESSPOLICY_SELECT]: AccessPolicySelectField as any,
  [CustomComponentTypes.GOVERNANCE_EDIT]: GovernanceEdit as any,
};
