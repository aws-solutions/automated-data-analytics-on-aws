/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  Alert,
  Button,
  Container,
  Heading,
  Inline,
  LoadingIndicator,
  StatusIndicator,
  Text,
  Theme,
  makeStyles,
} from 'aws-northstar';
import { BuiltInTransforms } from '@ada/transforms';
import { Card, CardContent, CardHeader, CardProps, IconButton } from '@material-ui/core';
import { CustomTransformDialog, CustomTransformDialogProps } from '../CustomTransformDialog';
import { CustomTransformScript, FormData, formDataToDataProduct } from '../../../../utils';
import { DataProductPreview, DataProductTransform, Script, ScriptIdentifier } from '@ada/api';
import {
  DragDropContext,
  DragDropContextProps,
  Draggable,
  DraggableProvided,
  DraggableStateSnapshot,
  Droppable,
} from 'react-beautiful-dnd';
import {
  DraggableLibraryScript,
  DraggableResolvedTransform,
  LibraryScript,
  ResolvedTransform,
  TDraggable,
  TransformPlan,
} from '../../types';
import { FieldInputProps } from 'react-final-form';
import { ReservedDomains } from '@ada/common';
import { SchemaRenderer } from '$views/data-product/components/schema/SchemaRenderer';
import { TransformArgsDialog, TransformArgsDialogProps } from '../TransformArgsDialog';
import { TransformPlannerContextProvider, useTransformPlannerContext } from '../../context';
import { createStyles } from '@material-ui/core/styles';
import { debounce, isEmpty, sortBy } from 'lodash';
import { isDataEqual } from '$common/utils';
import { nanoid } from 'nanoid';
import { previewDataProductUntilComplete } from '$api/data-product';
import { useI18nContext } from '$strings';
import { useImmer } from 'use-immer';
import DeleteIcon from '@material-ui/icons/Delete';
import DownArrowIcon from '@material-ui/icons/ExpandMore';
import DragIcon from '@material-ui/icons/PanTool';
import EditIcon from '@material-ui/icons/Edit';
import InputIcon from '@material-ui/icons/Input';
import NewIcon from '@material-ui/icons/NewReleases';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import SettingsIcon from '@material-ui/icons/Settings';
import Timeline from '@material-ui/lab/Timeline';
import TimelineConnector from '@material-ui/lab/TimelineConnector';
import TimelineContent from '@material-ui/lab/TimelineContent';
import TimelineItem from '@material-ui/lab/TimelineItem';
import TimelineSeparator from '@material-ui/lab/TimelineSeparator';
import TransformIcon from '@material-ui/icons/Transform';
import Truncate from 'react-truncate';
import clsx from 'clsx';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

const uuid = () => nanoid(10);

function isCustomTransformScript(item: any): item is CustomTransformScript {
  return !isEmpty(item.inlineScriptContent) || !isEmpty(item.script?.inlineScriptContent);
}

function isScriptEditable(script: Script | ResolvedTransform): boolean {
  if ('script' in script) {
    return script.script.inputSchema != null;
  } else {
    return script.inputSchema != null;
  }
}

function toDraggable<T>(item: T, draggableId: string): T & TDraggable {
  return {
    ...item,
    draggableId,
  };
}

function toDraggableScript<T extends LibraryScript | CustomTransformScript>(
  item: T,
  draggableId: string,
): T & TDraggable {
  return toDraggable(item, draggableId);
}

function toDraggableTransform<T extends ResolvedTransform>(item: T, draggableId: string = uuid()): T & TDraggable {
  return toDraggable(item, draggableId);
}

enum DroppableListId {
  LIBRARY = 'library',
  TRANSFORMS = 'transforms',
}

export interface TransformBuilderProps {
  scripts: Script[];
  data: FormData;
  input: FieldInputProps<any, HTMLElement>;
}

export const TransformBuilder: React.FC<TransformBuilderProps> = (props) => {
  const { inferredSchema, transformedSchema } = props.data;

  if (inferredSchema == null) throw new Error('TransformBuilder requires `inferredSchema` to be defined.');

  return (
    <TransformPlannerContextProvider sourceSchema={inferredSchema} transformedSchema={transformedSchema}>
      <BaseTransformBuilder {...props} />
    </TransformPlannerContextProvider>
  );
};

