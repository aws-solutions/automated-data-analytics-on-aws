/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Badge, ColumnLayout, Inline, StatusIndicator, Theme } from 'aws-northstar';
import { DataProductEntity, DomainEntity, GroupEntity, OntologyEntity, SavedQueryEntity, Tags } from '@ada/api';
import { EntityTypes, OperationEntityMeta } from '@ada/api/client/types';
import { ListItem, ListItemText, createStyles, makeStyles } from '@material-ui/core';
import { SearchResult } from '$core/provider/IndexingProvider';
import { SelectOption } from 'aws-northstar/components/Select';
import { SourceTypeBadge } from '$connectors/icons';
import { compact, groupBy, take } from 'lodash';
import { isEmpty } from '@aws-amplify/core';
import { useHistory } from 'react-router-dom';
import { useUserId } from '$core/provider/UserProvider';
import React, { Fragment, useCallback, useMemo } from 'react';

export const useSearchOptions = (results?: SearchResult[], limitPerType = 5) => {
  const userId = useUserId();
  return useMemo<SelectOption[]>(() => {
    if (results == null || isEmpty(results)) return [];

    return Object.entries(
      groupBy(compact(results.map((result) => searchResultToSelectOption(result, { userId }))), 'groupBy'),
    ).map(([group, _options]) => {
      return {
        group,
        label: group,
        options: take(_options, limitPerType),
      };
    }) as SelectOption[];
  }, [results, limitPerType]);
};

export interface SearchResultSelectOption extends SelectOption {
  groupBy: string;
  value: string;
  label: string;
  description: string | React.ReactNode;
  extras?: React.ReactNode[];
  tags?: Tags;
  link: string;
  entity: EntityTypes;
}

export const useRenderOption = () => {
  const history = useHistory();
  const classes = useStyles();

  return useCallback(
    (option: SearchResultSelectOption): React.ReactNode => {
      return (
        <ListItem key={option.value} className={classes.nestedListItem} onClick={() => history.push(option.link)}>
          <ColumnLayout renderDivider={false}>
            <ListItemText primary={option.label} secondary={option.description} />
            <Inline>
              {option.extras && option.extras.map((extra, i) => <Fragment key={i}>{extra}</Fragment>)}
              {option.tags &&
                option.tags.map((tag, index) => (
                  <Badge key={index} color="grey" content={(tag.value ? `${tag.key}:${tag.value}` : tag.key) as string} />
                ))}
            </Inline>
          </ColumnLayout>
        </ListItem>
      );
    },
    [history, classes],
  );
};

/* eslint-disable react/jsx-key */
export function searchResultToSelectOption(
  result: SearchResult,
  { userId }: { userId: string },
): SearchResultSelectOption | null {
  const { item } = result;

  // TODO: enhance description with result matching details to highlight why it was matched - https://fusejs.io/api/options.html#includematches
  switch (item.__typename as keyof OperationEntityMeta) {
    case 'DataProductDomain': {
      const group = 'Domains';
      const entity = item as unknown as DomainEntity;
      return {
        groupBy: group,
        label: entity.name,
        value: item.__id,
        entity: entity,
        description: entity.description,
        tags: item.tags,
        link: `/data-product/${entity.domainId}`,
      };
    }
    case 'DataProductDomainDataProduct': {
      const group = 'Data Products';
      const entity = item as unknown as DataProductEntity;
      return {
        groupBy: group,
        label: entity.name,
        value: item.__id,
        entity: entity,
        description: entity.description,
        tags: item.tags,
        extras: [<SourceTypeBadge sourceType={entity.sourceType} />],
        link: `/data-product/${entity.domainId}/${entity.dataProductId}`,
      };
    }
    case 'IdentityGroup': {
      const group = 'Groups';
      const entity = item as unknown as GroupEntity;
      const isMember = entity.members.includes(userId);
      return {
        groupBy: group,
        label: entity.groupId,
        value: item.__id,
        entity: entity,
        description: entity.description,
        tags: item.tags,
        extras: [
          isMember ? (
            <StatusIndicator statusType="positive">Member</StatusIndicator>
          ) : (
            <StatusIndicator statusType="negative">Not Member</StatusIndicator>
          ),
        ],
        link: `/groups/${entity.groupId}`,
      };
    }
    case 'Ontology': {
      const group = 'Ontologies';
      const entity = item as unknown as OntologyEntity;
      return {
        groupBy: group,
        label: entity.name,
        value: item.__id,
        entity: entity,
        description: entity.description,
        tags: item.tags,
        link: `/governance/${entity.ontologyNamespace}.${entity.ontologyId}`,
      };
    }
    case 'QueryNamespaceSavedQuery':
    case 'QuerySavedQuery': {
      const group = 'Saved Queries';
      const entity = item as unknown as SavedQueryEntity;
      const isPublic = entity.type === 'PUBLIC';
      return {
        groupBy: group,
        label: entity.addressedAs,
        value: item.__id,
        entity: entity,
        description: entity.description,
        tags: item.tags,
        extras: [
          isPublic ? (
            <StatusIndicator statusType="positive">Public</StatusIndicator>
          ) : (
            <StatusIndicator statusType="negative">Private</StatusIndicator>
          ),
        ],
        link: `/query?query=${entity.query}`,
      };
    }
    default: {
      // returning null will remove result from selectable options
      return null;
    }
  }
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    nestedListItem: {
      paddingLeft: theme.spacing(0.5),
    },
  }),
);
