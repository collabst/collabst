import { browser } from '$app/environment';

const DB_NAME = 'collabst-asset-cache';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

interface CachedAssetEntry {
  cacheKey: string;
  projectId: number;
  assetId: number;
  storagePath: string;
  mimeType: string;
  blob: ArrayBuffer;
  cachedAt: number;
}

export interface CachedAsset {
  blob: ArrayBuffer;
  mimeType: string;
  storagePath: string;
}

let db: IDBDatabase | null = null;

/**
 * Initialize the asset cache database.
 * Call this once on app startup.
 */
export async function initAssetCache(): Promise<void> {
  if (!browser || db) return;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.warn('[AssetCache] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
      }
    };
  });
}

/**
 * Get a cached asset. Returns null if not cached or if storage_path doesn't match.
 */
export async function getCachedAsset(
  projectId: number,
  assetId: number,
  currentStoragePath: string
): Promise<CachedAsset | null> {
  if (!browser || !db) return null;

  const cacheKey = `${projectId}-${assetId}`;

  return new Promise((resolve) => {
    try {
      const transaction = db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(cacheKey);

      request.onerror = () => {
        console.warn('[AssetCache] Read error:', request.error);
        resolve(null);
      };

      request.onsuccess = () => {
        const entry = request.result as CachedAssetEntry | undefined;
        if (!entry) {
          resolve(null);
          return;
        }

        // Check if storage_path matches (cache invalidation)
        if (entry.storagePath !== currentStoragePath) {
          resolve(null);
          return;
        }

        resolve({
          blob: entry.blob,
          mimeType: entry.mimeType,
          storagePath: entry.storagePath,
        });
      };
    } catch (error) {
      console.warn('[AssetCache] Read error:', error);
      resolve(null);
    }
  });
}

/**
 * Store an asset in the cache.
 */
export async function cacheAsset(
  projectId: number,
  assetId: number,
  storagePath: string,
  mimeType: string,
  blob: ArrayBuffer
): Promise<void> {
  if (!browser || !db) return;

  const cacheKey = `${projectId}-${assetId}`;
  const entry: CachedAssetEntry = {
    cacheKey,
    projectId,
    assetId,
    storagePath,
    mimeType,
    blob,
    cachedAt: Date.now(),
  };

  return new Promise((resolve) => {
    try {
      const transaction = db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onerror = () => {
        console.warn('[AssetCache] Write error:', request.error);
        resolve();
      };

      request.onsuccess = () => {
        resolve();
      };
    } catch (error) {
      console.warn('[AssetCache] Write error:', error);
      resolve();
    }
  });
}

/**
 * Remove an asset from the cache.
 */
export async function removeCachedAsset(
  projectId: number,
  assetId: number
): Promise<void> {
  if (!browser || !db) return;

  const cacheKey = `${projectId}-${assetId}`;

  return new Promise((resolve) => {
    try {
      const transaction = db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(cacheKey);

      request.onerror = () => {
        console.warn('[AssetCache] Delete error:', request.error);
        resolve();
      };

      request.onsuccess = () => {
        resolve();
      };
    } catch (error) {
      console.warn('[AssetCache] Delete error:', error);
      resolve();
    }
  });
}

/**
 * Create a blob URL from an ArrayBuffer.
 * Remember to call revokeBlobUrl when done to prevent memory leaks.
 */
export function createBlobUrl(blob: ArrayBuffer, mimeType: string): string {
  const blobObject = new Blob([blob], { type: mimeType });
  return URL.createObjectURL(blobObject);
}

/**
 * Revoke a blob URL to free memory.
 */
export function revokeBlobUrl(url: string): void {
  URL.revokeObjectURL(url);
}