// https://codesandbox.io/s/react-beautiful-dnd-copy-and-drag-5trm0?file=/index.js:0-12054
export const BaseTransformBuilder: React.FC<TransformBuilderProps> = (props) => {
  const { LL } = useI18nContext();
  const { transformPlan, updateTransformPlan } = useTransformPlannerContext();
  const { change } = useFormApi();
  const formData = props.data;
  const { skipPreview } = formData;

  // scripts available in global and domain from api
  const storedScripts = useMemo<Script[]>(() => {
    return (props.scripts || []).filter((script) => {
      return script.namespace === ReservedDomains.GLOBAL || script.namespace === formData.domainId;
    });
  }, [JSON.stringify(props.scripts), formData.domainId]);
  const [customTransforms, updateCustomTransforms] = useImmer<Record<string, CustomTransformScript>>(
    formData.customTransforms || {},
  );
  useEffect(() => {
    // keep custom transforms in sync between comp and form
    if (!isDataEqual(customTransforms, formData.customTransforms)) {
      change('customTransforms', customTransforms);
    }
  }, [customTransforms, formData.customTransforms]);

  const resolveTransform = useCallback(
    (transform: DataProductTransform): DraggableResolvedTransform => {
      const id = `${transform.namespace}.${transform.scriptId}`;
      const script = storedScripts.find((s) => id === `${s.namespace}.${s.scriptId}`);
      if (script) {
        return toDraggableTransform({ ...transform, script });
      }
      const customScript = customTransforms[id];
      if (customScript) {
        return toDraggableTransform({ ...transform, script: customScript });
      }
      throw new Error(`No script available for id ${id}`);
    },
    [storedScripts, customTransforms],
  );
  const originalTransformPlan = useMemo<TransformPlan>(() => {
    return (formData.transformedSchema?.transforms || formData.inferredSchema?.transforms || []).map(resolveTransform);
  }, []);
  useLayoutEffect(() => {
    updateTransformPlan(originalTransformPlan);
  }, [originalTransformPlan]);

  const scriptLibrary = useMemo<Record<string, DraggableLibraryScript>>(() => {
    const library: Record<string, DraggableLibraryScript> = {};
    storedScripts.forEach((script) => {
      const draggable = toDraggableScript(script, `${script.namespace}.${script.scriptId}`);
      library[draggable.draggableId] = draggable;
    });
    Object.values(customTransforms).forEach((customScript) => {
      const draggable = toDraggableScript(customScript, `${customScript.namespace}.${customScript.scriptId}`);
      library[draggable.draggableId] = draggable;
    });
    return library;
  }, [storedScripts, customTransforms]);

  const groupedScripts = useMemo<{
    builtin: DraggableLibraryScript[];
    shared: DraggableLibraryScript[];
    custom: DraggableLibraryScript[];
  }>(() => {
    const builtin: DraggableLibraryScript[] = [];
    const shared: DraggableLibraryScript[] = [];
    const custom: DraggableLibraryScript[] = [];

    sortBy(Object.values(scriptLibrary), 'name').forEach((script) => {
      if (isCustomTransformScript(script)) {
        custom.push(script);
      } else if (script.namespace === ReservedDomains.GLOBAL) {
        builtin.push(script);
      } else {
        shared.push(script);
      }
    });

    return {
      builtin,
      shared,
      custom,
    };
  }, [scriptLibrary]);

  const onDragEnd = useCallback<DragDropContextProps['onDragEnd']>(
    (result) => {
      const { source, destination, draggableId } = result;

      // dropped outside the list
      if (!destination) {
        return;
      }

      switch (source.droppableId) {
        case destination.droppableId: {
          // reorder within transforms
          updateTransformPlan((draft) => {
            const [item] = draft.splice(source.index, 1);
            draft.splice(destination.index, 0, item);
          });
          break;
        }
        case DroppableListId.LIBRARY: {
          // todo: popup input params dialog if not set
          const script = scriptLibrary[draggableId];
          const supportsInputArgs = !isEmpty(script.inputSchema);
          const transform = toDraggableTransform({
            script,
            namespace: script.namespace,
            scriptId: script.scriptId,
            inputArgs: supportsInputArgs ? {} : undefined,
          } as ResolvedTransform);

          // open input arg dialog when transform requires inputs
          if (supportsInputArgs) {
            setTransformArgsBeingEdited([destination.index, transform]);
          } else {
            // clone from library to transforms with new draggableId
            updateTransformPlan((draft) => {
              // wrap in toDraggable to get new uuid
              draft.splice(destination.index, 0, transform);
            });
          }
          break;
        }
      }
    },
    [updateTransformPlan, scriptLibrary],
  );

  const onRemoveHandler = useCallback(
    (index: number) => {
      // remove script from transforms
      updateTransformPlan((draft) => {
        draft.splice(index, 1);
      });
    },
    [updateTransformPlan],
  );

  const [customTransformBeingEdited, setCustomTransformBeingEdited] = useState<Partial<CustomTransformScript>>();
  const onCancelCustomTransform = useCallback<CustomTransformDialogProps['onCancel']>(() => {
    setCustomTransformBeingEdited(undefined);
  }, []);
  const onSaveCustomTransform = useCallback<CustomTransformDialogProps['onSave']>(
    (customScript) => {
      const id = `${customScript.namespace}.${customScript.scriptId}`;

      updateCustomTransforms((draft) => {
        draft[id] = customScript;
      });
      setCustomTransformBeingEdited(undefined);

      // If new custom transform, auto add to end of transform plan
      if (id in customTransforms === false) {
        updateTransformPlan((draft) => {
          draft.push(
            toDraggableTransform({
              namespace: customScript.namespace,
              scriptId: customScript.scriptId,
              script: customScript,
            }),
          );
        });
      }
    },
    [customTransforms, updateCustomTransforms, updateTransformPlan],
  );
  const onDeleteCustomTransform = useCallback(
    (transform: ScriptIdentifier) => {
      const id = `${transform.namespace}.${transform.scriptId}`;
      // remove all instances from transform plan
      updateTransformPlan((draft) => {
        return draft.filter((t) => !(t.namespace === transform.namespace && t.scriptId === transform.scriptId));
      });
      // remove the custom transform from library
      updateCustomTransforms((draft) => {
        delete draft[id];
      });
      setCustomTransformBeingEdited(undefined);
    },
    [updateCustomTransforms, updateTransformPlan],
  );

  const [transformArgsBeingEdited, setTransformArgsBeingEdited] =
    useState<[index: number, transform: DraggableResolvedTransform]>();
  const onSaveInputArgs = useCallback<TransformArgsDialogProps['onSave']>(
    (index, transform) => {
      updateTransformPlan((draft) => {
        if (draft[index]?.draggableId === transform.draggableId) {
          // replace/update
          draft[index] = transform;
        } else {
          // insert/new
          draft.splice(index, 0, transform);
        }
      });

      setTransformArgsBeingEdited(undefined);
    },
    [updateTransformPlan],
  );
  const onCancelInputArgs = useCallback<TransformArgsDialogProps['onCancel']>(() => {
    setTransformArgsBeingEdited(undefined);
  }, []);

  // PREVIEW
  const [preview, setPreview] = useState<DataProductPreview | undefined>(
    formData.transformedSchema?.preview || formData.inferredSchema?.preview,
  );
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<Error>();
  const generatePreviewInvocationRef = useRef<number>(0);
  const generateSchemaPreview = useMemo(() => {
    return debounce(
      async (_formData: FormData) => {
        const _generatePreviewInvocation = generatePreviewInvocationRef.current;

        try {
          setIsGeneratingPreview(true);

          const transforms = transformPlan.map((transform) => {
            const { namespace, scriptId, inlineScriptContent, script, inputArgs } = transform;
            return {
              namespace,
              scriptId,
              inlineScriptContent: inlineScriptContent || (script as CustomTransformScript).inlineScriptContent,
              inputArgs,
            };
          });

          const dataProduct = formDataToDataProduct(_formData);

          const fetchedPreview = await previewDataProductUntilComplete(
            {
              ...dataProduct,
              transforms,
            },
            false,
          );
          if (fetchedPreview.error) {
            throw fetchedPreview.error;
          }
          setPreviewError(undefined);
          setPreview(fetchedPreview);

          change(
            'transformedSchema' as keyof FormData,
            {
              preview: fetchedPreview,
              transforms, // use plan instead of returned to preserve inline source to indicate custom
              // Keep track of the source details for the data product for which we ran the preview
              sourceDetails: dataProduct.sourceDetails,
            } as FormData['transformedSchema'],
          );
        } catch (error: any) {
          setPreviewError(error);
          setPreview(undefined);
        } finally {
          // only set to generating false if current generation is from current callback invocation
          if (_generatePreviewInvocation === generatePreviewInvocationRef.current) {
            setIsGeneratingPreview(false);
          }
        }
      },
      1250,
      { leading: false, trailing: true },
    );
  }, [change, transformPlan]);
  const [isInitialPreview, setIsInitialPreview] = useState(true);
  useEffect(() => {
    // ignore initial preview as we get from inferred
    if (transformPlan && !(isInitialPreview && isDataEqual(transformPlan, originalTransformPlan))) {
      setIsInitialPreview(false);
      setIsGeneratingPreview(true); // generate is throttle, but we want to indicate to ui right away
      generatePreviewInvocationRef.current = Date.now();
      generateSchemaPreview(formData);
    }
  }, [isInitialPreview, transformPlan, originalTransformPlan]);

  const classes = useStyles();

  return (
    <Container title={LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.title()} gutters={false}>
      <div className={classes.root}>
        <DragDropContext onDragEnd={onDragEnd}>
          {/* LEFT - LIBRARY */}
          <div data-testid="transform-library" className={classes.leftColumn}>
            <Text variant="small">{LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.LIBRARY.hintText()}</Text>
            <Droppable droppableId={DroppableListId.LIBRARY} isDropDisabled>
              {(provided, snapshot) => {
                let index = 0;

                return (
                  <div
                    ref={provided.innerRef}
                    className={clsx(classes.scripsList, snapshot.isDraggingOver ? classes.isDragging : null)}
                  >
                    {/* BUILT-IN */}
                    <Heading variant="h4">{LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.LIBRARY.BUILT_IN.header()}</Heading>
                    {groupedScripts.builtin.map((script) => {
                      return (
                        <Draggable key={script.draggableId} draggableId={script.draggableId} index={index++}>
                          {(_provided, _snapshot) => (
                            <DraggableLibraryScriptItem script={script} provided={_provided} snapshot={_snapshot} />
                          )}
                        </Draggable>
                      );
                    })}

                    {/* SHARED - DOMAIN */}
                    {!isEmpty(groupedScripts.shared) && (
                      <>
                        <Heading variant="h4">{LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.LIBRARY.SHARED.header()}</Heading>
                        {groupedScripts.shared.map((script) => {
                          return (
                            <Draggable key={script.draggableId} draggableId={script.draggableId} index={index++}>
                              {(_provided, _snapshot) => (
                                <DraggableLibraryScriptItem script={script} provided={_provided} snapshot={_snapshot} />
                              )}
                            </Draggable>
                          );
                        })}
                      </>
                    )}

                    {/* NEW CUSTOM */}
                    {!isEmpty(groupedScripts.custom) && (
                      <>
                        <Heading variant="h4">{LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.LIBRARY.NEW.header()}</Heading>
                        {groupedScripts.custom.map((script) => {
                          return (
                            <Draggable key={script.draggableId} draggableId={script.draggableId} index={index++}>
                              {(_provided, _snapshot) => (
                                <DraggableLibraryScriptItem
                                  script={script}
                                  provided={_provided}
                                  snapshot={_snapshot}
                                  onEditCustom={() => setCustomTransformBeingEdited(script as CustomTransformScript)}
                                  onDelete={() => onDeleteCustomTransform(script as CustomTransformScript)}
                                />
                              )}
                            </Draggable>
                          );
                        })}
                      </>
                    )}

                    {provided.placeholder}
                  </div>
                );
              }}
            </Droppable>

            <div className={classes.columnFooter}>
              <Button icon="add_plus" onClick={() => setCustomTransformBeingEdited({ namespace: formData.domainId })}>
                {LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.LIBRARY.NEW.createButtonText()}
              </Button>
            </div>
          </div>

          {/* CENTER - TRANSFORMS */}
          <div data-testid="transform-plan" className={classes.centerColumn}>
            <Droppable droppableId={DroppableListId.TRANSFORMS}>
              {(provided, snapshot) => (
                <Timeline
                  ref={provided.innerRef}
                  className={clsx(classes.transformsList, snapshot.isDraggingOver ? 'isDraggingOver' : null)}
                  align="right"
                >
                  <StaticItem icon={<InputIcon fontSize="small" />} title={LL.ENTITY.Schema_.source()} />

                  {transformPlan.map((item, index) => {
                    return (
                      <Draggable key={item.draggableId} draggableId={item.draggableId} index={index}>
                        {(_provided, _snapshot) => (
                          <TimelineItem>
                            <TimelineSeparator>
                              <TransformCard
                                innerRef={_provided.innerRef}
                                {..._provided.draggableProps}
                                {..._provided.dragHandleProps}
                                style={_provided.draggableProps.style}
                                isDragging={_snapshot.isDragging}
                                transform={item}
                                onRemove={() => onRemoveHandler(index)}
                                onEdit={
                                  isScriptEditable(item) ? () => setTransformArgsBeingEdited([index, item]) : undefined
                                }
                              />
                              {_snapshot.isDragging && <TransformCard isClone transform={item} />}
                              <div />
                              <Connector />
                            </TimelineSeparator>
                            <TimelineContent />
                          </TimelineItem>
                        )}
                      </Draggable>
                    );
                  })}

                  {provided.placeholder}

                  {!snapshot.isDraggingOver && (
                    <StaticItem
                      icon={<DragIcon fontSize="small" />}
                      title={LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.PLAN.hintText()}
                      className={classes.isDragging}
                    />
                  )}

                  <TransformStatus
                    isGenerating={isGeneratingPreview}
                    error={previewError}
                    hasPreview={preview != null}
                  />
                </Timeline>
              )}
            </Droppable>
          </div>

          {/* RIGHT - SCHEMA PREVIEW */}
          <div className={classes.rightColumn}>
            <Preview preview={preview} error={previewError} isGenerating={isGeneratingPreview} disabled={skipPreview} />
          </div>
        </DragDropContext>

        {transformArgsBeingEdited && (
          <TransformArgsDialog
            index={transformArgsBeingEdited[0]}
            transform={transformArgsBeingEdited[1]}
            onCancel={onCancelInputArgs}
            onSave={onSaveInputArgs}
          />
        )}
        {customTransformBeingEdited && (
          <CustomTransformDialog
            transform={customTransformBeingEdited}
            onCancel={onCancelCustomTransform}
            onSave={onSaveCustomTransform}
          />
        )}
      </div>
    </Container>
  );
};

