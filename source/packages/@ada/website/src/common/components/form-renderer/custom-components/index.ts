/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessPolicySelectField } from './AccessPolicySelectField';
import { CardSelect } from './CardSelect';
import { CodeEditorField } from './CodeEditorField';
import { CustomWrapper } from './CustomWrapper';
import { FieldListener } from './FieldListener';
import { FileUploadField } from './FileUploadField';
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

export enum CustomComponentTypes {
  CARD_SELECT = 'card-select',
  CUSTOM_WRAPPER = 'custom-wrapper',
  TWO_COLUMNS = 'two-columns',
  ENTITY_NAME = 'entity-name',
  ENTITY_IDENTIFIER = 'entity-identifier',
  TOKEN_GROUP = 'token-group',
  TAG_GROUP = 'tag-group',
  STRING_GROUP = 'string-group',
  CODE_EDITOR = 'code-editor',
  FILE_UPLOAD = 'file-upload',
  FIELD_LISTENER = 'field-listener',
  USER_SELECT = 'user-select',
  FIELD_ARRAY = 'field-array',
  ACCESSPOLICY_SELECT = 'access-policy-select',
}

export const DEFAULT_CUSTOM_COMPONENT_WRAPPER = {
  [CustomComponentTypes.CARD_SELECT]: CardSelect as any,
  [CustomComponentTypes.CUSTOM_WRAPPER]: CustomWrapper as any,
  [CustomComponentTypes.TWO_COLUMNS]: TwoColumns as any,
  [CustomComponentTypes.ENTITY_NAME]: EntityNameField as any,
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
};
