/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixutures from '$testing/__fixtures__';
import * as stories from './index.stories';
import { LL } from '@ada/strings';
import { composeStories } from '@storybook/testing-react';
import { render } from '@testing-library/react';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const IDENTITY_PROVIDER = fixutures.IDENTITY_PROVIDER_OIDC;

const { Primary, NotFound } = composeStories(stories);

describe('views/identity-provider/detail', () => {
  it('primary', async () => {
    const { container, findByText, findAllByText } = render(<Primary {...(Primary.args as any)} />);

    expect(container).toBeDefined();

    expect(await findByText(LL.ENTITY['IdentityProvider@'].name.label())).toBeInTheDocument();
    expect(await findByText(LL.VIEW.IDENTITY_PROVIDER.STATUS.label())).toBeInTheDocument();
    expect(await findByText(LL.ENTITY.IdentityProvider())).toBeInTheDocument();
    expect(await findAllByText(IDENTITY_PROVIDER.name)).toBeDefined();
    expect(await findByText(LL.ENTITY['IdentityProvider@'].attributeMapping.label())).toBeInTheDocument();
    expect(await findByText(LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS.scopes.label())).toBeInTheDocument();
    expect(await findByText(LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.issuer.label())).toBeInTheDocument();
    expect(await findByText(LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS.clientId.label())).toBeInTheDocument();
    expect(await findByText(LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.attributeRequestMethod.label())).toBeInTheDocument();
  });

  it('not found', async () => {
    const { container, findByText } = render(<NotFound {...(NotFound.args as any)} />);

    expect(container).toBeDefined();

    expect(await findByText(LL.ENTITY.IdentityProvider__FAILED_TO_FETCH('not_existing'))).toBeInTheDocument();
  });
});
