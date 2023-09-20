/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FC, useMemo } from 'react';
import { apiHooks } from '$api';
import { groupDisplayName } from '$common/entity/group/utils';
import { useI18nContext } from '$strings';
import Autosuggest, { SelectOption } from 'aws-northstar/components/Autosuggest';
import FormField from 'aws-northstar/components/FormField';

export interface SearchCustomGroupsProps {
  selected?: string;
  onSelect: (id: string) => void;
  filteredIds?: string[]
}

export const SearchCustomGroups: FC<SearchCustomGroupsProps> = ({
  selected,
  onSelect,
  filteredIds,
}) => {
  const { LL } = useI18nContext();
  const [groups, { isLoading, error }] = apiHooks.useAllIdentityGroups();

  const options: SelectOption[] = useMemo(() => {
    return groups?.filter(g => !filteredIds || !(filteredIds.includes(g.groupId)))
      .map(g => ({
        value: g.groupId,
        label: groupDisplayName(g.groupId),
      })) || []
  }, [groups]);

  const getStatusType = () => {
    if(isLoading) {
      return 'loading'
    }
    
    if(error) { 
      return 'error' 
    } 
    
    return 'finished'
  }

  return (<div data-testid='search-custom-group'>
    <FormField
      stretch
      label={LL.VIEW.GOVERNANCE.actions.searchGroups()}
      controlId="search-custom-group">
      <Autosuggest
        value={selected ? options.find(o => o.value === selected) : undefined}
        onChange={(option) => option?.value && onSelect(option.value)}
        statusType={getStatusType()}
        loadingText={LL.VIEW.loading.Loading()}
        errorText={error?.message}
        options={options}
        controlId="search-custom-group"
        ariaDescribedby={LL.VIEW.GOVERNANCE.actions.searchGroups()} />
    </FormField>
  </div>)
}