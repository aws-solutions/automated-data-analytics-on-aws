/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  ColumnMetadata,
  ColumnsMetadata,
  DataProductEntity,
  DataProductIdentifier,
  DataProductPreview,
  DataSet,
  DataSetIdentifiers,
  DataSetPreview,
} from '@ada/api';
import { DataProductDataStatus, DataProductSourceDataStatus } from '@ada/common';
import { LL, useI18nContext } from '$strings';
import { Updater, useImmer } from 'use-immer';
import { apiHooks } from '$api';
import { current } from 'immer';
import {
  getDataProductSQLIdentitier,
  isDataEqual,
  previewSchemaToColumnMetadata,
  sanitiseDataForTable,
  sortDataSetIds,
} from '$common/utils';
import { isEmpty, isNil, mapValues, omitBy, pick, take } from 'lodash';
import { isOwner, useUserId } from '$core/provider/UserProvider';
import { useNotificationContext } from '$northstar-plus';
import { useStatefulRef } from '$common/hooks';
import { useUserCanEditDataProduct } from '$views/data-product/hooks';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export interface NormalizedDatasetSchema {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly columns: ColumnsMetadata;
  readonly sample?: any[];
  readonly identifiers?: DataSetIdentifiers;
  /** Indicates if dataset can be queried in workbench, if so will have deep link enabled based on id */
  readonly queryable?: boolean;
  readonly isDataReady?: boolean;
  /**
   * Indicates if this dataset is the default.
   */
  readonly isDefault: boolean;
  /** Indicates if dataset can be edited; such that "source" can NOT be edited - not in regards to permissions. */
  readonly isEditable: boolean;
}

export type NormalizedDatasetSchemaMap = Record<string, NormalizedDatasetSchema>;

export interface NormalizedDatasetGroup {
  readonly title?: string;
  readonly datasets: NormalizedDatasetSchemaMap;
  readonly ids: string[];
  readonly defaultId: string;
  readonly isSingleDataset: boolean;
}

export interface NormalizedSchema {
  readonly source?: NormalizedDatasetGroup;

  readonly current?: NormalizedDatasetGroup;
}

export interface ISchemaRendererContext extends ReturnType<typeof useMutableDataSet> {
  readonly schema?: NormalizedSchema;
  readonly updateSchema: Updater<NormalizedSchema | undefined>;
  readonly hasMultipleDatasets: boolean;
  readonly totalDatasets: number;

  readonly loadDataProductPreview: (preview: DataProductPreview) => void;
  readonly loadDataProductEntity: (entity: DataProductEntity) => void;

  readonly isPreview?: boolean;
  readonly variant?: 'default' | 'compact';

  /** Indicates if the current user is the creator */
  readonly isCreator: boolean;

  readonly isEditAllowed: boolean;
  readonly isEditMode: boolean;
  readonly enterEditMode: () => void;
  readonly exitEditMode: () => void;

  readonly sampleDataset?: NormalizedDatasetSchema;
  readonly setSampleDataset: React.Dispatch<React.SetStateAction<NormalizedDatasetSchema | undefined>>;
}

const SchemaRendererContext = createContext<ISchemaRendererContext | undefined>(undefined);

export const useSchemaRenderer = () => {
  const context = useContext(SchemaRendererContext);
  if (context == null) throw new Error('Must wrap with SchemaRenderContext.Provider');
  return context;
};

