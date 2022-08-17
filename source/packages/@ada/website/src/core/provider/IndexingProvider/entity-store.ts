/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { EntityCacheEventEmitter } from '$api';
import { compact } from 'lodash';
import { isDataEqual } from '$common/utils/misc';
import EventEmitter from 'eventemitter3';

export interface NormalizedEntity {
  /**
   * Normalized id of the entity (DataProduct::{domainId}:{dataProductId})
   */
  __id: string;
  /**
   * Type of entity (DataProduct)
   */
  __typename: string;
  /**
   * Unique id of entity ({domainId}:{dataProductId})
   */
  __entityId: string;

  [key: string]: any;
}

export type NormalizedEntityStore = { [entity: string]: NormalizedEntity };

function normalizeId(id: string | string[]): string {
  if (Array.isArray(id)) {
    return compact(id).join(':');
  }
  return id;
}

export function normalizeEntity(typename: string, id: string | string[], entity?: any): NormalizedEntity {
  id = normalizeId(id);
  const __id = `${typename}::${id}`;
  return {
    __id,
    __typename: typename,
    __entityId: id,
    ...entity,
  } as NormalizedEntity;
}

export interface EntityStoreEvents {
  CHANGE: [entity: NormalizedEntity, action: 'SET' | 'UPDATE' | 'REMOVE'];
}

export interface EntityScoreChangeHandler {
  (...args: EntityStoreEvents['CHANGE']): void;
}

export class EntityStore extends EventEmitter<EntityStoreEvents> {
  private readonly _store: NormalizedEntityStore = {};

  constructor(private cacheEmitter: EntityCacheEventEmitter) {
    super();

    this._cacheEntitySetHandler = this._cacheEntitySetHandler.bind(this);
    this._cacheEntityRemoveHandler = this._cacheEntityRemoveHandler.bind(this);

    cacheEmitter.on('entity.SET', this._cacheEntitySetHandler);
    cacheEmitter.on('entity.REMOVED', this._cacheEntityRemoveHandler);
  }

  destroy() {
    this.removeAllListeners();
    this.cacheEmitter.off('entity.SET', this._cacheEntitySetHandler);
    this.cacheEmitter.off('entity.REMOVED', this._cacheEntityRemoveHandler);
  }

  private _cacheEntitySetHandler(type: string, id: string | string[], entity: any): void {
    // console.debug('ENTITY_STORE:SET::', type, id, entity)
    this.setEntity(normalizeEntity(type, id, entity));
  }

  private _cacheEntityRemoveHandler(type: string, id: string | string[], entity: any): void {
    // console.debug('ENTITY_STORE:REMOVE::', type, id, entity)
    this.removeEntity(normalizeEntity(type, id, entity));
  }

  getStore(): NormalizedEntityStore {
    return this._store;
  }

  getEntities(): NormalizedEntity[] {
    return Object.values(this._store);
  }

  getEntity(__id: string): NormalizedEntity | undefined {
    return this._store[__id];
  }

  /**
   * Add or replace entity in store.
   * @param typename The typename of the entity (`DataProduct`)
   * @param id The unique id of the entity (`{domainId}:{dataProductId}`)
   * @param entity The entity object
   * @returns The normalized wrapper of entity as stored.
   */
  setEntity(entity: NormalizedEntity): void {
    const current = this.getEntity(entity.__id);
    if (isDataEqual(current, entity)) {
      // no change - ignore
      return;
    }

    this._store[entity.__id] = entity;
    this.emit('CHANGE', entity, 'SET');
  }

  removeEntity(entity: NormalizedEntity) {
    const current = this.getEntity(entity.__id);
    if (current != null) {
      delete this._store[current.__id];
      this.emit('CHANGE', entity, 'REMOVE');
    }
  }
}
