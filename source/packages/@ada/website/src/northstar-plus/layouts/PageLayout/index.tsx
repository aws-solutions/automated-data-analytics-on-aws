/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { LAYOUT_NAME, useLayoutContext } from '../AppLayout/components/layout';
import { Skeletons } from '../../components/skeletons';
import { Stack } from 'aws-northstar';
import HeadingStripe, { HeadingStripeProps } from '../../components/HeadingStripe';
import React, { useEffect } from 'react';

interface BasePageLayoutProps extends Partial<HeadingStripeProps> {
  /**
   * Render with out page "chrome" (container, headers, etc)
   */
  layout?: LAYOUT_NAME;
  isLoading?: boolean;
}
export type PageLayoutProps = Partial<BasePageLayoutProps>;

export const PageLayout: React.FC<BasePageLayoutProps> = ({
  children,
  layout = 'default',
  isLoading,
  title,
  subtitle,
  actionButtons,
}) => {
  const { setLayout } = useLayoutContext();

  useEffect(() => {
    setLayout(layout);
  }, [layout, setLayout]);

  if (layout === 'chromeless' || layout === 'wizard') {
    return <>{children}</>;
  }

  if (isLoading) {
    return <Skeletons.Page />;
  }

  return (
    <Stack spacing="m">
      <HeadingStripe title={title || '-'} subtitle={subtitle} actionButtons={actionButtons} />
      {children}
    </Stack>
  );
};
