/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Box, Button, Container, Inline, Paper, Stack } from 'aws-northstar';
import { ContainerProps } from 'aws-northstar/layouts/Container';
import { Divider } from '@material-ui/core';
import { HeadingStripe, HeadingStripeProps } from '..';
import { TableBaseOptions } from 'aws-northstar/components/Table';
import React from 'react';
import Skeleton, { SkeletonProps as BaseSkeletonProps } from '@material-ui/lab/Skeleton';

type SkeletonProps = Pick<BaseSkeletonProps, 'animation'>;

type SkeletonFlags<Type> = {
  [Property in keyof Type]?: Required<Type>[Property] extends string
    ? (string | boolean)
    : Required<Type>[Property] extends React.ReactNode
      ? (string | boolean)
      : boolean;
};

function renderSkelotonStringFlag(
  value: string | boolean | undefined,
  skeleton: React.ReactElement
): string | React.ReactElement | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return skeleton;
  return undefined;
}

type ActionGroupSkeletonProps = SkeletonProps & {
  /** @default 2 */
  actions?: number;
};
export const ActionGroupSkeleton: React.FC<ActionGroupSkeletonProps> = ({ actions = 2, animation }) => {
  return (
    <Inline spacing="s">
      {Array.from(Array(actions)).map((_v, i) => (
        <Button key={i}>
          <Skeleton variant="rect" width={80} style={{ opacity: 0 }} animation={animation} />
        </Button>
      ))}
    </Inline>
  );
};

type HeadingStripeSkeletonProps = SkeletonProps & SkeletonFlags<HeadingStripeProps> & { actions?: number };
export const HeadingStripeSkeleton: React.FC<HeadingStripeSkeletonProps> = ({
  title = true,
  subtitle = true,
  actionButtons = false,
  actions,
  animation,
}) => {
  return (
    <HeadingStripe
      title={renderSkelotonStringFlag(title, <Skeleton variant="text" animation={animation} />) as any}
      subtitle={renderSkelotonStringFlag(subtitle, <Skeleton variant="text" animation={animation} />)}
      actionButtons={actionButtons && <ActionGroupSkeleton actions={actions} />}
    />
  );
};

type ContainerSkeletonProps = SkeletonProps & SkeletonFlags<ContainerProps>;
export const ContainerSkeleton: React.FC<ContainerSkeletonProps> = ({
  title = true,
  subtitle = true,
  actionGroup = true,
  children,
  animation,
}) => {
  return (
    <Container
      title={renderSkelotonStringFlag(title, <Skeleton variant="text" width={200} animation={animation}/>) as any}
      subtitle={renderSkelotonStringFlag(subtitle, <Skeleton variant="text" width={300} animation={animation} />) as any}
      actionGroup={actionGroup && ((<Skeleton variant="rect" width={80} height="60%" animation={animation} />) as any)}
    >
      {children || <Skeleton variant="rect" width="100%" height={100} animation={animation} />}
    </Container>
  );
};

type TableSkeletonProps = SkeletonProps &
  SkeletonFlags<TableBaseOptions<any>> & {
    /** @default 4 */
    columns?: number;
    /** @default 7 */
    rows?: number;
    /** @default 20 */
    rowHeight?: number;
  };
export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  tableTitle = true,
  tableDescription = true,
  actionGroup = false,
  columns = 4,
  rows = 7,
  rowHeight = 20,
  animation,
}) => {
  return (
    <ContainerSkeleton title={tableTitle} subtitle={tableDescription} actionGroup={actionGroup} animation={animation}>
      <Stack spacing="xs">
        {Array.from(Array(rows)).map((_v, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'row',
              height: rowHeight,
              alignItems: 'stretch',
              justifyContent: 'stretch',
            }}
          >
            {Array.from(Array(columns)).map((_, _i) => (
              <Skeleton
                key={_i}
                variant="rect"
                height={rowHeight}
                style={{ display: 'block', flex: 1, marginRight: 4 }}
                animation={animation}
              />
            ))}
          </div>
        ))}
      </Stack>
    </ContainerSkeleton>
  );
};

type FormSkeletonProps = SkeletonProps & {
  /** @default 5 */
  fields?: number;
};
export const FormSkeleton: React.FC<FormSkeletonProps> = ({ fields = 5, animation }) => {
  return (
    <ContainerSkeleton title subtitle actionGroup={false} animation={animation}>
      <Stack>
        {Array.from(Array(fields)).map((_v, _i) => (
          <Stack key={_i} spacing="xs">
            <Skeleton variant="rect" width="30%" height={16} animation={animation} />
            <Skeleton
              variant="rect"
              width="50%"
              height={30}
              style={{ border: '1px solid lightgrey', background: 'white' }}
              animation={animation}
            />
          </Stack>
        ))}
        <Divider />
        <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <ActionGroupSkeleton actions={2} animation={animation} />
        </Box>
      </Stack>
    </ContainerSkeleton>
  );
};

type WizardSkeletonProps = SkeletonProps & {
  /** @default 3 */
  steps?: number;
  /** @default 5 */
  fields?: number;
};
export const WizardSkeleton: React.FC<WizardSkeletonProps> = ({ steps = 3, fields = 5, animation }) => {
  return (
    <Paper elevation={1} style={{ display: 'flex', flexDirection: 'row', padding: 0 }}>
      <Box style={{ flex: 0.2, padding: 10 }}>
        <Stack>
          {Array.from(Array(steps)).map((_v, _i) => (
            <Stack key={_i} spacing="xs">
              <Skeleton variant="rect" width="25%" height={16} animation={animation} />
              <Skeleton variant="rect" width="80%" height={30} animation={animation} />
              <Divider />
            </Stack>
          ))}
        </Stack>
      </Box>
      <Box style={{ flex: 1, marginBottom: -20 }}>
        <FormSkeleton fields={fields} animation={animation} />
      </Box>
    </Paper>
  );
};

type SummarySkeletonProps = SkeletonProps & {
  /** @default 2 */
  sections?: number;
};
export const SummarySkeleton: React.FC<SummarySkeletonProps> = ({ sections = 2, animation }) => {
  return (
    <Stack>
      {Array.from(Array(sections)).map((_v, _i) => (
        <ContainerSkeleton key={_i} actionGroup={false} animation={animation} />
      ))}
    </Stack>
  );
};

type PageSkeletonProps = HeadingStripeSkeletonProps & SummarySkeletonProps;
export const PageSkeleton: React.FC<PageSkeletonProps> = ({
  title,
  subtitle,
  actionButtons,
  actions,
  sections = 2,
  animation,
}) => {
  return (
    <Stack>
      <HeadingStripeSkeleton
        title={title}
        subtitle={subtitle}
        actionButtons={actionButtons}
        actions={actions}
        animation={animation}
      />

      <SummarySkeleton sections={sections} animation={animation} />
    </Stack>
  );
};

export const DetailsPageSkeleton: React.FC<PageSkeletonProps> = ({ actionButtons = true, ...props }) => {
  return <PageSkeleton {...props} actionButtons={actionButtons} />;
};

export const Skeletons = {
  Container: ContainerSkeleton,
  Table: TableSkeleton,
  Form: FormSkeleton,
  Wizard: WizardSkeleton,
  Summary: SummarySkeleton,
  ActionGroup: ActionGroupSkeleton,
  HeadingStripe: HeadingStripeSkeleton,
  Page: PageSkeleton,
  DetailsPage: DetailsPageSkeleton,
};
