/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Button, Container, FormRenderer, Inline, Table, componentTypes } from 'aws-northstar';
import { Column } from 'aws-northstar/components/Table';
import { DefaultLensPolicy, Group, LensEnum } from '@ada/api';
import { LensIds } from '@ada/common';
import React, { useCallback, useMemo, useState } from 'react';

export interface DefaultLensesProps {
  readonly groups: Group[];
  readonly dataProductDefaultLenses?: DefaultLensPolicy;
  readonly onSaveDataProductDefaultLenses?: (defaultLens: DefaultLensPolicy) => void;
}

interface DefaultLensItem {
  groupId: string;
  lensId: LensEnum;
}

interface DefaultLenEditState {
  defaultLensId: LensEnum;
  lens: DefaultLensItem[];
}

const TITLE = 'Default Lenses';
const DESCRIPTION = 'Define the default lens to apply to the data product';

// TODO: refactor to use api hooks - currently this comp is disabled so not necessary, need to fix it completely
export const DefaultLenses: React.FC<DefaultLensesProps> = ({
  groups,
  dataProductDefaultLenses,
  onSaveDataProductDefaultLenses,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const defaultLensItems: DefaultLensItem[] = useMemo(
    () =>
      groups.map((g) => ({
        groupId: g.groupId,
        lensId:
          ((dataProductDefaultLenses || {}).defaultLensOverrides || {})[g.groupId] ||
          (dataProductDefaultLenses || {}).defaultLensId ||
          LensIds.CLEAR,
      })),
    [groups, dataProductDefaultLenses],
  );

  const defaultLensEditState: DefaultLenEditState = useMemo(
    () => ({
      defaultLensId: dataProductDefaultLenses?.defaultLensId || LensIds.CLEAR,
      lens: Object.entries((dataProductDefaultLenses || {}).defaultLensOverrides || {}).map(([groupId, lensId]) => ({
        groupId,
        lensId,
      })),
    }),
    [dataProductDefaultLenses],
  );

  const save = useCallback(
    async (formData: any) => {
      setIsSaving(true);

      const defaultLens: DefaultLensPolicy = {
        ...dataProductDefaultLenses!,
        defaultLensId: formData.defaultLensId,
        defaultLensOverrides: formData.lens.reduce((acc: any, value: DefaultLensItem) => {
          if (value && value.groupId && value.lensId) {
            acc[value.groupId] = value.lensId;
          }

          return acc;
        }, {}),
      };

      onSaveDataProductDefaultLenses && (await onSaveDataProductDefaultLenses(defaultLens));
      setIsSaving(false);
      setIsEditing(false);
    },
    [dataProductDefaultLenses, onSaveDataProductDefaultLenses],
  );

  const cancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  return isEditing ? (
    <Container title={TITLE} subtitle={DESCRIPTION}>
      <FormRenderer
        schema={{
          fields: [
            {
              label: 'Default Lens',
              description: 'Select the default lens to apply to all groups',
              component: componentTypes.SELECT,
              name: 'defaultLensId',
              options: Object.values(LensIds).map((value) => ({ value, label: value })),
            },
            {
              component: componentTypes.FIELD_ARRAY,
              name: 'lens',
              label: 'Ovveride specific group settings by defining a custom lens',
              fields: [
                {
                  component: componentTypes.SELECT,
                  name: 'groupId',
                  options: groups.map((group) => ({
                    value: group.groupId,
                    label: group.groupId,
                  })),
                },
                {
                  component: componentTypes.SELECT,
                  name: 'lensId',
                  options: Object.values(LensIds).map((value) => ({ value, label: value })),
                },
              ],
            },
          ],
        }}
        onSubmit={save}
        onCancel={cancel}
        isSubmitting={isSaving}
        initialValues={defaultLensEditState}
      />
    </Container>
  ) : (
    <Table
      tableTitle={TITLE}
      tableDescription={DESCRIPTION}
      columnDefinitions={
        [
          {
            id: 'group',
            accessor: 'groupId',
            Header: 'Group',
          },
          {
            id: 'lens',
            accessor: 'lensId',
            Header: 'Lens',
          },
        ] as Column<DefaultLensItem>[]
      }
      items={defaultLensItems}
      actionGroup={
        <Inline>
          <Button variant="normal" onClick={() => setIsEditing(true)}>
            Edit Default Lenses
          </Button>
        </Inline>
      }
    />
  );
};
