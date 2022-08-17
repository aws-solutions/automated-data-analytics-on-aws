/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Button, Inline, Link } from 'aws-northstar';
import { DeleteOntologyButton } from '$views/governance/components/DeleteOntology';
import { ErrorAlert } from '$common/components';
import { ManagedHelpPanel, PageLayout, PageNotFound } from '$northstar-plus';
import { OntologySummary } from '../../components/Summary';
import { apiHooks } from '$api';
import { getOntologyIdFromString, isNotFoundError, ontologyDisplayName } from '$common/utils';
import { useHistory, useParams } from 'react-router-dom';
import { useI18nContext } from '$strings';
import { useIsAdminOrPowerUser } from '$core/provider/UserProvider';
import React, { useMemo } from 'react';

export interface OntologyDetailViewProps {}

export const OntologyDetailView: React.FC<OntologyDetailViewProps> = () => {
  const history = useHistory();
  const { LL } = useI18nContext();
  const { ontologyId: namespaceAndOntologyId } = useParams<{ ontologyId: string }>();

  const id = getOntologyIdFromString(namespaceAndOntologyId);
  const [ontology, queryInfo] = apiHooks.useOntology(id);

  const allowEdit = useIsAdminOrPowerUser();

  const actionButtons = useMemo(() => {
    if (allowEdit !== true) return null;
    return (
      <Inline spacing="s">
        <DeleteOntologyButton ontology={ontology} />
        <Button onClick={() => history.push(`${history.location.pathname}/edit`)}>Edit</Button>
      </Inline>
    );
  }, [allowEdit, history, ontology]);

  if (isNotFoundError(queryInfo.error)) {
    return (
      <PageNotFound
        description={
          <>
            {LL.VIEW.error.notfoundOfWithName({ type: LL.ENTITY.Ontology(), name: namespaceAndOntologyId })}
            <pre>{queryInfo.error?.message}</pre>
          </>
        }
        destinationLinks={[
          <Link key="0" href="/governance/">
            {LL.VIEW.misc.seeAll(LL.ENTITY.Ontologies())}
          </Link>,
        ]}
      />
    );
  }

  return (
    <>
      <HelpInfo />
      <PageLayout title={ontologyDisplayName(id)} subtitle={ontology?.description} actionButtons={actionButtons}>
        {queryInfo.error && <ErrorAlert error={queryInfo.error} />}
        <OntologySummary id={id} />
      </PageLayout>
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.GOVERNANCE.HELP.DETAIL.header()}>
      {import('@ada/strings/markdown/view/governance/help.detail.md')}
    </ManagedHelpPanel>
  );
}
