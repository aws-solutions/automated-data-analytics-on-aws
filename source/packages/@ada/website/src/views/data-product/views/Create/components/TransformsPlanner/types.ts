/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CustomTransformScript } from '../../utils';
import { DataProductTransform, Script } from '@ada/api';

export interface TDraggable {
  draggableId: string;
}

/** Library is the available transform scripts that can be added to the plan. */
export type LibraryScript = Script | CustomTransformScript;

export type DraggableLibraryScript = LibraryScript & TDraggable;

/** Transforms defined in the plan associates with resolved script (or custom script) */
export interface ResolvedTransform extends DataProductTransform {
  script: LibraryScript | CustomTransformScript;
}

export type DraggableResolvedTransform = ResolvedTransform & TDraggable;

export type TransformPlan = DraggableResolvedTransform[];

export type FieldSet = Set<string>;
