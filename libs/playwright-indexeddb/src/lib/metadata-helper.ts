import { Page } from 'playwright';

export class MetadataHelper {
  constructor(
    private readonly page: Page,
    private readonly databaseName: string,
    private readonly storeName: string
  ) {
  }

  getKeys(): Promise<(string | number)[]> {
    return this.makeMetadataRequest<string | number>('getAllKeys');
  }

  getValues<T>(): Promise<T[]> {
    return this.makeMetadataRequest<T>('getAll')
  }

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
