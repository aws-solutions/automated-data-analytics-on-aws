/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/* eslint-disable */
// TODO: temporarily disable linting on this file and need to revisit again later

export type UnionToTuple<T> = (
  (T extends any ? (t: T) => T : never) extends infer U
    ? (U extends any ? (u: U) => any : never) extends (v: infer V) => any
      ? V
      : never
    : never
) extends (_: any) => infer W
  ? [...UnionToTuple<Exclude<T, W>>, W]
  : [];

export type Optional<T, K extends keyof T> = Omit<T, K> & Pick<Partial<T>, K>;

export type ShiftTuple<T extends [...any[]]> = T extends [never]
  ? never
  : T extends [any]
  ? []
  : T extends [any, ...infer Tail]
  ? Tail
  : never;

export type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T;

export type DeepPartial<T> = T extends Function ? T : T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type MutableArray<T extends any[]> = T extends ReadonlyArray<infer A> ? [A] : T;

// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html#recursive-conditional-types
export type DeepFlattenArray<T> = T extends ReadonlyArray<infer U> ? DeepFlattenArray<U> : T;

export type Pluralize<T extends string> = T extends `${string}s`
  ? LowerCase<T> extends 'lens' ? `${T}es` :
  ? T extends `${infer S}sus`
    ? `${S}s`
    : T
  : T extends `${infer S}y`
  ? `${S}ies`
  : T extends string
  ? `${T}s`
  : T;
// type TEST_Pluralize_s = Pluralize<'products'>
// type TEST_Pluralize_us = Pluralize<'status'>
// type TEST_Pluralize_y = Pluralize<'ontology'>

export type Singularize<T extends string> = T extends `${string}s`
  ? T extends `${infer S}ies`
    ? `${S}y`
    : T extends `${infer S}ses`
    ? `${S}s`
    : T extends `${infer S}us`
    ? T
    : T extends `${infer S}s`
    ? S
    : T
  : T;
// type TEST_Singularize_us = Singularize<'status'>
// type TEST_Singularize_uses = Singularize<'statuses'>
// type TEST_Singularize_s = Singularize<'products'>
// type TEST_Singularize_ies = Singularize<'ontologies'>

export type PartialTuple<T> = {
  [P in keyof T]: T[P] extends object ? Partial<T[P]> : T[P];
};
