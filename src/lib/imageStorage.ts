// High-performance client-side IndexedDB cache for high-res food photography
// Eliminates localStorage 5MB quota errors and provides instant 0ms offline image rendering

const DB_NAME = 'ilish_restaurant_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'food_images';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }
  return dbPromise;
}

export async function getImageFromIDB(id: string): Promise<string | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        resolve(req.result ? req.result.image_url : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function getAllImagesFromIDB(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        if (Array.isArray(req.result)) {
          req.result.forEach((entry: { id: string; image_url: string }) => {
            if (entry && entry.id && entry.image_url) {
              map.set(entry.id, entry.image_url);
            }
          });
        }
        resolve(map);
      };
      req.onerror = () => resolve(map);
    });
  } catch {
    return map;
  }
}

export async function saveImageToIDB(id: string, imageUrl: string): Promise<void> {
  if (!id || !imageUrl) return;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id, image_url: imageUrl });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IDB save image warn:', e);
  }
}

export async function saveImagesToIDB(items: { id: string; image_url?: string | null }[]): Promise<void> {
  if (!items || items.length === 0) return;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const item of items) {
        if (item.id && item.image_url && item.image_url.trim().length > 0) {
          store.put({ id: item.id, image_url: item.image_url });
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IDB bulk save warn:', e);
  }
}

// Safely caches menu items in localStorage by stripping or trimming heavy base64 to avoid QuotaExceededError
export function safeCacheMenuItemsMetadata(items: any[]) {
  if (typeof window === 'undefined') return;
  try {
    // Only store metadata in localStorage, or short URLs. Base64 is stored in IndexedDB.
    const lightweightItems = items.map(item => ({
      ...item,
      image_url: (item.image_url && item.image_url.startsWith('data:')) ? 'idb' : item.image_url
    }));
    localStorage.setItem('cached_menu_items_meta', JSON.stringify(lightweightItems));
  } catch (e) {
    console.warn('Metadata cache warning:', e);
  }
}
