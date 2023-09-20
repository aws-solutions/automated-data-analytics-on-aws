/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENV_DEVELOPMENT, ENV_TEST } from '$config';
import { HelpPanel, LoadingIndicator } from 'aws-northstar';
import { HelpPanelProps } from 'aws-northstar/components/HelpPanel';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { last } from 'lodash';
import { nanoid } from 'nanoid';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ReactMarkdown, { Options as ReactMarkdownOptions } from 'react-markdown';
import rehypeAddClasses from 'rehype-add-classes';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import tomorrow from 'react-syntax-highlighter/dist/cjs/styles/hljs/tomorrow';

const generateId = () => nanoid(10);

type Content = React.ReactNode;
type ManagedHelpPanelDefinition = { id: string; content: Content };
type ManagedHelpPanelStack = ManagedHelpPanelDefinition[];

interface IHelpContext {
  managedPanels: ManagedHelpPanelStack;
  activePanel: ManagedHelpPanelDefinition | undefined;
  addHelpPanel: (id: string, content: Content) => void;
  removeHelpPanel: (id: string) => void;
}

const HelpContext = createContext<IHelpContext>({
  managedPanels: [],
  activePanel: undefined,
  addHelpPanel: (id: string, content: Content) => {
    console.log('stub:addHelpPanel:', id, content);
  },
  removeHelpPanel: (id: string) => {
    console.log('stub:removeHelpPanel:', id);
  },
});

export const HelpProvider: React.FC<{}> = ({ children }) => {
  const [panelStack, setPanelStack] = useState<ManagedHelpPanelStack>([]);

  const addHelpPanel = useCallback(
    (id: string, content: Content) => {
      setPanelStack((stack) => stack.concat({ id, content }));
    },
    [setPanelStack],
  );

  const removeHelpPanel = useCallback(
    (id: string) => {
      setPanelStack((stack) => stack.filter(({ id: _id }) => _id !== id));
    },
    [setPanelStack],
  );

  const context: IHelpContext = useMemo(() => ({
    managedPanels: panelStack,
    activePanel: last(panelStack),
    addHelpPanel,
    removeHelpPanel,
  }), [
    panelStack, addHelpPanel, removeHelpPanel,
  ]);

  return <HelpContext.Provider value={context}>{children}</HelpContext.Provider>;
};

function useHelpContext() {
  return useContext(HelpContext);
}

export const ManagedHelpPanelRenderer: React.FC<{}> = () => {
  const { activePanel } = useHelpContext();

  if (activePanel == null) {
    return null;
  }

  return <>{activePanel.content}</>;
};

export interface ManagedHelpPanelProps extends HelpPanelProps {
  children: string | Promise<string> | React.ReactNode;
}

export const ManagedHelpPanel: React.FC<ManagedHelpPanelProps> = ({ children, ...props }) => {
  const [id] = useState<string>(() => generateId());
  const { addHelpPanel, removeHelpPanel } = useHelpContext();

  useEffect(() => {
    if (
      children != null &&
      (typeof children === 'string' || (typeof children === 'object' && (children as any).then != null))
    ) {
      addHelpPanel(
        id,
        <HelpPanel {...props}>
          <MarkdownRenderer>{children as string | Promise<string>}</MarkdownRenderer>
        </HelpPanel>,
      );
    } else {
      addHelpPanel(id, <HelpPanel {...props}>{children}</HelpPanel>);
    }

    return () => removeHelpPanel(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // This component never directly renders, it just adds the content to help stack which
  // shows the most contextual help (the last help)
  return null;
};

export const MarkdownRenderer: React.FC<{ children: string | Promise<string> }> = React.memo(({ children }) => {
  const [markdown, setMarkdown] = useState<string>();

  useEffect(() => {
    if (typeof children === 'string') {
      setMarkdown(children);
    } else {
      setMarkdown(undefined);
      (async () => {
        const resolved = await (children as any);
        const mdFile = resolved.default;
        if (ENV_TEST) {
          // For testing to support .md files we mock to string
          setMarkdown(mdFile);
        } else {
          const response = await fetch(mdFile);
          const responseText = await response.text();
          setMarkdown(responseText);
        }
      })();
    }
  }, [children]);

  if (markdown == null) {
    return <LoadingIndicator />;
  }

  // support hot-reloading in development
  if (ENV_DEVELOPMENT) {
    return <ReactMarkdown {...REACT_MARKDOWN_OPTIONS}>{markdown}</ReactMarkdown>;
  }

  return <PureMarkdownRenderer>{markdown}</PureMarkdownRenderer>;
});

const PureMarkdownRenderer: React.FC<{ children: string }> = React.memo(({ children }) => {
  return <ReactMarkdown {...REACT_MARKDOWN_OPTIONS}>{children}</ReactMarkdown>;
});

const REACT_MARKDOWN_OPTIONS: Omit<ReactMarkdownOptions, 'children'> = {
  linkTarget: '_blank',
  remarkPlugins: [remarkGfm],
  rehypePlugins: [
    rehypeRaw,
    [
      rehypeAddClasses,
      {
        h1: 'MuiTypography-h1',
        h2: 'MuiTypography-h2',
        h3: 'MuiTypography-h3',
        h4: 'MuiTypography-h4',
        h5: 'MuiTypography-h5',
        h6: 'MuiTypography-h6',
        a: 'MuiTypography-colorPrimary',
      },
    ],
  ],
  className: 'MuiTypography-root',
  components: {
    /* eslint-disable */
    h1: ({ node: _node, ...props }) => <h1 {...props} />,
    code({ node: _node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          children={String(children).replace(/\n$/, '')}
          style={tomorrow as any}
          language={match[1]}
          PreTag="div"
          {...props}
        />
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    /* eslint-enable */
  },
};