const Preview: React.FC<{
  preview?: DataProductPreview;
  isGenerating?: boolean;
  error?: Error;
  disabled?: boolean;
}> = ({ preview, isGenerating, error, disabled }) => {
  const { LL } = useI18nContext();
  let content: React.ReactNode;
  if (disabled) {
    content = <Text>{LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.warning.disabled()}</Text>;
  } else if (error) {
    content = (
      <Alert type="error" dismissible={false}>
        {error.message}
      </Alert>
    );
  } else if (preview == null) {
    content = <Text>{LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.warning.notAvailable()}</Text>;
  }

  const transformedDataSets = Object.entries(preview?.transformedDataSets || {});
  const emptyPreviews = transformedDataSets.filter(([, dataSet]) => dataSet.schema?.fields?.length === 0);

  let warning: React.ReactNode;
  if (emptyPreviews.length > 0) {
    warning = (
      <Alert type="warning" dismissible={false}>
        {LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.warning.emptyResult({
          transformedDataSets: transformedDataSets.length,
          emptyPreviews: emptyPreviews.length
        })}
      </Alert>
    );
  }

  return (
    <Container
      headingVariant="h4"
      gutters={preview == null}
      title={(<Inline>{LL.ENTITY.Schema_.preview()} {isGenerating && <LoadingIndicator size="normal" />}</Inline>) as any}
      style={{opacity: isGenerating ? 0.75 : 1 }}
    >
      {warning}
      {content || <SchemaRenderer preview={preview} variant="accordion" hideSource hideParentListItem />}
    </Container>
  );
};

