import { Page } from 'playwright';

type StoreOperation = keyof Pick<
  IDBObjectStore,
  'get' | 'put' | 'delete' | 'add'
>;

/**
 * Low-level CRUD helper that performs IndexedDB object store operations inside
 * the browser context through Playwright's `page.evaluate`.
 *
 * Most consumers should prefer {@link PlaywrightIdbStoreHelper}, which wraps
 * this class with Playwright test steps and a friendlier API.
 *
 * @example
 * ```ts
 * const store = playwrightIdb.getStore('user_form_store');
 *
 * await store.createItem('user_form', {
 *   firstName: 'John',
 *   lastName: 'McClane',
 *   country: 'USA',
 *   city: 'New York',
 * });
 *
 * const savedForm = await store.readItem<{
 *   firstName: string;
 *   lastName: string;
 *   country: string;
 *   city: string;
 * }>('user_form');
 * ```
 */
export class CrudHelper {
  /**
   * Creates a CRUD helper for one IndexedDB object store.
   *
   * @param page Playwright page used to execute IndexedDB code.
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
   * Reads one value from the configured object store.
   *
   * @typeParam T Expected stored value type.
   * @param key Key to read.
   * @returns Stored value for the key.
   *
   * @example
   * ```ts
   * const savedForm = await playwrightIdb
   *   .getStore('user_form_store')
   *   .readItem('user_form');
   * ```
   */
  readItem<T>(key: string | number): Promise<T> {
    return this.makeCreateReadUpdateDeleteRequest<T>('get', this.storeName, key);
  }

  /**
   * Deletes one value from the configured object store.
   *
   * @param key Key to delete.
   * @returns `null` after the delete operation finishes.
   *
   * @example
   * ```ts
   * await playwrightIdb.getStore('store').deleteItem(2);
   * ```
   */
  deleteItem(key: string | number): Promise<null> {
    return this.makeCreateReadUpdateDeleteRequest('delete', this.storeName, key)
  }

  /**
   * Creates a new value with an explicit key.
   *
   * @typeParam T Value type to store.
   * @param key Explicit key to create.
   * @param value Value to insert.
   * @returns `null` after the create operation finishes.
   *
   * @example
   * ```ts
   * await playwrightIdb.getStore('user_form_store').createItem('user_form', {
   *   firstName: 'John',
   *   lastName: 'McClane',
   *   country: 'USA',
   *   city: 'New York',
   * });
   * ```
   */
  createItem<T>(
    key: string | number,
    value: T
  ): Promise<null> {
    return this.makeCreateReadUpdateDeleteRequest<T>('add', this.storeName, key, value)
  }

  /**
   * Appends a value to an auto-increment object store.
   *
   * @typeParam T Value type to store.
   * @param value Value to append.
   * @returns `null` after the add operation finishes.
   *
   * @example
   * ```ts
   * const store = playwrightIdb.getStore('store');
   * await store.addItem('test');
   * await store.addItem('test2');
   * ```
   */
  addItem<T>(value: T): Promise<null> {
    return this.makeCreateReadUpdateDeleteRequest('add', this.storeName, null, value)
  }

  /**
   * Updates or replaces a stored value for the given key.
   *
   * @param key Key to update.
   * @param value Replacement value.
   * @returns `null` after the update operation finishes.
   *
   * @example
   * ```ts
   * await playwrightIdb.getStore('store').updateItem(2, 'updated-test2');
   * ```
   */
  updateItem(
    key: string | number,
    value: unknown
  ): Promise<null> {
    return this.makeCreateReadUpdateDeleteRequest('put', this.storeName, key, value)
  }

  /**
   * Executes one IndexedDB CRUD request in the page context.
   *
   * The method opens the database, performs the operation against the
   * configured object store, and closes the connection again before returning.
   *
   * @param operation IndexedDB object store operation to execute.
   * @param storeName Target object store.
   * @param key Optional key argument for the operation.
   * @param value Optional value argument for `add` and `put`.
   * @returns Stored value for `get`, otherwise `null`.
   */
  private async makeCreateReadUpdateDeleteRequest<T>(
    operation: 'get',
    storeName: string,
    key: string | number
  ): Promise<T>;
  private async makeCreateReadUpdateDeleteRequest<T>(
    operation: 'put' | 'delete' | 'add',
    storeName: string,
    key: string | number | null,
    value?: T
  ): Promise<null>;
  private async makeCreateReadUpdateDeleteRequest<T>(
    operation: StoreOperation,
    storeName: string,
    key: string | number | null,
    value?: T
  ): Promise<T | null> {
    const dbOperationResult = await this.page.evaluate(
      async ({
               dbName,
               store,
               storeKey,
               storeValue,
               dbOperation,
             }): Promise<T | null> => {
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

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const commandArguments: [T, string | number] | [string | number] | [T] =
          storeKey
            ? storeValue
              ? [storeValue, storeKey]
              : [storeKey]
            : [storeValue];

        const operationResult = await new Promise((resolve, reject) => {
          const request = openDbConnection
            .transaction(store, 'readwrite')
            .objectStore(store)
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            [dbOperation](...commandArguments);
          request.onerror = (e: any) => {
            openDbConnection.close();
            reject(e);
          };
          request.onsuccess = () => {
            request.onerror = () => void 0;
            openDbConnection.close();
            const result = dbOperation === 'get' ? request.result : void 0;
            resolve(result);
          };
        });

        return operationResult as T;
      },
      {
        dbName: this.databaseName,
        store: this.storeName,
        storeKey: key,
        storeValue: value,
        dbOperation: operation,
      }
    );

    return operation === 'get' ? (dbOperationResult as T) : null;
  }
}
