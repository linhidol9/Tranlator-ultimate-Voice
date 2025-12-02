

// IndexedDB wrapper for caching TTS audio chunks

const DB_NAME = 'SRT_TO_VOICE_CACHE';
const STORE_NAME = 'tts_chunks';
const DB_VERSION = 1;
const MAX_CACHE_ITEMS = 2000; // Auto-evict if exceeded

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      console.error('IndexedDB Open Error:', request.error);
      reject(request.error);
    };
  });

  return dbPromise;
};

export const getCachedChunk = async (text: string): Promise<ArrayBuffer | null> => {
  if (typeof indexedDB === 'undefined') return null;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(text);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        console.warn('Cache lookup failed');
        resolve(null);
      };
    });
  } catch (error) {
    console.warn('Error reading from TTS Cache:', error);
    return null;
  }
};

export const saveCachedChunk = async (text: string, buffer: ArrayBuffer): Promise<void> => {
  if (typeof indexedDB === 'undefined') return;

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Check count for eviction
    const countRequest = store.count();
    countRequest.onsuccess = () => {
        if (countRequest.result > MAX_CACHE_ITEMS) {
            // Simple eviction: clear everything to start fresh (simplest robust strategy for IDB without cursor iteration overhead)
            store.clear(); 
        }
        // Save new
        // Wrap in try-catch to prevent DataCloneError from crashing app if buffer is detached
        try {
            store.put(buffer, text);
        } catch (e) {
            console.warn("Failed to put item in TTS cache (DataCloneError?):", e);
        }
    };
  } catch (error) {
    console.warn('Error saving to TTS Cache:', error);
  }
};

export const clearCache = async (): Promise<number> => {
  if (typeof indexedDB === 'undefined') return 0;
  try {
     const db = await openDB();
     return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const countReq = store.count();
        
        countReq.onsuccess = () => {
            const count = countReq.result;
            const clearReq = store.clear();
            clearReq.onsuccess = () => resolve(count);
            clearReq.onerror = () => reject(clearReq.error);
        };
        countReq.onerror = () => reject(countReq.error);
     });
  } catch (e) {
    console.error("Failed to clear cache", e);
    return 0;
  }
};
