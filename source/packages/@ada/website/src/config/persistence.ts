/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { snakeCase } from 'lodash';
import { solutionInfo } from '@ada/common';

/** Namespace for local storage persistence */
export const SOLUTION_PERSISTENCE_NS = snakeCase(solutionInfo().name);

/** Namespace for user specific/sensitive local storage persistence */
export const SOLUTION_PERSISTENCE_USER_NS = `${SOLUTION_PERSISTENCE_NS}.USER`;

export function getSolutionPersistenceKey(name: string, sensitive: boolean): string {
  if (sensitive) {
    return `${SOLUTION_PERSISTENCE_USER_NS}.${name}`;
  }

  return `${SOLUTION_PERSISTENCE_NS}.${name}`;
}

export function setSolutionPersistenceItem(name: string, value: string, sensitive: boolean) {
  localStorage.setItem(getSolutionPersistenceKey(name, sensitive), value);
}

export function getSolutionPersistenceItem(name: string, sensitive: boolean) {
  return localStorage.getItem(getSolutionPersistenceKey(name, sensitive));
}

/**
 * Deletes all persistence keys for the solution
 */
export function clearSolutionPersistence() {
  removeLocalStorageItemByPrefix(SOLUTION_PERSISTENCE_USER_NS);
}

/**
 * Deletes all persistence that is user specificl.
 */
export function clearUserSolutionPersistence() {
  removeLocalStorageItemByPrefix(SOLUTION_PERSISTENCE_USER_NS);
}

function removeLocalStorageItemByPrefix(prefix: string) {
  if (!prefix.endsWith('.')) prefix += '.';
  Object.keys(localStorage)
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => {
      localStorage.removeItem(key);
    });
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => {
      sessionStorage.removeItem(key);
    });
}
