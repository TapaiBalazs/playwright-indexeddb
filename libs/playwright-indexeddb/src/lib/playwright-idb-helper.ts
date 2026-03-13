import { test } from '@playwright/test';
import { Page } from 'playwright';
import { PlaywrightIdbStoreHelper } from './playwright-idb-store-helper';

/**
 * High-level Playwright helper for opening an IndexedDB database and creating
 * object store helpers for test assertions and setup.
 *
 * Call {@link init} after navigating to a page, then create or fetch stores
 * through {@link createObjectStore} and {@link getStore}.
 *
 * @example
 * ```ts
 * import { PlaywrightIdbHelper } from '@btapai/playwright-indexeddb';
 *
 * const page = await browser.newPage();
 * await page.goto('/');
 *
 * const playwrightIdb = new PlaywrightIdbHelper(page);
 * await playwrightIdb.init('FORM_CACHE');
 * await playwrightIdb.createObjectStore('user_form_store');
 *
 * const formStore = playwrightIdb.getStore('user_form_store');
 * await formStore.createItem('user_form', {
 *   firstName: 'John',
 *   lastName: 'McClane',
 *   country: 'USA',
 *   city: 'New York',
 * });
 * ```
 */
export class PlaywrightIdbHelper {
  private databaseName?: string;
  private databaseVersion?: number;

  private storeHelpers: Map<string, PlaywrightIdbStoreHelper> = new Map();

  /**
   * Creates a helper that operates on the given Playwright page.
   *
   * The page must already be navigated to a document where `window.indexedDB`
   * is available before calling {@link init}.
   *
   * @param page Playwright page that hosts the IndexedDB instance.
   */
  constructor(private readonly page: Page) {}

  /**
   * Opens an IndexedDB database in the browser context and stores its resolved
   * name and version for later object store operations.
   *
   * Use this once per helper instance before creating or reading object stores.
   *
   * @param database IndexedDB database name.
   * @param versionConfiguredByUser Optional explicit database version.
   * @throws Error when the helper has already been initialized.
   *
   * @example
   * ```ts
   * await page.goto('/playwright-indexeddb/auto-increment');
   *
   * const playwrightIdb = new PlaywrightIdbHelper(page);
   * await playwrightIdb.init('AUTO_INCREMENT');
   * ```
   */
  async init(
    database: string,
    versionConfiguredByUser?: number
  ): Promise<void> {
    if (this.databaseName && this.databaseVersion) {
      throw new Error(
        `IDB "${this.databaseName}" with ${this.databaseVersion} has already been initialised.`
      );
    }

    const { databaseName, databaseVersion } =
      await test.step(`Initialise IndexedDB with name ${database} and version ${
        versionConfiguredByUser || 1
      }`, async () => {
        return this.page.evaluate(
          async ({ db, version }) => {
            if (!window.indexedDB) {
              throw new Error(
                `You must open the page first by using 'page.goto()' to be able to interact with indexedDb`
              );
            }
            const request: IDBOpenDBRequest =
              version != null
                ? window.indexedDB.open(db, version)
                : window.indexedDB.open(db);
            const newDbInstance = await new Promise<IDBDatabase>(
              (resolve, reject) => {
                request.onerror = (e: Event) => {
                  reject(e);
                };
                request.onsuccess = (e: Event) => {
                  request.onerror = () => void 0;
                  const newDatabase = (e.target as any).result as IDBDatabase;
                  newDatabase.onversionchange = () => void 0;
                  resolve(newDatabase);
                };
              }
            );

            newDbInstance.close();

            return {
              databaseName: newDbInstance.name,
              databaseVersion: newDbInstance.version,
            };
          },
          {
            db: database,
            version: versionConfiguredByUser,
          }
        );
      });

    this.databaseName = databaseName;
    this.databaseVersion = databaseVersion;
  }

