/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FC, useState } from 'react';
import { FieldArray as FieldArrayBase } from '@data-driven-forms/react-form-renderer';
import { GovernanceEditCard } from './components/GovernanceEditCard';
import { SearchCustomGroups } from './components/SearchCustomGroups';
import { useI18nContext } from '$strings';
import Box from 'aws-northstar/layouts/Box';
import Button from 'aws-northstar/components/Button';
import Stack from 'aws-northstar/layouts/Stack';
import useFieldApi, { UseFieldApiConfig } from '@data-driven-forms/react-form-renderer/use-field-api';

/**
 * Custom FormRenderer component for creating/updating governance settings for user groups. 
 */
export const GovernanceEdit: FC<UseFieldApiConfig> = (props) => {
  const {
    arrayValidator,
    fields: formFields,
    showError,
    input,
    ...rest
  } = useFieldApi(props);
  const { LL } = useI18nContext();
  const [selectedCustomGroup, setSelectedCustomGroup] = useState<string>();

  const testId = rest['data-testid'] || 'governance-edit';

  return (
    <FieldArrayBase key={input.name} name={input.name} validate={arrayValidator}>
      {({ fields }) => {
        const { map, push, remove, value } = fields;
        return (
          <Stack spacing="s">
            {map((_name: string, index: number) => {
              const groupId = value[index].groupId;
              return (
                <GovernanceEditCard
                  key={groupId}
                  fields={formFields}
                  name={`groups.${index}`}
                  groupId={value[index].groupId}
                  fieldIndex={index}
                  showError={showError}
                  onRemove={remove}
                  canRemove={true}
                />
              );
            })}
            <Box display='flex'
              justifyContent='left'
              alignItems='flex-end'
            >
              <Box flexGrow={2}>
                <SearchCustomGroups
                  filteredIds={value?.map((x: any) => x.groupId) || []}
                  selected={selectedCustomGroup}
                  onSelect={setSelectedCustomGroup} />
              </Box>
              <Box 
                marginLeft={1}
                flexGrow={1} 
              >
                <Button
                  onClick={() => {
                    push({
                      groupId: selectedCustomGroup,
                    });
                    setSelectedCustomGroup(undefined);
                  }}
                  disabled={!selectedCustomGroup}
                  data-testid={`${testId}-add-button`}
                >
                  {LL.VIEW.GOVERNANCE.actions.addGovernanceForGroup()}
                </Button>
              </Box>
            </Box>
          </Stack>
        );
      }}
    </FieldArrayBase>)
}