const DraggableLibraryScriptItem: React.FC<{
  script: DraggableLibraryScript;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  onEditCustom?: () => void;
  onDelete?: () => void;
}> = ({ script, provided, snapshot, onEditCustom, onDelete }) => {
  return (
    <>
      <LibraryScriptItem
        innerRef={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        style={provided.draggableProps.style}
        isDragging={snapshot.isDragging}
        script={script}
        onEditCustom={onEditCustom}
        onDelete={onDelete}
      />

      {snapshot.isDragging && <LibraryScriptItem script={script} isClone />}
    </>
  );
};

const LibraryScriptItem: React.FC<
  {
    script: DraggableLibraryScript;
    isDragging?: boolean;
    isClone?: boolean;
    onEditCustom?: () => void;
    onDelete?: () => void;
  } & CardProps
> = ({ script, isDragging, isClone, onEditCustom, onDelete, ...props }) => {
  const classes = useStyles();
  const isCustom = isCustomTransformScript(script);

  return (
    <Card
      {...props}
      className={clsx(
        classes.libraryScript,
        isDragging ? classes.isDragging : null,
        isClone ? classes.isClone : null,
        props.className,
      )}
    >
      <CardHeader
        avatar={isCustom ? <NewIcon fontSize="small" /> : <TransformIcon fontSize="small" />}
        action={
          isCustom && (
            <Inline spacing="xs" align-self="center">
              {onEditCustom && (
                <Button variant="icon" icon={EditIcon} label="edit" size="small" onClick={onEditCustom} />
              )}
              {onDelete && <Button variant="icon" icon={DeleteIcon} label="delete" size="small" onClick={onDelete} />}
            </Inline>
          )
        }
        title={script.name}
        subheader={script.description && <Truncate lines={1}>{script.description}</Truncate>}
      />
    </Card>
  );
};

const TransformCard: React.FC<
  {
    transform: DraggableResolvedTransform;
    onRemove?: () => void;
    onEdit?: () => void;
    isDragging?: boolean;
    isClone?: boolean;
  } & CardProps
> = ({ transform, onRemove, onEdit, isDragging, isClone, ...props }) => {
  const { LL } = useI18nContext();
  const classes = useStyles();
  const isCustom = isCustomTransformScript(transform);
  const removeButtonRef = useRef<HTMLElement>();
  const isJsonRelationalize = transform.script.scriptId === BuiltInTransforms.ada_json_relationalise.id;

  const actions = useMemo<React.ReactNode>(() => {
    if (!onRemove) return;
    return (
      <Inline spacing="xs">
        <IconButton innerRef={removeButtonRef} size="small" onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Inline>
    );
  }, [onEdit, onRemove]);

  const onMouseUp = useCallback<React.MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (!onEdit) return;
      const isRemoveAction =
        removeButtonRef.current != null &&
        (event.target === removeButtonRef.current || removeButtonRef.current.contains(event.target as Element));
      if (!isDragging && !isRemoveAction) {
        onEdit();
      }
    },
    [removeButtonRef, isDragging, onEdit],
  );

  return (
    <Card
      {...props}
      className={clsx(
        classes.transformCard,
        isDragging ? classes.isDragging : null,
        isClone ? classes.isClone : null,
        props.className,
      )}
      onMouseUp={onMouseUp}
    >
      <CardHeader
        avatar={isCustom ? <NewIcon fontSize="small" /> : <TransformIcon fontSize="small" />}
        action={actions}
        title={
          <>
            {transform.script.name} {onEdit && <SettingsIcon fontSize="small" />}
          </>
        }
      />
      {isJsonRelationalize && (
        <CardContent>
          <Alert type="info">
            {LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.warning.jsonRelationalize()}
          </Alert>
        </CardContent>
      )}
    </Card>
  );
};

