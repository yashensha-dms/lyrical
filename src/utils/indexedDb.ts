const DB_NAME = 'LyricalDB';
const DB_VERSION = 1;
const DRAFTS_STORE = 'drafts';
const AUDIO_STORE = 'audio';

// Re-declare local interfaces to avoid circular dependency
export interface LocalDraft {
  id: string;
  title: string;
  content: string;
  scrapbook: string;
  targetTemplate: string;
  hasAudio: boolean;
  syllableTolerance?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface LocalAudio {
  draftId: string;
  audioData: string; // Base64 encoded data URI
  duration: number;
  mimeType: string;
}

export const initDB = (): Promise<IDBDatabase> => {
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
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        db.createObjectStore(DRAFTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'draftId' });
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
    transaction.objectStore(AUDIO_STORE).delete(id);

    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
};

export const getLocalAudio = async (draftId: string): Promise<LocalAudio | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readonly');
    const store = transaction.objectStore(AUDIO_STORE);
    const request = store.get(draftId);

    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const saveLocalAudio = async (
  draftId: string,
  audioData: string,
  duration: number,
  mimeType: string
): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readwrite');
    const store = transaction.objectStore(AUDIO_STORE);
    const request = store.put({ draftId, audioData, duration, mimeType });

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const deleteLocalAudio = async (draftId: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE, 'readwrite');
    const store = transaction.objectStore(AUDIO_STORE);
    const request = store.delete(draftId);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};
