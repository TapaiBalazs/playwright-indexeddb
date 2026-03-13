import * as localforage from 'localforage';

export interface IndexedDbEntry<T> {
  key: IDBValidKey;
  value: T;
}

export type LocalForageInstance = ReturnType<typeof localforage.createInstance>;

interface LocalForageDbInfo {
  db: IDBDatabase;
  storeName: string;
}

type LocalForageInstanceWithDbInfo = LocalForageInstance & {
  _dbInfo?: LocalForageDbInfo;
};

export function createIndexedDbStore(
  databaseName: string,
  storeName: string
): LocalForageInstance {
  return localforage.createInstance({
    driver: localforage.INDEXEDDB,
    name: databaseName,
    storeName,
  });
}

export async function ensureAutoIncrementStore(
  databaseName: string,
  storeName: string
): Promise<void> {
  const database = await openDatabase(databaseName);

  if (database.objectStoreNames.contains(storeName)) {
    database.close();
    return;
  }

  const nextVersion = database.version + 1;
  database.close();

  const upgradedDatabase = await openDatabase(
    databaseName,
    nextVersion,
    (db) => {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { autoIncrement: true });
      }
    }
  );

  upgradedDatabase.close();
}

export async function getIndexedDbEntries<T>(
  store: LocalForageInstance
): Promise<IndexedDbEntry<T>[]> {
  const entries: IndexedDbEntry<T>[] = [];

  await store.iterate<T, void>((value, key) => {
    entries.push({
      key: key as unknown as IDBValidKey,
      value,
    });
  });

  return entries;
}

export async function addAutoIncrementItem<T>(
  store: LocalForageInstance,
  value: T
): Promise<IDBValidKey> {
  return runObjectStoreRequest(store, 'readwrite', (objectStore) =>
    objectStore.add(value)
  );
}

export async function deleteIndexedDbItem(
  store: LocalForageInstance,
  key: IDBValidKey
): Promise<void> {
  await runObjectStoreRequest(store, 'readwrite', (objectStore) =>
    objectStore.delete(key)
  );
}

export async function deleteDatabase(databaseName: string): Promise<void> {
  await localforage.dropInstance({
    name: databaseName,
  });
}

async function runObjectStoreRequest<T>(
  store: LocalForageInstance,
  mode: IDBTransactionMode,
  createRequest: (objectStore: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const dbInfo = await getDbInfo(store);

  return new Promise<T>((resolve, reject) => {
    const transaction = dbInfo.db.transaction(dbInfo.storeName, mode);
    const objectStore = transaction.objectStore(dbInfo.storeName);
    let request: IDBRequest<T> | undefined;
    let result!: T;

    try {
      request = createRequest(objectStore);
    } catch (error) {
      reject(error);
      return;
    }

    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => {
      reject(
        request.error ?? new Error('IndexedDB request failed unexpectedly.')
      );
    };

    transaction.oncomplete = () => {
      resolve(result);
    };
    transaction.onerror = transaction.onabort = () => {
      reject(
        transaction.error ??
          request?.error ??
          new Error('IndexedDB transaction failed unexpectedly.')
      );
    };
  });
}

async function getDbInfo(
  store: LocalForageInstance
): Promise<LocalForageDbInfo> {
  await store.ready();

  const dbInfo = (store as LocalForageInstanceWithDbInfo)._dbInfo;
  if (!dbInfo?.db) {
    throw new Error('localforage IndexedDB connection is unavailable.');
  }

  return dbInfo;
}

function openDatabase(
  databaseName: string,
  version?: number,
  onUpgradeNeeded?: (database: IDBDatabase) => void
): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request =
      version === undefined
        ? indexedDB.open(databaseName)
        : indexedDB.open(databaseName, version);

    request.onupgradeneeded = () => {
      onUpgradeNeeded?.(request.result);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('Opening IndexedDB failed.'));
    };
    request.onblocked = () => {
      reject(
        new Error(`Opening IndexedDB database "${databaseName}" was blocked.`)
      );
    };
  });
}
