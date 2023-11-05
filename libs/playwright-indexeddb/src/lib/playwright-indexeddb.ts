import { test } from '@playwright/test';
import { Page } from 'playwright';

export type PlaywrightIDbStore = {
  createItem: <T>(
    key: string | number,
    value: T
  ) => Promise<PlaywrightIDbStore>;
  readItem: <T>(key: string | number) => Promise<T>;
  deleteItem: (key: string | number) => Promise<PlaywrightIDbStore>;
  keys: () => Promise<(string | number)[]>;
  values: <T>() => Promise<T[]>;
};

type SetItemOperation = 'create' | 'update' | 'add';
type ReadDeleteOperation = 'read' | 'delete';
type StoreOperation = keyof Pick<
  IDBObjectStore,
  'get' | 'put' | 'delete' | 'add'
>;

export class IdbHelper {
  private databaseName?: string;
  private databaseVersion?: number;
  private stores: Set<string> = new Set();

  constructor(private readonly page: Page) {
  }

  async init(
    database: string,
    versionConfiguredByUser?: number
  ): Promise<void> {
    if (this.databaseName && this.databaseVersion) {
      throw new Error(
        `IDB "${this.databaseName}" with ${this.databaseVersion} has already been initialised.`
      );
    }

    const {
      databaseName,
      databaseVersion
    } = await test.step(`Initialise IndexedDB with name ${database} and version ${versionConfiguredByUser || 1}`, async () => {
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
    })

    this.databaseName = databaseName;
    this.databaseVersion = databaseVersion;
  }

  async createObjectStore(
    storeName: string,
    options?: IDBObjectStoreParameters
  ): Promise<void> {
    if (!this.databaseName) {
      throw new Error(
        `Please call the ".init()" method before creating an object store`
      );
    }

    if (this.stores.has(storeName)) {
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
          console.log('AAAAA');
          console.warn('dbversion', openDbConnection.version);
          const storeDbConnection = await new Promise<IDBDatabase>(
            (resolve, reject) => {
              const request: IDBOpenDBRequest = window.indexedDB.open(
                openDbConnection.name,
                openDbConnection.version + 1
              );
              console.warn('newdbversion', openDbConnection.version + 1);
              request.onerror = (e: Event) => {
                reject(e);
              };
              request.onupgradeneeded = (e: Event) => {
                console.warn('onupgradeneeded');
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
    })


    this.stores.add(storeName);
  }

  readItem<T>(store: string, key: string | number): Promise<T> {
    return test.step(`Read "${key}" from "${store}" ObjectStore`, () => this.makeCreateReadUpdateDeleteRequest<T>('get', store, key))
  }

  deleteItem(store: string, key: string | number): Promise<PlaywrightIDbStore> {
    return test.step(`Delete "${key}" from "${store}" ObjectStore`, () => this.makeCreateReadUpdateDeleteRequest('delete', store, key))
  }

  createItem<T>(
    store: string,
    key: string | number,
    value: T
  ): Promise<PlaywrightIDbStore> {
    return test.step(`Create "${key}" with value "${value}" in "${store}" ObjectStore`, () => this.makeCreateReadUpdateDeleteRequest<T>('add', store, key, value))
  }

  addItem(store: string, value: unknown): Promise<PlaywrightIDbStore> {
    return test.step(`Add entry "${value}" in "${store}" ObjectStore`, () => this.makeCreateReadUpdateDeleteRequest('add', store, null, value))
  }

  updateItem(
    store: string,
    key: string | number,
    value: unknown
  ): Promise<PlaywrightIDbStore> {
    return test.step(`Update "${key}" with value "${value}" in "${store}" ObjectStore`, () => this.makeCreateReadUpdateDeleteRequest('put', store, key, value))
  }

  store(storeName: string): PlaywrightIDbStore {
    if (!this.stores.has(storeName)) {
      throw new Error(
        `IDBObjectStore with the name of ${storeName} has not been created. Please call createObjectStore first`
      );
    }
    return {
      createItem: <T>(key: string | number, value: T) =>
        this.createItem<T>(storeName, key, value),
      readItem: <T>(key: string | number) => this.readItem<T>(storeName, key),
      deleteItem: (key: string | number) =>
        this.deleteItem(storeName, key),
      keys: () => this.getKeys(storeName),
      values: <T>() => this.getValues<T>(storeName),
    };
  }

  getKeys(storeName: string): Promise<(string | number)[]> {
    return test.step(`Retrieving all keys from ${storeName} ObjectStore`, () => this.makeMetadataRequest<string | number>(storeName, 'getAllKeys'))
  }

  getValues<T>(storeName: string): Promise<T[]> {
    return test.step(`Retrieving all values from ${storeName} ObjectStore`, () => this.makeMetadataRequest<T>(storeName, 'getAll'))
  }

  private async makeMetadataRequest<T>(
    storeName: string,
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
        dbName: this.databaseName!,
        store: storeName,
        dbOperation: operation,
      }
    );

    return dbOperationResult as T[];
  }

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
  ): Promise<PlaywrightIDbStore>;
  private async makeCreateReadUpdateDeleteRequest<T>(
    operation: StoreOperation,
    storeName: string,
    key: string | number | null,
    value?: T
  ): Promise<T | PlaywrightIDbStore> {
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

        return (operationResult as T);
      },
      {
        dbName: this.databaseName!,
        store: storeName,
        storeKey: key,
        storeValue: value,
        dbOperation: operation,
      }
    );

    return operation === 'get'
      ? (dbOperationResult as T)
      : this.store(storeName);
  }
}
