/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import './index.css';
import { AccessRequestProvider } from '$common/entity/access-request';
import { Admin, DataProduct, Group, Ontology, Public, Query, User } from '$views';
import { ApiHookDev } from '$api/dev/ApiHooksDev';
import { AppLayoutProps, AppLayout as BaseAppLayout, ManagedHelpPanel } from '$northstar-plus/layouts/AppLayout';
import { BreadcrumbGroup, Inline, SideNavigation } from 'aws-northstar';
import { ENV_DEVELOPMENT } from '$config';
import { GlobalSearch } from '$core/App/components/GlobalSearch';
import { Header } from '$northstar-plus';
import { LoggedUserMenu } from '$views/user/components/Menu';
import { PersistentNotifications } from './components/PersistentNotifications';
import { Redirect, Route, Switch } from 'react-router-dom';
import { RootAdminNotification } from './components/RootAdminNotification';
import { SideNavigationItem, SideNavigationItemType } from 'aws-northstar/components/SideNavigation';
import { TransformBuilder } from '$views/data-product/views/Create/components/TransformsPlanner/components/TransformBuilder';
import { useHasNoAccess, useIsAdmin, useIsRootAdmin } from '$core/provider/UserProvider';
import { useI18nContext } from '$strings';
import HomeIcon from '@material-ui/icons/Home';
import React, { useMemo } from 'react';

const AppLayout: React.FC<AppLayoutProps> = ({ children, ...props }) => {
  return (
    <BaseAppLayout {...props}>
      <AccessRequestProvider>{children}</AccessRequestProvider>
    </BaseAppLayout>
  );
};

export const App: React.FC = () => {
  const hasNoAccess = useHasNoAccess();
  const isAdmin = useIsAdmin();
  const isRootAdmin = useIsRootAdmin();
  const { LL } = useI18nContext();

  const navItems = useMemo<SideNavigationItem[]>(() => {
    const items: SideNavigationItem[] = [
      {
        type: SideNavigationItemType.LINK,
        text: LL.VIEW.DATA_PRODUCT.nav(),
        href: '/data-product',
      },
      {
        type: SideNavigationItemType.LINK,
        text: LL.VIEW.QUERY.nav(),
        href: '/query',
      },
      {
        type: SideNavigationItemType.LINK,
        text: LL.VIEW.GOVERNANCE.nav(),
        href: '/governance',
      },
      {
        type: SideNavigationItemType.LINK,
        text: LL.VIEW.GROUP.nav(),
        href: '/groups',
      },
      {
        type: SideNavigationItemType.LINK,
        text: LL.VIEW.USER.nav(),
        href: '/users',
      },
    ];

    if (isAdmin) {
      items.push({
        type: SideNavigationItemType.DIVIDER,
      });
      items.push({
        type: SideNavigationItemType.SECTION,
        text: LL.VIEW.ADMIN.nav(),
        expanded: true,
        items: [
          {
            type: SideNavigationItemType.LINK,
            text: LL.VIEW.IDENTITY_PROVIDER.nav(),
            href: '/admin/identity/provider',
          },
          {
            type: SideNavigationItemType.LINK,
            text: LL.VIEW.COST.nav(),
            href: '/admin/cost',
          },
          ...(isRootAdmin
            ? [
              {
                type: SideNavigationItemType.DIVIDER,
              },
              {
                type: SideNavigationItemType.LINK,
                text: LL.VIEW.ADMIN.Teardown.nav(),
                href: '/admin/teardown',
              },
            ]
            : []),
        ],
      });
    }

    return items;
  }, [isAdmin]);

  return (
    <AppLayout
      header={
        <Header
          title={LL.CONST.APP_NAME()}
          search={<GlobalSearch />}
          rightContent={
            <Inline>
              <PersistentNotifications />
              <LoggedUserMenu />
            </Inline>
          }
        />
      }
      breadcrumbs={<BreadcrumbGroup />}
      navigation={
        // TODO: implement mini-drawer to match UX https://v4.mui.com/components/drawers/#mini-variant-drawer
        <SideNavigation header={{ href: '/', text: <HomeIcon /> }} items={navItems} />
      }
    >
      <ManagedHelpPanel
        header="Help"
      >
        {import('@ada/strings/markdown/view/help.md')}
      </ManagedHelpPanel>
      <Switch>
        {/* Force users that don't belong to any default groups to public landing page */}
        {hasNoAccess && <Route component={Public.Router} />}

        <Redirect exact path="/" to="/data-product" />

        <Route path="/profile" component={User.DetailView} />

        <Route path="/data-product" component={DataProduct.Router} />
        <Route path="/groups" component={Group.Router} />
        <Route path="/users" component={User.Router} />
        <Route path="/governance" component={Ontology.Router} />

        <Route path="/query" component={Query.RootView} />

        {isAdmin && <Route path="/admin" component={Admin.Router} />}

        {ENV_DEVELOPMENT && <Route path="/dev/api-hooks" component={ApiHookDev} />}
        {ENV_DEVELOPMENT && <Route path="/dev/transforms" component={TransformBuilder} />}

        {/* Redirect to root as fallback */}
        <Redirect to="/" />
      </Switch>

      <RootAdminNotification />
    </AppLayout>
  );
};
