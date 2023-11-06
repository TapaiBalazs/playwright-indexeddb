import { Page } from 'playwright';

type StoreOperation = keyof Pick<
  IDBObjectStore,
  'get' | 'put' | 'delete' | 'add'
>;

export class CrudHelper {
  constructor(
    private readonly page: Page,
    private readonly databaseName: string,
    private readonly storeName: string
  ) {
  }

  readItem<T>(key: string | number): Promise<T> {
    return this.makeCreateReadUpdateDeleteRequest<T>('get', this.storeName, key);
  }

  deleteItem(key: string | number): Promise<null> {
    return this.makeCreateReadUpdateDeleteRequest('delete', this.storeName, key)
  }

  createItem<T>(
    key: string | number,
    value: T
  ): Promise<null> {
    return this.makeCreateReadUpdateDeleteRequest<T>('add', this.storeName, key, value)
  }

  addItem<T>(value: T): Promise<null> {
    return this.makeCreateReadUpdateDeleteRequest('add', this.storeName, null, value)
  }

  updateItem(
    key: string | number,
    value: unknown
  ): Promise<null> {
    return this.makeCreateReadUpdateDeleteRequest('put', this.storeName, key, value)
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
