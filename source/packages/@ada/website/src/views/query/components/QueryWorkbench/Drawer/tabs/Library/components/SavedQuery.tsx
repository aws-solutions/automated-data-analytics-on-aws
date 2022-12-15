/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ButtonDropdown, TagGroup } from '$northstar-plus';
import { Column, ColumnLayout, Heading, KeyValuePair, Popover, Stack, StatusIndicator, Text } from 'aws-northstar';
import { Divider } from '@material-ui/core';
import { SavedQueryEntity } from '@ada/api';
import { SqlViewer } from '$common/components/query';
import { Theme, createStyles, makeStyles } from '@material-ui/core/styles';
import { identifierToName } from '$common/utils';
import { isEmpty } from 'lodash';
import { useDeleteSavedQueryButtonDropdownItem } from '../../../../../DeleteSavedQuery';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useQueryWorkbench } from '$views/query/components/QueryWorkbench/context';
import { useUserId } from '$core/provider/UserProvider';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardHeader from '@material-ui/core/CardHeader';
import MenuIcon from '@material-ui/icons/Menu';
import React, { useCallback } from 'react';
import Truncate from 'react-truncate';

export const SavedQuery: React.FC<{ savedQuery: SavedQueryEntity }> = ({ savedQuery }) => {
  const { setQuery } = useQueryWorkbench();
  const { queryId, query, description, addressedAs } = savedQuery;
  const [deleteActionItem, deleteConfirmation] = useDeleteSavedQueryButtonDropdownItem(savedQuery);

  const classes = useStyles();

  const onClick = useCallback(() => {
    setQuery(query);
  }, [setQuery, query]);

  return (
    <Card className={classes.root} onClick={onClick} variant="outlined">
      <CardHeader
        className={classes.header}
        title={
          <Popover
            fixedWidth
            position="right"
            size="large"
            showDismissButton={false}
            triggerType="text"
            variant="hover"
            header={addressedAs}
            content={<SavedQueryDetails savedQuery={savedQuery} />}
          >
            <Heading variant="h5">{identifierToName(queryId)}</Heading>
          </Popover>
        }
        subheader={
          <Truncate lines={1}>
            <Text variant="small" color="textSecondary">
              {description}
            </Text>
          </Truncate>
        }
        action={
          <ButtonDropdown
            darkTheme
            disableArrowDropdown
            content={
              <MenuIcon fontSize="small" htmlColor="grey" aria-label="hamburger" data-testid="saved-query-menu-icon" />
            }
            items={deleteActionItem && [deleteActionItem]}
          />
        }
      />
      <CardContent className={classes.content}>
        <SqlViewer maxLines={2} value={query} disableSelection fontSize="0.7em" />
      </CardContent>

      {deleteConfirmation}
    </Card>
  );
};

const SavedQueryDetails: React.FC<{ savedQuery: SavedQueryEntity }> = ({ savedQuery }) => {
  const { LL } = useI18nContext();
  const userId = useUserId();
  const { type, query, description, referencedDataSets, referencedQueries, tags } = savedQuery;
  const isPublic = type === 'PUBLIC';
  const hasSecondColumn = !isEmpty(tags) || !isEmpty(referencedDataSets) || !isEmpty(referencedQueries);

  return (
    <Stack spacing="s">
      <ColumnLayout>
        <Column>
          <Stack>
            <KeyValuePair label={LL.ENTITY['SavedQuery@'].description.label()} value={description} />
            <KeyValuePair
              label={LL.VIEW.QUERY.SAVED_QUERY.shared.label()}
              value={
                isPublic ? (
                  <StatusIndicator statusType="positive">{LL.VIEW.QUERY.SAVED_QUERY.PUBLIC.type.label()}</StatusIndicator>
                ) : (
                  <StatusIndicator statusType="negative">{LL.VIEW.QUERY.SAVED_QUERY.PRIVATE.type.label()}</StatusIndicator>
                )
              }
            />
          </Stack>
        </Column>
        {!hasSecondColumn ? null : (
          <Column>
            <Stack>
              {(referencedDataSets || referencedQueries) && (
                <KeyValuePair
                  label={LL.VIEW.misc.References()}
                  value={
                    <>
                      {referencedDataSets &&
                        referencedDataSets.map((ref) => <li key={ref.addressedAs}>{ref.addressedAs}</li>)}
                      {referencedQueries &&
                        referencedQueries.map((ref) => (
                          <li key={`${ref.namespace}:${ref.queryId}`}>{`${
                            ref.namespace === userId ? 'my' : ref.namespace
                          }.${ref.queryId}`}</li>
                        ))}
                    </>
                  }
                />
              )}
              {tags && !isEmpty(tags) && <KeyValuePair label="Tags" value={<TagGroup tags={tags as any} />} />}
            </Stack>
          </Column>
        )}
      </ColumnLayout>
      <Divider />
      <SqlViewer maxLines={10} value={query} disableSelection />
    </Stack>
  );
};

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      margin: 0,
      position: 'relative',
    },
    header: {
      margin: 0,
      padding: theme.spacing(0.5),

      '& .MuiCardHeader-title': {
        fontWeight: 'bold',
      },
      '& .MuiCardHeader-subheader': {
        color: theme.palette.text.secondary,
      },
      '& .MuiCardHeader-action': {
        margin: 0,
      },
    },
    content: {
      padding: 0,
    },
    /* TODO: fix alignment of popover to be "left", if not using absolute trigger the popover breaks the content flow */
    popoverTrigger: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'transparent',
      paddingLeft: '100%',
    },
  }),
);
