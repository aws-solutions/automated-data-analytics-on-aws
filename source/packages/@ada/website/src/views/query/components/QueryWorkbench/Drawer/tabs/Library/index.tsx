/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Box, Container, LoadingIndicator, makeStyles } from 'aws-northstar';
import { SavedQuery } from './components/SavedQuery';
import { SavedQueryEntity } from '@ada/api';
import { apiHooks } from '$api';
import { createStyles } from '@material-ui/core';
import { isEmpty } from 'lodash';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useUserId } from '$core/provider/UserProvider';
import React from 'react';

export const Library: React.FC<{}> = () => {
  const { LL } = useI18nContext();
  const userId = useUserId();
  const [privateQueries, { isLoading: isLoadingPrivateQueries }] = apiHooks.useQueryNamespaceSavedQueries(
    {
      namespace: userId,
    },
    {
      select: (queries) => queries.filter((query) => query.type === 'PRIVATE'),
    },
  );
  const [publicQueries, { isLoading: isLoadingPublicQueries }] = apiHooks.useAllQuerySavedQueries(
    {},
    {
      select: (queries) => queries.filter((query) => query.type === 'PUBLIC'),
    },
  );

  const classes = useStyles();

  return (
    <Box className={classes.root}>
      <QueriesList
        title={LL.VIEW.QUERY.SAVED_QUERY.PRIVATE.title()}
        subtitle={LL.VIEW.QUERY.SAVED_QUERY.PRIVATE.subtitle()}
        queries={privateQueries}
        isLoading={isLoadingPrivateQueries}
      />
      <QueriesList
        title={LL.VIEW.QUERY.SAVED_QUERY.PUBLIC.title()}
        subtitle={LL.VIEW.QUERY.SAVED_QUERY.PUBLIC.subtitle()}
        queries={publicQueries}
        isLoading={isLoadingPublicQueries}
      />
    </Box>
  );
};

const QueriesList: React.FC<{ title: string; subtitle: string; queries?: SavedQueryEntity[]; isLoading: boolean }> = ({
  title,
  queries,
  isLoading,
}) => {
  const { LL } = useI18nContext();
  const noQueries = isEmpty(queries);

  const classes = useStyles();

  return (
    <Container title={title} gutters={false} headingVariant="h4">
      {isLoading || queries == null ? (
        <Box className={classes.noContent}>
          <LoadingIndicator size="normal" />
        </Box>
      ) : noQueries ? (
        <Box className={classes.noContent}>{LL.VIEW.QUERY.SAVED_QUERY.emptyText()}</Box>
      ) : (
        queries.map((query) => <SavedQuery key={query.addressedAs} savedQuery={query} />)
      )}
    </Container>
  );
};

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      alignSelf: 'stretch',
      justifySelf: 'stretch',

      '& > div': {
        flex: 1,
        alignSelf: 'stretch',
        justifySelf: 'stretch',
        maxHeight: '50%',
        overflow: 'hidden',
        // TODO: fix the max height to be 50% for private/public queries
      },
    },
    noContent: {
      display: 'flex',
      flexDirection: 'column',
      padding: '1em',
      textAlign: 'center',
      '& > div': {
        margin: 'auto',
      },
    },
  }),
);
