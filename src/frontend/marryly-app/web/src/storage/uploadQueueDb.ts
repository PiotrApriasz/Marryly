const DATABASE_NAME = 'marryly-admin-upload-queue';
const STORE_NAME = 'items';
const DATABASE_VERSION = 2;

import type { UploadMediaKind } from '../types/upload.types';
import type { MediaUploadQueueItemStatus, MediaUploadQueueScope } from '../types/media-upload.types';

export interface PersistedUploadQueueItem {
    id: string;
    ownerUserId: string;
    scope?: MediaUploadQueueScope;
    albumId?: string | null;
    file: Blob;
    fileName: string;
    kind?: UploadMediaKind;
    contentType: string;
    sizeBytes: number;
    lastModified: number;
    fingerprint: string;
    status: MediaUploadQueueItemStatus;
    errorMessage: string | null;
    createdAt: number;
}

function getDatabase(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
        return Promise.reject(new Error('IndexedDB is not available in this browser.'));
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;
            const store = database.objectStoreNames.contains(STORE_NAME)
                ? request.transaction?.objectStore(STORE_NAME)
                : database.createObjectStore(STORE_NAME, { keyPath: 'id' });

            if (!store) {
                return;
            }

            if (!store.indexNames.contains('ownerUserId')) {
                store.createIndex('ownerUserId', 'ownerUserId', { unique: false });
            }

            if (!store.indexNames.contains('ownerAndAlbum')) {
                store.createIndex('ownerAndAlbum', ['ownerUserId', 'albumId'], { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Failed to open upload queue storage.'));
        request.onblocked = () => reject(new Error('Upload queue storage is blocked by another browser tab.'));
    });
}

function runTransaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore, setResult: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
    return getDatabase().then((database) => new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        let result: T;

        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error ?? new Error('Upload queue storage transaction failed.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Upload queue storage transaction aborted.'));

        operation(store, (value) => {
            result = value;
        }, reject);
    }));
}

export function getPersistedUploadQueue(ownerUserId: string): Promise<PersistedUploadQueueItem[]> {
    return runTransaction('readonly', (store, setResult, reject) => {
        const request = store.index('ownerUserId').getAll(ownerUserId);
        request.onsuccess = () => setResult(request.result as PersistedUploadQueueItem[]);
        request.onerror = () => reject(request.error ?? new Error('Failed to read upload queue.'));
    });
}

export function savePersistedUploadQueueItems(items: PersistedUploadQueueItem[]): Promise<void> {
    if (items.length === 0) {
        return Promise.resolve();
    }

    return runTransaction('readwrite', (store, setResult, reject) => {
        items.forEach((item) => {
            const request = store.put(item);
            request.onerror = () => reject(request.error ?? new Error('Failed to save upload queue item.'));
        });
        setResult(undefined);
    });
}

export function savePersistedUploadQueueItem(item: PersistedUploadQueueItem): Promise<void> {
    return savePersistedUploadQueueItems([item]);
}

export function deletePersistedUploadQueueItem(id: string): Promise<void> {
    return runTransaction('readwrite', (store, setResult, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => setResult(undefined);
        request.onerror = () => reject(request.error ?? new Error('Failed to delete upload queue item.'));
    });
}
