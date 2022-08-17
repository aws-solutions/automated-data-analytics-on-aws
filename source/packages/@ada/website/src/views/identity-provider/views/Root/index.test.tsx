/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixutures from '$testing/__fixtures__';
import * as stories from './index.stories';
import { composeStories } from '@storybook/testing-react';
import { render } from '@testing-library/react';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary } = composeStories(stories);

describe('views/identity-provider/root', () => {
  it('primary', async () => {
    const { container, findByText } = render(<Primary {...(Primary.args as any)} />);

    expect(container).toBeDefined();

    expect(await findByText(fixutures.IDENTITY_PROVIDER_OIDC.identityProviderId)).toBeInTheDocument();
    expect(await findByText(fixutures.IDENTITY_PROVIDER_OIDC.type)).toBeInTheDocument();
    expect(await findByText(fixutures.IDENTITY_PROVIDER_OIDC.name)).toBeInTheDocument();
    expect(await findByText(fixutures.IDENTITY_PROVIDER_OIDC.description!)).toBeInTheDocument();

    expect(await findByText(fixutures.IDENTITY_PROVIDER_SAML.identityProviderId)).toBeInTheDocument();
    expect(await findByText(fixutures.IDENTITY_PROVIDER_SAML.type)).toBeInTheDocument();
    expect(await findByText(fixutures.IDENTITY_PROVIDER_SAML.name)).toBeInTheDocument();
    expect(await findByText(fixutures.IDENTITY_PROVIDER_SAML.description!)).toBeInTheDocument();
  });
});
