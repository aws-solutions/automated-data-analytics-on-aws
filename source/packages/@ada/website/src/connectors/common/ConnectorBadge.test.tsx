/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ConnectorBadgeList } from './ConnectorBadge';
import { Connectors } from '@ada/connectors';
import { render } from '@testing-library/react';

describe('ConnectorBadgeList', () => {
  it('render', async () => {
    const connector = {
      CONFIG: {
        deprecated: true,
        stability: Connectors.Stability.EXPERIMENTAL,
        supports: {
          disableAutomaticPii: true,
        },
      },
    } as unknown as Connectors.IConnector;

    const { findAllByText } = render(<ConnectorBadgeList connector={connector} />);

    expect((await findAllByText('Experimental')).length).toBeGreaterThan(0);
    expect((await findAllByText('Deprecated')).length).toBeGreaterThan(0);
    expect((await findAllByText('Automatic PII Not Available')).length).toBeGreaterThan(0);
  });
});
