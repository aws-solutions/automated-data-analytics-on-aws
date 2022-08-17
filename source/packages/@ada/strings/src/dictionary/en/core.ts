/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export const CORE = {
	format: {
    mask: '{val:string|mask}',
    mask5: '{val:string|mask5}',
    quote: '{val?:string|quote}',
    lowercase: '{val:string|lowercase}',
    uppercase: '{val:string|uppercase}',
    startcase: '{val:string|startcase}',
    kebabcase: '{val:string|kebabcase}',
    snakecase: '{val:string|snakecase}',
    camelcase: '{val:string|camelcase}',
    entityIdentifier: '{val:string|entityIdentifier}',
    entityName: '{val:string|entityName}',
  },
} as const;
