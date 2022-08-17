/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { EntityCreatedKV, EntityUpdatedKV, SqlViewer } from '$common/components';
import { GOVERNABLE_GROUPS } from '$common/entity/ontology';
import { OntologyIdentifier } from '@ada/api';
import { Skeletons, SummarySection } from '$northstar-plus/components';
import { SummaryRenderer } from '$northstar-plus/components/SummaryRenderer';
import { apiHooks } from '$api';
import { groupDisplayName } from '$common/entity/group/utils';
import { isEmpty, startCase, upperCase } from 'lodash';
import { ontologyLensDisplay } from '$common/utils';
import { useI18nContext } from '$strings';
import { useOntologyGovernance } from '../hooks';
import React from 'react';

export const OntologySummary: React.FC<{ id: OntologyIdentifier }> = ({ id }) => {
  const { LL } = useI18nContext();
  const [ontology] = apiHooks.useOntology(id);

  const [governance] = useOntologyGovernance(id);

  if (ontology == null || governance == null) {
    return <Skeletons.Container />;
  }

  return (
    <SummaryRenderer
      sections={[
        {
          title: LL.VIEW.GOVERNANCE.summary.title(),
          properties: [
            [
              {
                label: LL.ENTITY['Ontology@'].namespace.label(),
                value: startCase(ontology.ontologyNamespace),
              },
              {
                label: LL.ENTITY['Ontology@'].name.label(),
                value: ontology.name,
              },
            ],
            [
              {
                label: LL.ENTITY['Ontology@'].aliases.label(),
                value: (ontology.aliases || []).map(({ name }) => name),
              },
            ],
            [
              {
                value: <EntityCreatedKV entity={ontology} />,
              },
              {
                value: <EntityUpdatedKV entity={ontology} />,
              },
            ],
          ],
        },
        {
          title: LL.VIEW.GOVERNANCE.summary.section.defaultGovernance.title(),
          subtitle: LL.VIEW.GOVERNANCE.summary.section.defaultGovernance.subtitle(),
          properties: [
            {
              label: LL.ENTITY['Ontology@'].defaultLens.label(),
              value: ontology.defaultLens && upperCase(ontology.defaultLens),
            },
          ],
        },
        ...GOVERNABLE_GROUPS.map((groupId): SummarySection => {
          const { column, row } = governance[groupId];

          return {
            title: LL.VIEW.GOVERNANCE.summary.section.groupGovernance.title({
              group: groupDisplayName(groupId),
            }),
            subtitle: LL.VIEW.GOVERNANCE.summary.section.groupGovernance.subtitle({
              group: groupDisplayName(groupId),
            }),
            properties: [
              {
                label: LL.ENTITY.AttributePolicy(),
                value: column && ontologyLensDisplay(column, ontology.defaultLens),
              },
              {
                label: LL.ENTITY.AttributeValuePolicy(),
                value: isEmpty(row) ? null : (
                  <SqlViewer
                    width={350}
                    height={100}
                    value={row}
                    minLines={5}
                    maxLines={10}
                    style={{ marginTop: 10 }}
                  />
                ),
              },
            ],
          };
        }),
      ]}
    />
  );
};