  /**
   * Creates an IndexedDB object store and returns a helper for interacting with
   * that store in tests.
   *
   * Pass `IDBObjectStoreParameters` when you need options such as
   * `autoIncrement`.
   *
   * @param storeName Object store name to create.
   * @param options Optional IndexedDB object store configuration.
   * @returns Helper for CRUD and metadata operations on the created store.
   * @throws Error when {@link init} has not been called first.
   *
   * @example
   * ```ts
   * await playwrightIdb.init('FORM_CACHE');
   * const store = await playwrightIdb.createObjectStore('user_form_store');
   *
   * await store.createItem('user_form', {
   *   firstName: 'John',
   *   lastName: 'McClane',
   *   country: 'USA',
   *   city: 'New York',
   * });
   * ```
   *
   * @example
   * ```ts
   * await playwrightIdb.init('AUTO_INCREMENT');
   * const queueStore = await playwrightIdb.createObjectStore('store', {
   *   autoIncrement: true,
   * });
   *
   * await queueStore.addItem('test');
   * await queueStore.addItem('test2');
   * ```
   */
  async createObjectStore(
    storeName: string,
    options?: IDBObjectStoreParameters
  ): Promise<PlaywrightIdbStoreHelper> {
    if (!this.databaseName) {
      throw new Error(
        `Please call the ".init()" method before creating an object store`
      );
    }

    const storeHelper = this.storeHelpers.get(storeName)

    if (storeHelper) {
      return;
    }

    await test.step(`Creating ObjectStore in ${this.databaseName} with name ${storeName}`, async () => {
      await this.page.evaluate(
        async ({ dbName, store, storeOptions }) => {
          const request = window.indexedDB.open(dbName);
          const openDbConnection: IDBDatabase = await new Promise<IDBDatabase>(
            (resolve, reject) => {
              request.onerror = (e: Event) => {
                reject(e);
              };
              request.onsuccess = (e: Event) => {
                request.onerror = () => void 0;
                const newDatabase = (e.target as any).result as IDBDatabase;
                newDatabase.onversionchange = () => void 0;

                resolve(newDatabase);
              };
            }
          );

          const isExisting = openDbConnection.objectStoreNames.contains(store);
          if (isExisting) {
            return;
          }

          openDbConnection.close();
          const storeDbConnection = await new Promise<IDBDatabase>(
            (resolve, reject) => {
              const request: IDBOpenDBRequest = window.indexedDB.open(
                openDbConnection.name,
                openDbConnection.version + 1
              );
              request.onerror = (e: Event) => {
                reject(e);
              };
              request.onupgradeneeded = (e: Event) => {
                request.onerror = () => void 0;
                const db = (e.target as any).result as IDBDatabase;
                db.onversionchange = () => void 0;
                resolve(db);
              };
            }
          );

          const newStore: IDBObjectStore = storeOptions
            ? storeDbConnection.createObjectStore(store, storeOptions)
            : storeDbConnection.createObjectStore(store);

          return { storeName: newStore.name };
        },
        {
          dbName: this.databaseName!,
          store: storeName,
          storeOptions: options,
        }
      );
    });

    // this.stores.add(storeName);
    this.storeHelpers.set(storeName, new PlaywrightIdbStoreHelper(this.page, this.databaseName, storeName))

    return this.getStore(storeName);
  }

  /**
   * Returns a previously created object store helper by name.
   *
   * This is useful once the store has already been created in test setup and
   * you want to reuse the same helper in assertions.
   *
   * @param storeName Name of the existing object store helper to retrieve.
   * @returns Helper bound to the requested object store.
   * @throws Error when the store has not been created through
   * {@link createObjectStore}.
   *
   * @example
   * ```ts
   * const store = playwrightIdb.getStore('user_form_store');
   *
   * const savedForm = await store.readItem<{
   *   firstName: string;
   *   lastName: string;
   *   country: string;
   *   city: string;
   * }>('user_form');
   * ```
   */
  getStore(storeName: string): PlaywrightIdbStoreHelper {
    const storeHelper = this.storeHelpers.get(storeName);
    if (!storeHelper) {
      throw new Error(
        `IDBObjectStore with the name of ${storeName} has not been created. Please call createObjectStore first`
      );
    }

    return storeHelper;
  }
}
