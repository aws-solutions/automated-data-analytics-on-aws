/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as POLLING from '$config/polling';
import { ENV_TEST } from '$config';
import { EntityCacheEventEmitter } from '$api';
import { EntityScoreChangeHandler, EntityStore, NormalizedEntity } from './entity-store';
import { EventEmitter } from 'eventemitter3';
import { OperationEntityMeta } from '@ada/api-client/types';
import { compact, uniqBy } from 'lodash';
import { useFetchIndex } from './fetch';
import Fuse from 'fuse.js';
import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

export type SearchResult = Fuse.FuseResult<NormalizedEntity>;

export const INDEXING_INTERVAL = POLLING.INDEXING;

export const INDEXING_MIN_MATCH_CHARS = 2; // 2 chars to support "s3", "ga", etc

export interface IndexingContext {
  search: Fuse<NormalizedEntity>['search'];
  getEntities(): NormalizedEntity[];
  refreshIndex: () => void;
  /** Add event listener for index events; returns remove listener callback */
  addIndexEventListener: (listener: () => void) => () => void;
  setEntity: EntityStore['setEntity'];
}

const NOOP = (() => {
  !ENV_TEST && console.warn('IndexingContext not provided.');
  return [];
}) as any;

const IndexingContext = createContext<IndexingContext>({ //NOSONAR (S2814:Duplicate) - false positive - type vs value
  search: NOOP,
  getEntities: NOOP,
  refreshIndex: NOOP,
  addIndexEventListener: NOOP,
  setEntity: NOOP,
});

export const useIndexingContext = () => {
  return useContext(IndexingContext);
};

export const useSearch = () => {
  return useIndexingContext().search;
};

export const useRefreshIndex = () => {
  return useIndexingContext().refreshIndex;
};

export const IndexingProvider: React.FC<{}> = ({ children }) => {
  const fuseOptions = useMemo<Fuse.IFuseOptions<NormalizedEntity>>(() => {
    return {
      includeScore: true,
      includeMatches: true,
      isCaseSensitive: false,
      minMatchCharLength: INDEXING_MIN_MATCH_CHARS,
      shouldSort: true,
      keys: [
        {
          name: 'name',
          weight: 10,
        },
        {
          name: 'addressedAs',
          weight: 8,
        },
        {
          name: 'namespace',
          weight: 4,
        },
        {
          name: 'description',
          weight: 5,
        },
        {
          name: 'tags.key',
          weight: 5,
        },
        {
          name: 'tags.value',
          weight: 5,
        },
        {
          name: 'createdBy',
          weight: 4,
        },
        {
          name: 'updatedBy',
          weight: 4,
        },
        {
          name: 'parentDataProducts.addressedAs',
          weight: 2,
        },
        {
          name: 'childDataProducts.addressedAs',
          weight: 2,
        },
        {
          name: 'referencedQueries.addressedAs',
          weight: 2,
        },
        {
          name: 'query',
          weight: 2,
        },
        {
          name: 'sourceType',
          weight: 3,
        },
        ...uniqBy(
          Object.values(OperationEntityMeta).flatMap(({ entityKey }) => {
            return compact(
              entityKey.map((key, index) => ({
                name: key,
                weight: index === 0 ? 4 : 8,
              })),
            );
          }),
          'name',
        ),
      ],
    };
  }, [OperationEntityMeta]);

  const emitter = useMemo(() => {
    return new EventEmitter<'UPDATE'>();
  }, []);
  const addIndexEventListener = useCallback<IndexingContext['addIndexEventListener']>(
    (listener: () => void) => {
      emitter.on('UPDATE', listener);
      return () => {
        emitter.off('UPDATE', listener);
      };
    },
    [emitter],
  );

  const fuse = useMemo<Fuse<NormalizedEntity>>(() => new Fuse([], fuseOptions), [fuseOptions]);

  const storeChangeHandler = useCallback<EntityScoreChangeHandler>(
    (entity, action) => {
      // always remove from index to prevent duplicates
      fuse.remove((doc) => doc.__id === entity.__id);
      if (action !== 'REMOVE') {
        fuse.add(entity);
      }
      emitter.emit('UPDATE');
    },
    [fuse],
  );

  const entityStore = useMemo<EntityStore>(() => {
    const _entityStore = new EntityStore(EntityCacheEventEmitter);
    _entityStore.on('CHANGE', storeChangeHandler);

    return _entityStore;
  }, [storeChangeHandler]);

  useEffect(() => {
    return () => {
      entityStore.destroy();
    };
  }, [entityStore]);

  const search = useCallback<Fuse<NormalizedEntity>['search']>(
    (pattern, options) => {
      return fuse.search(pattern, options);
    },
    [fuse],
  );

  const getEntities = useCallback<IndexingContext['getEntities']>(() => {
    return entityStore.getEntities();
  }, [entityStore]);

  const refreshIndex = useFetchIndex(INDEXING_INTERVAL);

  // fetch initial index on mount
  useEffect(() => {
    refreshIndex();
  }, []);

  const context = useMemo<IndexingContext>(() => {
    return {
      search,
      getEntities,
      refreshIndex,
      addIndexEventListener,
      setEntity: entityStore.setEntity.bind(entityStore),
    };
  }, [getEntities, entityStore, search, refreshIndex]);

  return <IndexingContext.Provider value={context}>{children}</IndexingContext.Provider>;
};