export const SchemaRendererProvider: React.FC<{ dataProductId?: DataProductIdentifier }> = ({
  children,
  dataProductId,
}) => {
  const userId = useUserId();
  const [isCreator, setIsCreator] = useState(false);
  const isEditAllowed = useUserCanEditDataProduct(dataProductId) || false;

  const [isPreview, setIsPreview] = useState(false);
  const [schema, updateSchema] = useImmer<NormalizedSchema | undefined>(undefined);
  const schemaRef = useStatefulRef(schema);

  const [totalDatasets, setTotalDatasets] = useState<number>(0);

  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const enterEditMode = useCallback(() => setIsEditMode(true), [setIsEditMode]);
  const exitEditMode = useCallback(() => setIsEditMode(false), [setIsEditMode]);

  const onSaveDataSet = useCallback(() => {
    exitEditMode();
  }, [exitEditMode]);

  const mutableContext = useMutableDataSet({
    dataProductId,
    onSave: onSaveDataSet,
  });
  const { setDataset } = mutableContext;

  const loadDataProductPreview = useCallback<ISchemaRendererContext['loadDataProductPreview']>(
    (preview) => {
      setIsCreator(true); // user is always creator during wizard preview

      const _schema = normalizeDataProductPreview(preview);

      if (!isDataEqual(_schema, schemaRef.current)) {
        updateSchema(_schema);
        setDataset(_schema.current?.datasets && _schema.current.datasets[_schema.current.defaultId]);
        setTotalDatasets(calculateTotalDataSets(_schema));
        setIsEditMode(false);
        setIsPreview(true);
      }
    },
    [updateSchema, setDataset, setIsEditMode, setIsPreview, setIsCreator],
  );

  const loadDataProductEntity = useCallback<ISchemaRendererContext['loadDataProductEntity']>(
    (entity) => {
      const _isCreator = isOwner(userId, entity);
      setIsCreator(_isCreator);

      const _schema = normalizeDataProductEntity(entity, _isCreator);

      if (!isDataEqual(_schema, schemaRef.current)) {
        updateSchema(_schema);
        setDataset(_schema.current?.datasets && _schema.current.datasets[_schema.current.defaultId]);
        setTotalDatasets(calculateTotalDataSets(_schema));
        setIsEditMode(false);
        setIsPreview(false);
      }
    },
    [updateSchema, setDataset, setIsEditMode, setIsPreview, setIsCreator, userId],
  );

  const [sampleDataset, setSampleDataset] = useState<NormalizedDatasetSchema>();

  const context: ISchemaRendererContext = useMemo(() => ({
    ...mutableContext,

    schema,
    updateSchema,
    totalDatasets,
    hasMultipleDatasets: totalDatasets > 1,
    loadDataProductPreview,
    loadDataProductEntity,

    isCreator,
    isEditAllowed: isEditAllowed && !isPreview,
    isEditMode,
    enterEditMode,
    exitEditMode,

    sampleDataset,
    setSampleDataset,
  }), [
    mutableContext,

    schema,
    updateSchema,
    totalDatasets,
    loadDataProductPreview,
    loadDataProductEntity,

    isCreator,
    isEditAllowed,
    isPreview,

    isEditMode,
    enterEditMode,
    exitEditMode,

    sampleDataset,
    setSampleDataset,
  ]);

  return <SchemaRendererContext.Provider value={context}>{children}</SchemaRendererContext.Provider>;
};

interface UseMutableDataSetProps {
  dataProductId?: DataProductIdentifier;
  onSave: () => void;
}

const useMutableDataSet = ({ dataProductId, onSave }: UseMutableDataSetProps) => {
  const { LL:_LL } = useI18nContext();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const { addError, addSuccess } = useNotificationContext();

  const originalDataset = useRef<NormalizedDatasetSchema | undefined>(undefined);
  const [mutableDataset, updateMutableDataset] = useImmer<NormalizedDatasetSchema | undefined>(undefined);
  const setDataset = useCallback(
    (dataset?: NormalizedDatasetSchema): void => {
      if (!isDataEqual(originalDataset.current, dataset)) {
        originalDataset.current = dataset;
        updateMutableDataset(dataset);
      }
    },
    [updateMutableDataset],
  );

  const fetchDataProduct = apiHooks.useFetchDataProductDomainDataProduct();

  const [saveDataProduct] = apiHooks.usePutDataProductDomainDataProduct({
    onSuccess: useCallback(
      ({ domainId, dataProductId }: DataProductIdentifier) => { //NOSONAR (S1117:ShadowVar) - ignore for readability
        addSuccess({
          header: _LL.ENTITY.DataProduct__UPDATED(`${domainId}.${dataProductId}`),
        });

        onSave && onSave();
      },
      [addSuccess, onSave],
    ),
    onError: useCallback(
      (error: any, { domainId, dataProductId }) => { //NOSONAR (S1117:ShadowVar) - ignore for readability
        addError({
          header: _LL.ENTITY.DataProduct__FAILED_TO_UPDATE(`${domainId}.${dataProductId}`),
          content: error.message,
        });
      },
      [addError],
    ),
    onSettled: useCallback(() => {
      setIsSaving(false);
    }, [setIsSaving]),
  });

  const updateDatasetColumn = useCallback(
    (name: string, columnMetadata: Partial<ColumnMetadata>) => {
      updateMutableDataset((draft) => {
        if (draft == null) throw new Error('No active dataset to update columns');
        draft.columns[name] = omitBy(
          {
            ...current(draft).columns[name],
            ...columnMetadata,
          },
          isNil,
        ) as any;
      });
    },
    [updateMutableDataset],
  );

  const saveDataset = useCallback(async () => {
    if (dataProductId == null) throw new Error('Must provide `dataProductId` to save dataset');
    if (mutableDataset == null) throw new Error('mutableDataset is undefined during save');
    setIsSaving(true);
    const [dataSetId, dataSet] = denormalizeDataSet(mutableDataset);
    const dataProduct = await fetchDataProduct(dataProductId);
    saveDataProduct({
      ...dataProductId,
      dataProductInput: {
        ...dataProduct,
        dataSets: {
          ...dataProduct.dataSets,
          [dataSetId]: dataSet,
        },
      },
    });
  }, [dataProductId, mutableDataset, fetchDataProduct, saveDataProduct]);

  const resetDataset = useCallback(() => {
    setDataset(originalDataset.current);
  }, []);

  return {
    isSaving,
    dataset: mutableDataset,
    setDataset,
    updateDatasetColumn,
    saveDataset,
    resetDataset,
  };
};

