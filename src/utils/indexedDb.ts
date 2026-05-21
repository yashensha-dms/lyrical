const DB_NAME = 'LyricalDB';
const DB_VERSION = 2;
const DRAFTS_STORE = 'drafts';
const AUDIO_STORE = 'audio';

let dbInstance: IDBDatabase | null = null;

export interface LocalDraft {
  id: string;
  title: string;
  content: string;
  scrapbook: string;
  targetTemplate: string;
  audioCount: number;
  syllableTolerance?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface LocalAudio {
  id: string;
  draftId: string;
  audioData: string;
  duration: number;
  mimeType: string;
  createdAt: string;
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
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
          const store = db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(AUDIO_STORE)) {
          db.createObjectStore(AUDIO_STORE, { keyPath: 'draftId' });
        }
      }

      if (oldVersion < 2) {
        if (db.objectStoreNames.contains(AUDIO_STORE)) {
          db.deleteObjectStore(AUDIO_STORE);
        }
        const store = db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
        store.createIndex('draftId', 'draftId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });

        const draftStore = request.transaction?.objectStore(DRAFTS_STORE);
        if (draftStore) {
          const cursorReq = draftStore.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
              const draft = cursor.value;
              if (draft.hasAudio !== undefined) {
                draft.audioCount = draft.hasAudio ? 1 : 0;
                delete draft.hasAudio;
                cursor.update(draft);
              }
              cursor.continue();
            }
          };
        }
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
    const transaction = db.transaction([DRAFTS_STORE, AUDIO_STORE], 'readwrite');

    transaction.objectStore(DRAFTS_STORE).delete(id);

    const audioStore = transaction.objectStore(AUDIO_STORE);
    const index = audioStore.index('draftId');
    const range = IDBKeyRange.only(id);
    const cursorReq = index.openCursor(range);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
};

export const getLocalAudios = async (draftId: string): Promise<LocalAudio[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readonly');
    const store = transaction.objectStore(AUDIO_STORE);
    const index = store.index('draftId');
    const request = index.getAll(draftId);

    request.onsuccess = () => {
      resolve(request.result || []);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const getLocalAudio = async (audioId: string): Promise<LocalAudio | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readonly');
    const store = transaction.objectStore(AUDIO_STORE);
    const request = store.get(audioId);

    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const saveLocalAudio = async (
  id: string,
  draftId: string,
  audioData: string,
  duration: number,
  mimeType: string,
  createdAt: string
): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readwrite');
    const store = transaction.objectStore(AUDIO_STORE);
    const request = store.put({ id, draftId, audioData, duration, mimeType, createdAt });

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const deleteLocalAudio = async (audioId: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readwrite');
    const store = transaction.objectStore(AUDIO_STORE);
    const request = store.delete(audioId);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const getLocalAudioCount = async (draftId: string): Promise<number> => {
  const audios = await getLocalAudios(draftId);
  return audios.length;
};
