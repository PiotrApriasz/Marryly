const DATABASE_NAME = 'marryly-admin-upload-queue';
const STORE_NAME = 'items';
const DATABASE_VERSION = 1;

export interface PersistedAdminUploadQueueItem {
    id: string;
    ownerUserId: string;
    albumId: string;
    file: Blob;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    lastModified: number;
    fingerprint: string;
    status: 'queued' | 'preparing' | 'uploading' | 'error';
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

export function getPersistedAdminUploadQueue(ownerUserId: string): Promise<PersistedAdminUploadQueueItem[]> {
    return runTransaction('readonly', (store, setResult, reject) => {
        const request = store.index('ownerUserId').getAll(ownerUserId);
        request.onsuccess = () => setResult(request.result as PersistedAdminUploadQueueItem[]);
        request.onerror = () => reject(request.error ?? new Error('Failed to read upload queue.'));
    });
}

export function savePersistedAdminUploadQueueItems(items: PersistedAdminUploadQueueItem[]): Promise<void> {
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

export function savePersistedAdminUploadQueueItem(item: PersistedAdminUploadQueueItem): Promise<void> {
    return savePersistedAdminUploadQueueItems([item]);
}

export function deletePersistedAdminUploadQueueItem(id: string): Promise<void> {
    return runTransaction('readwrite', (store, setResult, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => setResult(undefined);
        request.onerror = () => reject(request.error ?? new Error('Failed to delete upload queue item.'));
    });
}

export function deletePersistedAdminUploadQueueForOwner(ownerUserId: string): Promise<void> {
    return runTransaction('readwrite', (store, setResult, reject) => {
        const request = store.index('ownerUserId').openCursor(ownerUserId);
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
                setResult(undefined);
                return;
            }

            cursor.delete();
            cursor.continue();
        };
        request.onerror = () => reject(request.error ?? new Error('Failed to clear upload queue.'));
    });
}
