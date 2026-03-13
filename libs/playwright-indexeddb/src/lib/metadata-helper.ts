import { Page } from 'playwright';

/**
 * Low-level helper for reading metadata-like views of an IndexedDB object
 * store, such as all keys or all values.
 *
 * Most consumers should access this behavior through
 * {@link PlaywrightIdbStoreHelper.keys} and
 * {@link PlaywrightIdbStoreHelper.values}.
 *
 * @example
 * ```ts
 * const store = playwrightIdb.getStore('store');
 *
 * const keys = await store.keys();
 * const values = await store.values<string>();
 * ```
 */
export class MetadataHelper {
  /**
   * Creates a metadata helper for one IndexedDB object store.
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
   * Returns all keys from the configured object store.
   *
   * @returns All keys currently present in the object store.
   *
   * @example
   * ```ts
   * const keys = await playwrightIdb.getStore('store').keys();
   * // [1, 2, 3]
   * ```
   */
  getKeys(): Promise<(string | number)[]> {
    return this.makeMetadataRequest<string | number>('getAllKeys');
  }

  /**
   * Returns all values from the configured object store.
   *
   * @typeParam T Expected stored value type.
   * @returns All values currently present in the object store.
   *
   * @example
   * ```ts
   * const values = await playwrightIdb.getStore('store').values<string>();
   * // ['test', 'test2', '1337']
   * ```
   */
  getValues<T>(): Promise<T[]> {
    return this.makeMetadataRequest<T>('getAll')
  }

  /**
   * Executes a metadata request in the page context and returns the result
   * array from the configured object store.
   *
   * @param operation Metadata operation to execute.
   * @returns Result array for the requested metadata operation.
   */
  private async makeMetadataRequest<T>(
    operation: 'getAllKeys' | 'getAll'
  ): Promise<T[]> {
    const dbOperationResult = await this.page.evaluate(
      async ({ dbName, store, dbOperation }): Promise<T | null> => {
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

        const operationResult = await new Promise((resolve, reject) => {
          const request = openDbConnection
            .transaction(store, 'readwrite')
            .objectStore(store)
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            [dbOperation]();
          request.onerror = (e: any) => {
            openDbConnection.close();
            reject(e);
          };
          request.onsuccess = () => {
            request.onerror = () => void 0;
            openDbConnection.close();
            const result = request.result;
            resolve(result);
          };
        });

        return operationResult ? (operationResult as T) : null;
      },
      {
        dbName: this.databaseName,
        store: this.storeName,
        dbOperation: operation,
      }
    );

    return dbOperationResult as T[];
  }
}
