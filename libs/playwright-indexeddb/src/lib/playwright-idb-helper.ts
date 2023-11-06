import { test } from '@playwright/test';
import { Page } from 'playwright';
import { PlaywrightIdbStoreHelper } from './playwright-idb-store-helper';

export class PlaywrightIdbHelper {
  private databaseName?: string;
  private databaseVersion?: number;

  private storeHelpers: Map<string, PlaywrightIdbStoreHelper> = new Map();

  constructor(private readonly page: Page) {}

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
