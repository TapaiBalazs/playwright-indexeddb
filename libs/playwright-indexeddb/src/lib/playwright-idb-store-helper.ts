import { test } from '@playwright/test';
import { Page } from 'playwright';
import { CrudHelper } from './crud-helper';
import { MetadataHelper } from './metadata-helper';

/**
 * Store-scoped helper that exposes CRUD and metadata operations for one
 * IndexedDB object store.
 *
 * Instances are created by {@link PlaywrightIdbHelper.createObjectStore} and
 * can then be reused via {@link PlaywrightIdbHelper.getStore}.
 *
 * @example
 * ```ts
 * const playwrightIdb = new PlaywrightIdbHelper(page);
 * await playwrightIdb.init('AUTO_INCREMENT');
 * const store = await playwrightIdb.createObjectStore('store', {
 *   autoIncrement: true,
 * });
 *
 * await store.addItem('test');
 * await store.addItem('test2');
 *
 * const keys = await store.keys();
 * const values = await store.values<string>();
 * ```
 */
export class PlaywrightIdbStoreHelper {
  private readonly crud = new CrudHelper(this.page, this.databaseName, this.storeName);
  private readonly metadata = new MetadataHelper(this.page, this.databaseName, this.storeName);

  /**
   * Creates a store helper bound to a specific IndexedDB database and object
   * store.
   *
   * In normal usage this is created internally by {@link PlaywrightIdbHelper}.
   *
   * @param page Playwright page used to execute IndexedDB operations.
   * @param databaseName IndexedDB database name.
   * @param storeName IndexedDB object store name.
   */
  constructor(
    private readonly page: Page,
    private readonly databaseName: string,
    private readonly storeName: string
  ) {
  }

  /**
   * Reads one value from the object store by key.
   *
   * @typeParam T Expected value type stored under the key.
   * @param key Store key to read.
   * @returns Stored value for the given key.
   *
   * @example
   * ```ts
   * const savedForm = await playwrightIdb
   *   .getStore('user_form_store')
   *   .readItem<{
   *     firstName: string;
   *     lastName: string;
   *     country: string;
   *     city: string;
   *     address?: string;
   *     addressOptional?: string;
   *   }>('user_form');
   * ```
   */
  readItem<T>(key: string | number): Promise<T> {
    return test.step(`Read "${key}" from "${this.storeName}" ObjectStore`, () =>
      this.crud.readItem(key));
  }

  /**
   * Deletes one value from the object store by key and returns the same store
   * helper so calls can be chained.
   *
   * @param key Store key to delete.
   * @returns The current store helper.
   *
   * @example
   * ```ts
   * const keysAfterDeletion = await playwrightIdb
   *   .getStore('user_form_store')
   *   .deleteItem('user_form')
   *   .then((store) => store.keys());
   * ```
   */
  deleteItem(key: string | number): Promise<PlaywrightIdbStoreHelper> {
    return test.step(`Delete "${key}" from "${this.storeName}" ObjectStore`, () =>
      this.crud.deleteItem(key).then(() => this));
  }

  /**
   * Creates a new entry with an explicit key.
   *
   * Use this for object stores that do not rely on `autoIncrement`.
   *
   * @typeParam T Value type to store.
   * @param key Explicit key to insert.
   * @param value Value to store.
   * @returns The current store helper.
   *
   * @example
   * ```ts
   * await playwrightIdb
   *   .getStore('user_form_store')
   *   .createItem('user_form', {
   *     firstName: 'John',
   *     lastName: 'McClane',
   *     country: 'USA',
   *     city: 'New York',
   *   });
   * ```
   */
  createItem<T>(
    key: string | number,
    value: T
  ): Promise<PlaywrightIdbStoreHelper> {
    return test.step(`Create "${key}" with value "${value}" in "${this.storeName}" ObjectStore`, () =>
      this.crud.createItem(key, value).then(() => this));
  }

  /**
   * Adds a new value to an auto-increment object store.
   *
   * IndexedDB assigns the key automatically, which makes this method a good
   * fit for queue-like stores.
   *
   * @typeParam T Value type to store.
   * @param value Value to append to the object store.
   * @returns The current store helper.
   *
   * @example
   * ```ts
   * const store = playwrightIdb.getStore('store');
   *
   * await store.addItem('test');
   * await store.addItem('test2');
   * await store.addItem('1337');
   * ```
   */
  addItem<T>(value: T): Promise<PlaywrightIdbStoreHelper> {
    return test.step(`Add entry "${value}" in "${this.storeName}" ObjectStore`, () =>
      this.crud.addItem<T>(value).then(() => this));
  }

  /**
   * Replaces an existing value for a given key.
   *
   * @param key Key to update.
   * @param value Replacement value.
   * @returns The current store helper.
   *
   * @example
   * ```ts
   * const store = playwrightIdb.getStore('store');
   *
   * await store.updateItem(2, 'updated-test2');
   * ```
   */
  updateItem(
    key: string | number,
    value: unknown
  ): Promise<PlaywrightIdbStoreHelper> {
    return test.step(`Update "${key}" with value "${value}" in "${this.storeName}" ObjectStore`, () =>
      this.crud.updateItem(key, value).then(() => this));
  }

  /**
   * Lists all keys currently stored in the object store.
   *
   * This is especially useful for auto-increment stores where IndexedDB assigns
   * the keys for you.
   *
   * @returns All keys in insertion order.
   *
   * @example
   * ```ts
   * const keys = await playwrightIdb.getStore('store').keys();
   * // [1, 2, 3]
   * ```
   */
  keys(): Promise<(string | number)[]> {
    return test.step(`Retrieving all keys from ${this.storeName} ObjectStore`, () =>
      this.metadata.getKeys());
  }

  /**
   * Lists all values currently stored in the object store.
   *
   * @typeParam T Expected value type.
   * @returns All stored values in insertion order.
   *
   * @example
   * ```ts
   * const values = await playwrightIdb.getStore('store').values<string>();
   * // ['test', 'test2', '1337']
   * ```
   */
  values<T>(): Promise<T[]> {
    return test.step(`Retrieving all values from ${this.storeName} ObjectStore`, () =>
      this.metadata.getValues());
  }
}