type NormalizableDatasets =
  | DataProductPreview['initialDataSets']
  | DataProductPreview['transformedDataSets']
  | DataProductEntity['sourceDataSets']
  | DataProductEntity['dataSets'];

function marshalDatasetGroup<T extends NormalizableDatasets | undefined>(
  title: string,
  datasets: T,
  normalizeFunc: typeof normalizeDataSetPreview | typeof normalizeDataSetEntity,
  rootId: string,
  isEditable: boolean,
  isDataReady?: boolean,
): T extends undefined ? undefined : NormalizedDatasetGroup {
  if (datasets == null || isEmpty(datasets)) return undefined as any;

  const datasetsCount = Object.keys(datasets).length;
  const isSingleDataset = datasetsCount === 1;
  const ids = sortDataSetIds(Object.keys(datasets));
  const defaultId = ids[0];

  const normalizedDataSets = Object.fromEntries(
    Object.entries(datasets).map(([key, dataSet]) => {
      const id = isSingleDataset ? rootId : `${rootId}.${key}`;

      return [key, normalizeFunc(key === defaultId, id, key, dataSet, isEditable, isDataReady)];
    }),
  );

  const group: NormalizedDatasetGroup = {
    title,
    datasets: normalizedDataSets,
    ids,
    defaultId,
    isSingleDataset,
  };

  return group as any;
}

function normalizeDataProductPreview(preview: DataProductPreview): NormalizedSchema {
  if (preview.transformedDataSets == null) {
    throw new Error('DataProductPreview missing `transformedDataSets` - failed to convert to schema');
  }

  return {
    // source
    source: marshalDatasetGroup(
      LL.ENTITY.Schema_.source(),
      preview.initialDataSets,
      normalizeDataSetPreview,
      'source',
      false,
    ),
    // transformed
    current: marshalDatasetGroup(
      LL.ENTITY.Schema_.transformed(),
      preview.transformedDataSets,
      normalizeDataSetPreview,
      'transformed',
      false,
    ),
  };
}

function normalizeDataSetPreview(
  isDefault: boolean,
  id: string,
  name: string,
  dataSet: DataSetPreview,
  isEditable: boolean,
): NormalizedDatasetSchema {
  return {
    id,
    name,
    columns: previewSchemaToColumnMetadata(dataSet.schema),
    sample: sanitiseDataForTable(take(dataSet.data, 10), 50),
    isDefault,
    isEditable,
  };
}

function normalizeDataProductEntity(entity: DataProductEntity, isCreator: boolean): NormalizedSchema {
  const sqlIdentifierForDP = getDataProductSQLIdentitier(entity);

  return {
    // source - only show for creator of data product!
    source:
      isCreator !== true
        ? undefined
        : marshalDatasetGroup(
            LL.ENTITY.Schema_.source(),
            entity.sourceDataSets,
            normalizeDataSetEntity,
            `source.${sqlIdentifierForDP}`,
            false,
            entity.sourceDataStatus === DataProductSourceDataStatus.READY,
          ),
    // transformed
    current: marshalDatasetGroup(
      LL.ENTITY.Schema_.transformed(),
      entity.dataSets,
      normalizeDataSetEntity,
      sqlIdentifierForDP,
      true,
      entity.dataStatus === DataProductDataStatus.READY,
    ),
  };
}

function normalizeDataSetEntity(
  isDefault: boolean,
  id: string,
  name: string,
  dataSet: DataSet,
  isEditable: boolean,
  isDataReady?: boolean,
): NormalizedDatasetSchema {
  return {
    id,
    name,
    columns: dataSet.columnMetadata,
    identifiers: dataSet.identifiers,
    queryable: true, // enable deep link to query workbench
    isDefault,
    isEditable,
    isDataReady,
  };
}

function denormalizeDataSet({ name, identifiers, columns, description }: NormalizedDatasetSchema): [string, DataSet] {
  return [
    name,
    {
      name,
      description,
      identifiers: identifiers!,
      columnMetadata: mapValues(columns, (column) =>
        pick(column, [
          'dataType',
          'description',
          'ontologyAttributeId',
          'ontologyNamespace',
          'piiClassification',
        ] as (keyof ColumnMetadata)[]),
      ),
    },
  ];
}

function calculateTotalDataSets(schema?: NormalizedSchema): number {
  if (schema == null) return 0;

  const d1 = Object.keys(schema.source?.datasets || {}).length;
  const d2 = Object.keys(schema.current?.datasets || {}).length;
  return d1 + d2;
}
