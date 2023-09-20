/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FC, useCallback, useMemo } from 'react';
import { Field } from '@data-driven-forms/react-form-renderer';
import { groupDisplayName } from '../../../../../entity/group/utils';
import { useI18nContext } from '$strings';
import Button from 'aws-northstar/components/Button';
import Container from 'aws-northstar/layouts/Container';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

export interface GovernanceEditCardProps {
  onRemove: (index: number) => void;
  canRemove: boolean;
  groupId: string;
  fields: Field[];
  fieldIndex: number;
  name: string;
  showError?: boolean;
}

/**
 * Custom FormRenderer component for creating/updating governance settings for user groups. 
 */
export const GovernanceEditCard: FC<GovernanceEditCardProps> = ({
  onRemove,
  groupId,
  fieldIndex,
  canRemove,
  name,
  ...props
}) => {
  const { LL } = useI18nContext();
  const { renderForm } = useFormApi();
  const actions = useMemo(() => {
    return <Button onClick={() => onRemove(fieldIndex)}>{LL.VIEW.action.delete.label()}</Button>
  }, [onRemove, groupId]);

  const getFieldKey = useCallback((fieldName: string) => `${name}.${fieldName}`, [name]);

  const fields = useMemo(() => {
    return props.fields.map((field) => ({
      ...field,
      name: getFieldKey(field.name),
      key: getFieldKey(field.name),
      showError: props.showError,
    }));
  }, [props.fields, props.showError]);

  return (<Container
    title={groupDisplayName(groupId)}
    headerContent={LL.VIEW.GOVERNANCE.wizard.groupGovernance.description()}
    actionGroup={canRemove ? actions : undefined}
  >
    {renderForm(fields)}
  </Container>)
}