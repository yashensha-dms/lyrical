const DB_NAME = 'LyricalDB';
const DB_VERSION = 2;
const DRAFTS_STORE = 'drafts';

let dbInstance: IDBDatabase | null = null;

export interface LocalDraft {
  id: string;
  title: string;
  content: string;
  targetTemplate: string;
  syllableTolerance?: number;
  createdAt: string;
  updatedAt?: string;
}

export const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported on this platform'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open local database'));
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        const store = db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
};

export const getLocalDrafts = async (): Promise<LocalDraft[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DRAFTS_STORE, 'readonly');
    const store = transaction.objectStore(DRAFTS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const saveLocalDraft = async (draft: LocalDraft): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DRAFTS_STORE, 'readwrite');
    const store = transaction.objectStore(DRAFTS_STORE);
    const request = store.put(draft);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const deleteLocalDraft = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DRAFTS_STORE, 'readwrite');
    const store = transaction.objectStore(DRAFTS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};
