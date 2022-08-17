/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Ace } from 'ace-builds';
import { DataProductEntity, DomainEntity, SavedQueryEntity } from '@ada/api';
import { OperationEntityMeta } from '@ada/api/client/types';
import { compact, isEmpty, throttle } from 'lodash';
import { getDataProductSQLIdentitier, isDataEqual } from '$common/utils';
import { getSolutionPersistenceKey } from '$config';
import { useEffect, useMemo, useState } from 'react';
import { useI18nContext } from '$strings';
import { useIndexingContext } from '$core/provider/IndexingProvider';
import useLocalStorage from 'react-use-localstorage';

const LOCALSTORAGE_KEY = getSolutionPersistenceKey('sql.completions', true);

const THROTTLE_DELAY = 10000;

export const useSqlCompletions = () => {
  const { LL } = useI18nContext();
  const { getEntities, addIndexEventListener } = useIndexingContext();

  const [persistent, setPersistent] = useLocalStorage(LOCALSTORAGE_KEY);
  const [completions, setCompletions] = useState<Ace.Completion[]>(() =>
    isEmpty(persistent) ? undefined : JSON.parse(persistent),
  );

  /* eslint-disable sonarjs/cognitive-complexity */
  const generateCompletions = useMemo(() => { //NOSONAR (S3776:Cognitive Complexity) - won't fix
    return throttle(() => {
      const entities = getEntities();
      const generated = compact(
        entities.flatMap((entity): Ace.Completion | Ace.Completion[] | null => {
          try {
            switch (entity.__typename as keyof OperationEntityMeta) {
              case 'DataProductDomain': {
                const domain = entity as unknown as DomainEntity;
                return {
                  score: 0.9,
                  value: domain.domainId,
                  meta: LL.ENTITY.Domain(),
                };
              }

              case 'DataProductDomainDataProduct': {
                const dataProduct = entity as unknown as DataProductEntity;

                // TODO: add support for "source" datasets for the "owner" only

                // still importing - ignore from completion until ready
                if (isEmpty(dataProduct.dataSets)) return null;

                const sqlIdentifierForDP = getDataProductSQLIdentitier(dataProduct);

                const hasMultiple = Object.keys(dataProduct.dataSets || {}).length > 1;

                return Object.entries(dataProduct.dataSets).flatMap(([key, dataset]): Ace.Completion[] => {
                  const sqlIdentifier = hasMultiple ? `${sqlIdentifierForDP}.${key}` : sqlIdentifierForDP;
                  return [
                    {
                      score: 1,
                      value: sqlIdentifier,
                      meta: LL.ENTITY.DataSet(),
                    },
                    {
                      score: 1,
                      value: `FROM ${sqlIdentifier}`,
                      meta: LL.ENTITY.DataSet(),
                    },
                    {
                      caption: `SELECT * FROM ${sqlIdentifier}`,
                      value: `SELECT * FROM ${sqlIdentifier}`,
                      score: 0.9,
                      meta: LL.VIEW.QUERY.SQL_COMPLETION.TYPE.allColumns(),
                    },
                    {
                      caption: `SELECT ... FROM ${sqlIdentifier}`,
                      value: `SELECT ${Object.keys(dataset.columnMetadata).join(', ')} FROM ${sqlIdentifier}`,
                      score: 0.8,
                      meta: LL.VIEW.QUERY.SQL_COMPLETION.TYPE.spreadColumns(),
                    },
                    {
                      caption: `...${sqlIdentifier}`,
                      value: `${Object.keys(dataset.columnMetadata).join(', ')}`,
                      score: 0.8,
                      meta: LL.VIEW.QUERY.SQL_COMPLETION.TYPE.spreadColumns(),
                    },
                    ...Object.entries(dataset.columnMetadata).map(([columnName]) => ({
                      // caption must be unique or will take first, to show duplicate column for each dataset we append identifier
                      caption: `${columnName} (${sqlIdentifier})`,
                      value: columnName,
                      score: 0.7,
                      meta: LL.VIEW.QUERY.SQL_COMPLETION.TYPE.column(),
                    })),
                  ];
                });
              }

              case 'QueryNamespaceSavedQuery':
              case 'QuerySavedQuery': {
                const savedQuery = entity as unknown as SavedQueryEntity;

                return {
                  score: 1,
                  value: savedQuery.addressedAs,
                  meta: LL.ENTITY.SavedQuery(),
                };
              }
              default: {
                return null;
              }
            }
          } catch (error: any) {
            return null;
          }
        }),
      );

      // update completions only if has changed
      setCompletions((current) => {
        if (isDataEqual(current, generated)) {
          return current;
        }
        setPersistent(JSON.stringify(generated));
        return generated;
      });
    }, THROTTLE_DELAY);
  }, [getEntities]);
  /* eslint-enable sonarjs/cognitive-complexity */

  useEffect(() => {
    generateCompletions();

    return addIndexEventListener(generateCompletions);
  }, [addIndexEventListener]);

  return completions;
};
