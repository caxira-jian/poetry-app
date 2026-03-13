interface SettingsRecord {
  key: string;
  value: string;
}

export type StoreName = "poems" | "recite_logs" | "settings";

const DB_NAME = "poetry-recite-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function toSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function wrapTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("poems")) {
        db.createObjectStore("poems", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("recite_logs")) {
        db.createObjectStore("recite_logs", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDb();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const request = store.getAll();
  const items = await wrapRequest(request);
  await wrapTransaction(tx);
  return items as T[];
}

export async function putOne<T>(storeName: StoreName, value: T): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(toSerializable(value) as any);
  await wrapTransaction(tx);
}

export async function putMany<T>(storeName: StoreName, values: T[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  values.forEach((value) => store.put(toSerializable(value) as any));
  await wrapTransaction(tx);
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).clear();
  await wrapTransaction(tx);
}

export async function getSetting(key: string): Promise<string | undefined> {
  const db = await openDb();
  const tx = db.transaction("settings", "readonly");
  const request = tx.objectStore("settings").get(key);
  const result = await wrapRequest(request);
  await wrapTransaction(tx);
  return (result as SettingsRecord | undefined)?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("settings", "readwrite");
  tx.objectStore("settings").put({ key, value } as any);
  await wrapTransaction(tx);
}
