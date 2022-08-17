/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Badge, Container, ExpandableSection, Heading, Inline, KeyValuePair, Stack, makeStyles } from 'aws-northstar';
import { Box, createStyles } from '@material-ui/core';
import { ContainerProps } from 'aws-northstar/layouts/Container';
import { chunk, compact, isBoolean, isEmpty, isNumber, isString, startCase } from 'lodash';
import ColumnLayout, { Column } from 'aws-northstar/layouts/ColumnLayout';
import React, { useMemo, useState } from 'react';

type Primitive = string | number | boolean | null | undefined;

export type SummaryPropertyValue = React.ReactNode | Primitive | Primitive[];

export interface SummaryOptions {
  renderValue: typeof renderValue;
  renderLabel: typeof renderLabel;
  // maxColumnItems: number;
  /**
   * Number of columns for auto spreading
   * @default 2
   */
  columns: number;
  /** Indicates if potentially sensitive data is automatically masked. */
  autoMask?: boolean;
}

export interface SummaryProperty {
  label?: string;
  value?: SummaryPropertyValue;
  options?: Partial<SummaryOptions>;
}

type SummaryPropertyItem = SummaryProperty | undefined | null;

export interface SummarySection {
  title?: string;
  subtitle?: string;
  actionGroup?: ContainerProps['actionGroup'];
  properties?: SummaryPropertyItem[] | SummaryPropertyItem[][] | Record<string, React.ReactNode>;
  options?: Partial<SummaryOptions>;
  collapsible?: boolean;
  initiallyCollapsed?: boolean;
}

export interface SummaryDefinition {
  title?: string;
  subtitle?: string;
  sections: SummarySection[];
  options?: Partial<SummaryOptions>;
}

export type SummaryRendererProps = SummaryDefinition;

export const SummaryRenderer: React.FC<SummaryRendererProps> = ({ title, subtitle, sections, options, children }) => {
  const summaryOptions = useMemo<SummaryOptions>(
    () => ({
      renderValue,
      renderLabel,
      columns: 3,
      ...options,
    }),
    [options],
  );

  return (
    <Stack>
      {title && <Heading variant="h2">{title}</Heading>}
      {subtitle && <Heading variant="h5">{subtitle}</Heading>}
      {sections.map((section, index) => {
        return <SummarySectionComponent key={index} section={section} options={summaryOptions} />;
      })}
      {children}
    </Stack>
  );
};

const SummarySectionComponent: React.FC<{
  section: SummarySection;
  options: SummaryOptions;
}> = ({ section, options }) => {
  const sectionOptions = useMemo<SummaryOptions>(
    () => ({
      ...options,
      ...section.options,
    }),
    [options, section.options],
  );

  const propertyColumns = useMemo<SummaryProperty[][]>(() => {
    let properties = section.properties;
    if (properties == null) return [];
    if (!Array.isArray(properties)) {
      properties = Object.entries(properties).map(([label, value]) => ({ label, value }));
    }

    properties = compact(properties as any[]);

    if (isEmpty(properties)) return [];

    if (!Array.isArray(properties[0])) {
      const itemsPerColumn = Math.ceil(Math.max(1, properties.length) / Math.max(1, sectionOptions.columns));
      return chunk(properties as SummaryProperty[], itemsPerColumn);
    }

    return properties as SummaryProperty[][];
  }, [section, sectionOptions]);

  const classes = useStyles();

  const content = useMemo(() => {
    return (
      <Box className={classes.content}>
        <ColumnLayout>
          {compact(propertyColumns).map((columnProperties, index) => {
            return (
              <Column key={index}>
                <Stack>
                  {compact(columnProperties).map((_property, _index) => (
                    <SummaryPropertyComponent key={_index} property={_property} options={sectionOptions} />
                  ))}
                </Stack>
              </Column>
            );
          })}
        </ColumnLayout>
      </Box>
    );
  }, [propertyColumns, sectionOptions, classes]);

  const [expanded, setExpanded] = useState(section.initiallyCollapsed === false);

  if (section.collapsible) {
    return (
      <ExpandableSection
        variant="container"
        header={section.title}
        description={section.subtitle}
        expanded={expanded}
        onChange={() => setExpanded((current) => !current)}
      >
        {content}
      </ExpandableSection>
    );
  }

  return (
    <Container title={section.title} subtitle={section.subtitle} actionGroup={section.actionGroup}>
      {content}
    </Container>
  );
};

const SummaryPropertyComponent: React.FC<{
  property: SummaryProperty;
  options: SummaryOptions;
}> = ({ property, options }) => {
  const propertyOptions = useMemo<SummaryOptions>(
    () => ({
      ...options,
      ...property.options,
    }),
    [options, property.options],
  );

  const { renderLabel: _renderLabel, renderValue: _renderValue } = propertyOptions;

  if (property.label) {
    const { label } = property;
    let { value } = property;
    if (propertyOptions.autoMask !== false && SensitivePropertyPattern.test(property.label)) {
      value = '**********';
    }
    return <KeyValuePair label={_renderLabel(label)} value={_renderValue(value)} />;
  }
  return <>{_renderValue(property.value)}</>;
};

function renderLabel(label: string): string {
  return startCase(label);
}

function renderValue(value?: SummaryPropertyValue): React.ReactNode {
  if (value == null) return '-';
  if (isString(value) || isNumber(value)) return value;
  if (isBoolean(value)) return value ? 'Yes' : 'No';
  if (Array.isArray(value) && isEmpty(value)) return '-';
  if (Array.isArray(value) && isString(value[0])) {
    return (
      <Inline>
        {value.map((v, index) => (
          <Badge key={index} content={String(v)} />
        ))}
      </Inline>
    );
  }
  if (React.isValidElement(value)) {
    return <Inline>{value}</Inline>;
  }

  return <pre>{JSON.stringify(value)}</pre>;
}

const SensitivePropertyPattern = /(private|secret|password|token|api.*key)/i;

const useStyles = makeStyles(() =>
  createStyles({
    content: {
      overflowWrap: 'anywhere',
      wordWrap: 'break-word',
    },
  }),
);
