/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import * as Table from 'aws-northstar/components/Table';
import { Badge, Select, Textarea } from 'aws-northstar';
import { ColumnMetadata, ColumnsMetadata } from '@ada/api';
import { SelectOption } from 'aws-northstar/components/Select';
import { apiHooks } from '$api';
import {
  findOntologyById,
  getGroupedOntologySelectionOptions,
  getOntologyIdFromString,
  getOntologyIdString,
} from '$common/utils';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useMemo } from 'react';

const EMPTY_LABEL = '-';
const NONE_VALUE = 'None';
export const NONE_ONTOLOGY_OPTION: SelectOption = { value: NONE_VALUE, label: EMPTY_LABEL };

interface ColumnDefinition extends ColumnMetadata {
  name: string;
}
type Column = Table.Column<ColumnDefinition>;
type CellProps = Table.CellProps<ColumnDefinition>;

export interface TableDefinitionOptions {
  /**
   * Ordered list of additional columns (beyond name & dataType) to display
   */
  columns?: ('description' | 'pii' | 'ontology')[];
  variant?: 'compact';
  isEditMode?: boolean;
  isSaving?: boolean;
  updateColumn?: (name: string, columnMetadata: Partial<ColumnMetadata>) => void;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function useColumnDefinitions(  //NOSONAR (S3776:Cognitive Complexity) - won't fix
  _columnsMetadata?: ColumnsMetadata,
  { columns = [], isEditMode, isSaving, updateColumn }: TableDefinitionOptions = {},
) {
  if (isEditMode && updateColumn == null) throw new Error('`updateColumn` option must be proved for edit mode');

  const { LL } = useI18nContext();
  const [ontologies] = apiHooks.useAllOntologies();
  const ontologyOptions = useMemo<SelectOption[]>(
    () => [NONE_ONTOLOGY_OPTION].concat(getGroupedOntologySelectionOptions(ontologies || [])),
    [ontologies],
  );

  return useMemo<Column[] | null>(() => {
    const columnDefinitions: Column[] = [
      {
        id: 'name',
        accessor: 'name',
        Header: LL.VIEW.DATA_PRODUCT.SCHEMA.COLUMN.name.label(),
        width: 0.5,
      },
      {
        id: 'type',
        accessor: 'dataType',
        Header: LL.VIEW.DATA_PRODUCT.SCHEMA.COLUMN.dataType.label(),
        width: 1,
      },
      ...(columns || []).map((column): Column => {
        switch (column) {
          case 'description': {
            return {
              id: 'description',
              accessor: 'description',
              Header: LL.VIEW.DATA_PRODUCT.SCHEMA.COLUMN.description.label(),
              width: 0.5,
              Cell: ({ value, row }) =>
                isEditMode && updateColumn ? (
                  <Textarea
                    placeholder={LL.VIEW.DATA_PRODUCT.SCHEMA.COLUMN.description.placeholder({
                      columnName: row.original.name,
                    })}
                    value={value}
                    disabled={isSaving}
                    onChange={(event) => {
                      updateColumn(row.original.name, {
                        description: event.target.value as string,
                      });
                    }}
                  />
                ) : (
                  value || EMPTY_LABEL
                ),
            };
          }
          case 'pii': {
            return {
              id: 'piiClassification',
              accessor: 'piiClassification',
              Header: LL.VIEW.DATA_PRODUCT.SCHEMA.COLUMN.piiClassification.label(),
              width: 0.5,
              Cell: ({ value }) => (value ? <Badge content={value!} /> : EMPTY_LABEL),
            };
          }
          case 'ontology': {
            return {
              id: 'ontology',
              Header: LL.VIEW.DATA_PRODUCT.SCHEMA.COLUMN.ontology.label(),
              width: 1,
              Cell: ({ row }: CellProps) => {
                const { ontologyNamespace, ontologyAttributeId } = row.original;
                const selectedOntologyId =
                  ontologyNamespace && ontologyAttributeId
                    ? getOntologyIdString({ ontologyNamespace, ontologyId: ontologyAttributeId })
                    : undefined;
                const selectedOntology =
                  ontologies && selectedOntologyId ? findOntologyById(selectedOntologyId, ontologies) : undefined;
                const selectedOntologyOption: SelectOption | undefined = selectedOntology && {
                  label: selectedOntology.name,
                  value: selectedOntologyId,
                };

                return isEditMode && updateColumn ? (
                  <Select
                    label={LL.VIEW.DATA_PRODUCT.SCHEMA.COLUMN.ontology.named(row.original.name)}
                    selectedOption={selectedOntologyOption}
                    options={ontologyOptions}
                    disabled={isSaving}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value == null || value === NONE_VALUE) {
                        // remove ontology definition
                        updateColumn(row.original.name, {
                          ontologyNamespace: undefined,
                          ontologyAttributeId: undefined,
                        });
                      } else {
                        const ontologyIdentifier = getOntologyIdFromString(value as string);

                        updateColumn(row.original.name, {
                          ontologyNamespace: ontologyIdentifier.ontologyNamespace,
                          ontologyAttributeId: ontologyIdentifier.ontologyId,
                        });
                      }
                    }}
                  />
                ) : selectedOntology ? (
                  selectedOntology.name
                ) : (
                  EMPTY_LABEL
                );
              },
            };
          }
        }
      }),
    ];

    return columnDefinitions;
  }, [JSON.stringify(columns), isEditMode, isSaving, updateColumn, ontologyOptions]);
}
