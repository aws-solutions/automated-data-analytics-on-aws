/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ButtonDropdown, ButtonDropdownItem } from '$northstar-plus';
import { CreateDomainDialog } from '../dialogs/CreateDomainDialog';
import { DomainEntity } from '@ada/api';
import { apiHooks } from '$api';
import { isEmpty, sortBy } from 'lodash';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '$strings';
import { useOperationAllowed } from '$api/hooks/permissions';
import React, { useCallback, useMemo, useState } from 'react';
import useFieldApi, { UseFieldApiConfig } from '@data-driven-forms/react-form-renderer/use-field-api';

export interface DomainSelectorProps {
  currentDomainId?: string;
  onSelect: (domain: DomainEntity) => void;
  /**
   * Enables creating a domain with CTA button at end of list.
   * @default false
   */
  enableCreate?: boolean;
  /**
   * Prepends "All domains" option to top of list
   * @default false
   */
  includeAll?: boolean;
}

export const DomainSelector: React.FC<DomainSelectorProps> = ({
  currentDomainId,
  onSelect,
  enableCreate,
  includeAll,
}) => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const [domains, queryInfo] = apiHooks.useAllDataProductDomains(undefined, {
    select: (_domains) => {
      return _domains && sortBy(_domains, ['name', 'id']);
    },
  });
  const isCreateDomainAllowed = useOperationAllowed('putDataProductDomain');
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);

  enableCreate = enableCreate && isCreateDomainAllowed;

  const content = useMemo(() => {
    const defaultContent = LL.ENTITY['domain^']('Choose');
    if (domains && currentDomainId) {
      return domains.find((domain) => domain.domainId === currentDomainId)?.name || defaultContent;
    }
    return defaultContent;
  }, [domains, currentDomainId]);

  const items = useMemo<ButtonDropdownItem[]>(() => {
    const _items: ButtonDropdownItem[] = (domains || []).map((domain) => ({
      text: domain.name,
      onClick: () => onSelect(domain),
    }));

    if (includeAll) {
      _items.unshift({
        items: [
          {
            text: LL.VIEW.DATA_PRODUCT.Domain.selector.all(),
            onClick: () => history.push('/data-products/'),
          },
        ],
      });
    }

    if (enableCreate) {
      _items.push({
        items: [
          {
            text: LL.ENTITY.Domain__CREATE(),
            onClick: () => setShowCreateDialog(true),
            variant: 'primary',
          },
        ],
      });
    }

    return _items;
  }, [domains, onSelect, enableCreate, includeAll, history]);

  return (
    <>
      <ButtonDropdown content={content} loading={queryInfo.isLoading} disabled={isEmpty(items)} items={items} />
      {showCreateDialog && <CreateDomainDialog onClose={() => setShowCreateDialog(false)} />}
    </>
  );
};

export const DomainFormInput = (props: UseFieldApiConfig) => {
  const { input, meta } = useFieldApi(props);
  const onChange = useCallback((domain: DomainEntity) => input.onChange(domain.domainId), [input.onChange]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <label>{props.label}</label>
      <DomainSelector onSelect={onChange} currentDomainId={input.value} />
      {meta.error && <label>{meta.error}</label>}
    </div>
  );
};