const StaticItem: React.FC<{
  icon?: React.ReactNode;
  title: React.ReactNode;
  action?: React.ReactNode;
  noConnector?: boolean;
  className?: string;
}> = ({ icon, title, action, noConnector, className }) => {
  const classes = useStyles();

  return (
    <TimelineItem>
      <TimelineSeparator>
        <Card className={clsx(classes.transformCard, 'isStatic', className)}>
          <CardHeader avatar={icon} title={title} action={action} />
        </Card>
        {!noConnector && <Connector />}
      </TimelineSeparator>
      <TimelineContent />
    </TimelineItem>
  );
};

const Connector: React.FC = () => {
  const classes = useStyles();

  return (
    <>
      <TimelineConnector className={classes.connector} />
      <DownArrowIcon className={classes.connectorArrow} />
    </>
  );
};

const TransformStatus: React.FC<{ isGenerating: boolean; error?: Error; hasPreview: boolean }> = ({
  isGenerating,
  error,
  hasPreview,
}) => {
  const { LL } = useI18nContext();
  const classes = useStyles();

  const status = useMemo<React.ReactNode>(() => {
    if (isGenerating) {
      return (
        <StatusIndicator statusType="info">
          <LoadingIndicator label={LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.status.generating()} />
        </StatusIndicator>
      );
    }
    if (error) {
      return (
        <StatusIndicator statusType="negative">
          {LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.status.failed()}
        </StatusIndicator>
      );
    }
    if (hasPreview) {
      return <StatusIndicator statusType="positive">{LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.status.success()}</StatusIndicator>;
    }

    return <StatusIndicator statusType="warning">{LL.VIEW.DATA_PRODUCT.Wizard.TransformPlanner.status.notAvailable()}</StatusIndicator>;
  }, [isGenerating, error, hasPreview]);

  return (
    <TimelineItem>
      <TimelineSeparator>
        <Card className={clsx(classes.resultCard)}>
          <CardContent>{status}</CardContent>
        </Card>
      </TimelineSeparator>
      <TimelineContent />
    </TimelineItem>
  );
};

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'stretch',
    },
    // COLUMNS
    leftColumn: {
      flex: 0.25,
      background: theme.palette.background.default,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(1),
    },

    centerColumn: {
      flex: 0.5,
      minWidth: 0,
      background: theme.palette.background.paper,
    },
    rightColumn: {
      flex: 0.25,
      minWidth: 0,
      background: theme.palette.background.default,
    },
    columnFooter: {
      flex: 0,
      padding: '10px 6px',
      alignSelf: 'flex-end',
      minHeight: `50px !important`,
    },

    // LIBRARY
    scripsList: {
      flex: 1,
      minHeight: 0,
      // overflow: 'auto',
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(4),
    },

    // TRANSFORMS
    transformsList: {
      margin: '0.5rem 0.5rem 1.5rem',
      minHeight: 50,
    },

    transformCard: {
      width: 300,
      // height: 70,
      '&.isStatic': {
        userSelect: 'none',
        opacity: 0.4,
        height: 55,
      },
    },

    resultCard: {
      width: 300,
      background: theme.palette.background.default,
    },

    libraryScript: {
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),

      '& .MuiCardHeader-root': {
        padding: theme.spacing(0.5),

        '& .MuiCardHeader-action': {
          margin: 0,
        },
      },
    },

    connector: {
      height: 20,
      marginTop: 6,
    },
    connectorArrow: {
      color: theme.palette.grey[400],
      marginTop: -10,
    },

    // States

    isClone: {
      '& div': {
        display: 'none !important',
      },
    },

    isDragging: {
      border: '1px dashed #4099ff',
    },

    // Utils
    rotate180: {
      transform: 'rotate(180deg)',
    },
  }),
);
