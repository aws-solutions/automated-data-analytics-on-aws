/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { useMemo } from 'react';

/**
 * Gets resolved dom node based on id and tag name.
 * If element with id does not exist, it will be created in body and returned.
 * @param id - Id of element to find or create
 * @param tagName - Element tag name to create element when does not already exist
 * @returns
 */
export const useDomNode = <K extends keyof HTMLElementTagNameMap>(id: string, tagName: K): HTMLElementTagNameMap[K] => {
  return useMemo<HTMLElementTagNameMap[K]>(() => {
    const existing = document.getElementById(id);
    if (existing) return existing as HTMLElementTagNameMap[K];
    const el = document.createElement(tagName);
    el.setAttribute('id', id);
    document.body.appendChild(el);
    return el;
  }, [id, tagName]);
};

export const useModalRoot = (): HTMLDivElement => {
  return useDomNode('modal-root', 'div');
};
