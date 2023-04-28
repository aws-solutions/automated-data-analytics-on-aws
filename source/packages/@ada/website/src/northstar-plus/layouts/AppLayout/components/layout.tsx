/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Updater, useImmer } from 'use-immer';
import { getSolutionPersistenceKey } from '$config';
import { useTheme } from '@material-ui/core';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import useLocalStorage from 'react-use-localstorage';
import useMediaQuery from '@material-ui/core/useMediaQuery';

/* eslint-disable @typescript-eslint/no-unused-vars */

const LOCAL_STORAGE_LAYOUT_KEY = getSolutionPersistenceKey('AppLayout.layout.state', false);

/**
 * Layout states
 * * `true` = fully visible
 * * `false` = collapsed/hidden state
 * * `null` = not rendered at all
 */
export type LayoutState = boolean | null;

export interface Layout {
  readonly breadcrumbs: LayoutState;
  readonly sideNavigation: LayoutState;
  readonly helpPanel: LayoutState;
  readonly splitScreen: LayoutState;
  readonly paddedContent: boolean;
}

export interface LayoutHandler {
  (current: Layout, client: ClientContext): Partial<Layout>;
}

type LayoutMap = Map<string, LayoutHandler>;

export interface ClientContext {
  fullMode: boolean;
}

export interface ILayoutContext {
  clientContext: ClientContext;

  layout: Layout;
  updateLayout: Updater<Layout>;

  layouts: LayoutMap;
  registerLayout: (name: string, layoutHandler: LayoutHandler) => void;
  setLayout: (name: LAYOUT_NAME) => void;

  contentRef?: React.MutableRefObject<HTMLDivElement | null>;
}

export const DEFAULT_LAYOUT = 'default';

export const CHROMELESS_LAYOUT = 'chromeless';

export const WIZARD_LAYOUT = 'wizard';

export type LAYOUT_NAME = typeof DEFAULT_LAYOUT | typeof CHROMELESS_LAYOUT | typeof WIZARD_LAYOUT;

export const DEFAULT_LAYOUTS: { [name: string]: LayoutHandler } = {
  [DEFAULT_LAYOUT]: (_current: Layout, _client: ClientContext) => ({
    // helpPanel: false,
    // splitScreen: null,
    breadcrumbs: true,
    sideNavigation: !!_client.fullMode,
    paddedContent: true,
  }),
  [CHROMELESS_LAYOUT]: (_current: Layout, _client: ClientContext) => ({
    helpPanel: false,
    splitScreen: null,
    breadcrumbs: null,
    sideNavigation: false,
    paddedContent: false,
  }),
  [WIZARD_LAYOUT]: (_current: Layout, _client: ClientContext) => ({
    // helpPanel: false,
    splitScreen: null,
    breadcrumbs: true,
    sideNavigation: false,
    paddedContent: true,
  }),
};

export const DEFAULT_LAYOUT_CONTEXT: ILayoutContext = {
  clientContext: {
    fullMode: true,
  },
  layout: {
    helpPanel: false,
    splitScreen: null,
    breadcrumbs: true,
    sideNavigation: true,
    paddedContent: true,
  },
  updateLayout: () => {}, //NOSONAR (S1186:Empty Function) - NOOP default
  layouts: new Map(),
  registerLayout: (_name: string, _handler: LayoutHandler) => {}, //NOSONAR (S1186:Empty Function) - NOOP default
  setLayout: (_name: string) => {}, //NOSONAR (S1186:Empty Function) - NOOP default
};

const LayoutContext = createContext<ILayoutContext>(DEFAULT_LAYOUT_CONTEXT);

export const useLayoutContext = () => {
  const context = useContext(LayoutContext);
  if (context == null) throw new Error('Must wrap with LayoutContext.Provider');
  return context;
};

export interface LayoutProviderProps {
  layouts?: { [name: string]: LayoutHandler };
}

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children, layouts: layoutsProp }) => {
  const theme = useTheme();
  const fullMode = useMediaQuery(theme.breakpoints.up('sm'));
  const clientContext = useMemo<ClientContext>(
    () => ({
      fullMode,
    }),
    [fullMode],
  );

  /* eslint-disable-next-line */
  const [layouts] = useState<LayoutMap>(() => {
    const _layouts: LayoutMap = new Map();
    const defaultLayouts = {
      ...DEFAULT_LAYOUTS,
      ...layoutsProp,
    };
    Object.entries(defaultLayouts).forEach(([name, handler]) => {
      _layouts.set(name, handler);
    });
    return _layouts;
  });

  const [persistent] = useLocalStorage(LOCAL_STORAGE_LAYOUT_KEY);
  const [layoutName, setLayoutName] = useState<string>(() =>
    persistent ? JSON.parse(persistent).name || DEFAULT_LAYOUT : DEFAULT_LAYOUT,
  );
  const [layout, updateLayout] = useImmer<Layout>(() =>
    persistent ? JSON.parse(persistent).layout || DEFAULT_LAYOUT_CONTEXT.layout : DEFAULT_LAYOUT_CONTEXT.layout,
  );

  const registerLayout = useCallback(
    (name: string, layoutHandler: LayoutHandler) => {
      layouts.set(name, layoutHandler);
    },
    [layouts],
  );

  const setLayout = useCallback(
    (name: string) => {
      if (layoutName !== name) {
        const layoutConfig = layouts.get(name);
        if (layoutConfig == null) throw new Error(`No layout registered with name "${name}"`);
        updateLayout((draft) => {
          return {
            ...draft,
            ...layoutConfig(draft, clientContext),
          };
        });
        setLayoutName(name);
      }
    },
    [layouts, clientContext, updateLayout, layoutName, setLayoutName],
  );

  const contentRef = useRef<HTMLDivElement>(null);

  // Persist state when component is unmounted
  // const stateRef = useStatefulRef({ name: layoutName, layout })
  // useEffect(() => {
  // 	return () => persist(JSON.stringify(stateRef))
  // }, [])

  const context: ILayoutContext = useMemo(
    () => ({
      clientContext,
      layout,
      updateLayout,
      layouts,
      registerLayout,
      setLayout,
      contentRef,
    }),
    [layout, updateLayout, layouts, registerLayout, setLayout],
  );

  return <LayoutContext.Provider value={context}>{children}</LayoutContext.Provider>;
};
