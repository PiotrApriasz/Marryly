import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { adminClient } from '../../api/adminClient';
import { uploadFileToSignedUrl } from '../../api/photoUploadTransport';
import { appText } from '../../content/appText';
import { ApiError, getErrorMessageForDisplay, logErrorDetails } from '../../errors/apiError';
import { extractPhotoCapturedAt } from '../../media/extractPhotoMetadata';
import { preparePhotoFileForUpload } from '../../media/preparePhotoFileForUpload';
import {
    deletePersistedAdminUploadQueueItem,
    getPersistedAdminUploadQueue,
    savePersistedAdminUploadQueueItem,
    savePersistedAdminUploadQueueItems,
    type PersistedAdminUploadQueueItem,
} from '../../storage/adminUploadQueueDb';
import type {
    AdminUploadEnqueueResult,
    AdminUploadQueueItem,
    AdminUploadQueueSummary,
} from '../../types/admin-upload.types';
import type { CompletePhotoUploadRequest } from '../../types/upload.types';
import { invalidateAdminCache, invalidateAdminCacheByPrefix } from './useAdminApiResource';
import { invalidateCachedApiResourcesByPrefix } from '../useCachedApiResource';

const MAX_PHOTOS_PER_ALBUM = 500;
const MAX_PARALLEL_UPLOADS = 2;
const MAX_PHOTO_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const PHOTO_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

interface QueueProcessResult {
    status: 'success' | 'error' | 'paused';
    albumId?: string;
}

interface QueueItemRecord extends AdminUploadQueueItem {
    file: File;
    ownerUserId: string;
    contentType: string;
    lastModified: number;
    fingerprint: string;
    persisted: boolean;
}

interface AdminUploadQueueContextValue {
    items: AdminUploadQueueItem[];
    summary: AdminUploadQueueSummary;
    isHydrating: boolean;
    isOnline: boolean;
    pauseReason: 'offline' | 'session' | null;
    persistenceWarning: string | null;
    lastSummary: { successfulCount: number; failedCount: number } | null;
    completedAlbumIds: string[];
    completionVersion: number;
    enqueueFiles: (albumId: string, files: File[]) => Promise<AdminUploadEnqueueResult>;
    retryFailed: (albumId?: string) => Promise<void>;
    dismissLastSummary: () => void;
}

const AdminUploadQueueContext = createContext<AdminUploadQueueContextValue | null>(null);

function getExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
}

function getContentType(file: File): string {
    if (file.type) {
        return file.type;
    }

    switch (getExtension(file.name)) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.webp':
            return 'image/webp';
        case '.heic':
            return 'image/heic';
        case '.heif':
            return 'image/heif';
        default:
            return 'application/octet-stream';
    }
}

function isPhoto(file: File): boolean {
    const contentType = getContentType(file).toLowerCase();
    return PHOTO_FILE_TYPES.includes(contentType) || PHOTO_EXTENSIONS.includes(getExtension(file.name));
}

function formatBytes(size: number): string {
    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function createUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    const randomPart = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
    return `${randomPart()}-${randomPart().slice(0, 4)}-4${randomPart().slice(0, 3)}-8${randomPart().slice(0, 3)}-${randomPart()}${randomPart().slice(0, 4)}`;
}

function getFingerprint(file: File): string {
    return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

function toPersistedItem(item: QueueItemRecord): PersistedAdminUploadQueueItem {
    return {
        id: item.id,
        ownerUserId: item.ownerUserId,
        albumId: item.albumId,
        file: item.file,
        fileName: item.fileName,
        contentType: item.contentType,
        sizeBytes: item.sizeBytes,
        lastModified: item.lastModified,
        fingerprint: item.fingerprint,
        status: item.status,
        errorMessage: item.errorMessage,
        createdAt: item.createdAt,
    };
}

function fromPersistedItem(item: PersistedAdminUploadQueueItem): QueueItemRecord {
    const file = item.file instanceof File
        ? item.file
        : new File([item.file], item.fileName, {
            type: item.contentType,
            lastModified: item.lastModified,
        });

    return {
        id: item.id,
        albumId: item.albumId,
        file,
        fileName: item.fileName,
        sizeBytes: item.sizeBytes,
        status: item.status === 'error' ? 'error' : 'queued',
        progress: 0,
        errorMessage: item.status === 'error' ? item.errorMessage : null,
        createdAt: item.createdAt,
        ownerUserId: item.ownerUserId,
        contentType: item.contentType,
        lastModified: item.lastModified,
        fingerprint: item.fingerprint,
        persisted: true,
    };
}

function getSummary(
    items: QueueItemRecord[],
    sessionTotalCount: number,
    completedCount: number,
): AdminUploadQueueSummary {
    return {
        totalCount: Math.max(sessionTotalCount, items.length + completedCount),
        completedCount,
        activeCount: items.filter((item) => item.status === 'preparing' || item.status === 'uploading').length,
        queuedCount: items.filter((item) => item.status === 'queued').length,
        failedCount: items.filter((item) => item.status === 'error').length,
    };
}

function toPublicItem(item: QueueItemRecord): AdminUploadQueueItem {
    return {
        id: item.id,
        albumId: item.albumId,
        fileName: item.fileName,
        sizeBytes: item.sizeBytes,
        status: item.status,
        progress: item.progress,
        errorMessage: item.errorMessage,
        createdAt: item.createdAt,
    };
}

export function AdminUploadQueueProvider({ children }: { children: ReactNode }) {
    const { isAdmin, user } = useAuth();
    const ownerUserId = isAdmin ? user?.id ?? null : null;
    const [items, setItems] = useState<QueueItemRecord[]>([]);
    const itemsRef = useRef<QueueItemRecord[]>([]);
    const [isHydrating, setIsHydrating] = useState(false);
    const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
    const isOnlineRef = useRef(isOnline);
    const isAdminRef = useRef(isAdmin);
    const [pauseReason, setPauseReason] = useState<'offline' | 'session' | null>(null);
    const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
    const [lastSummary, setLastSummary] = useState<{ successfulCount: number; failedCount: number } | null>(null);
    const [lastSummaryDismissed, setLastSummaryDismissed] = useState(false);
    const [completedAlbumIds, setCompletedAlbumIds] = useState<string[]>([]);
    const [completionVersion, setCompletionVersion] = useState(0);
    const [sessionTotalCount, setSessionTotalCount] = useState(0);
    const sessionTotalCountRef = useRef(0);
    const [completedCount, setCompletedCount] = useState(0);
    const completedCountRef = useRef(0);
    const processingRef = useRef(false);
    const persistenceEnabledRef = useRef(true);

    useEffect(() => {
        isAdminRef.current = isAdmin;
    }, [isAdmin]);

    useEffect(() => {
        isOnlineRef.current = isOnline;
    }, [isOnline]);

    useEffect(() => {
        const handleOnline = () => {
            isOnlineRef.current = true;
            setIsOnline(true);
            setPauseReason((currentReason) => currentReason === 'offline' ? null : currentReason);
        };
        const handleOffline = () => {
            isOnlineRef.current = false;
            setIsOnline(false);
            setPauseReason('offline');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        let isActive = true;
        setItems([]);
        itemsRef.current = [];
        setLastSummary(null);
        setLastSummaryDismissed(false);
        setCompletedAlbumIds([]);
        setSessionTotalCount(0);
        sessionTotalCountRef.current = 0;
        setCompletedCount(0);
        completedCountRef.current = 0;
        setPauseReason(null);
        setIsHydrating(Boolean(ownerUserId));
        persistenceEnabledRef.current = true;

        if (!ownerUserId) {
            setIsHydrating(false);
            return () => {
                isActive = false;
            };
        }

        void getPersistedAdminUploadQueue(ownerUserId)
            .then((persistedItems) => {
                if (!isActive) {
                    return;
                }

                const hydratedItems = persistedItems.map(fromPersistedItem);
                itemsRef.current = hydratedItems;
                setItems(hydratedItems);
                sessionTotalCountRef.current = hydratedItems.length;
                setSessionTotalCount(hydratedItems.length);
            })
            .catch((error: unknown) => {
                if (!isActive) {
                    return;
                }

                console.warn('Failed to hydrate admin upload queue', error);
                persistenceEnabledRef.current = false;
                setPersistenceWarning(appText.admin.bulkUpload.storageUnavailable);
            })
            .finally(() => {
                if (isActive) {
                    setIsHydrating(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [ownerUserId]);

    const replaceItem = useCallback((itemId: string, updater: (item: QueueItemRecord) => QueueItemRecord): QueueItemRecord | null => {
        const currentItems = itemsRef.current;
        const currentItem = currentItems.find((item) => item.id === itemId);

        if (!currentItem) {
            return null;
        }

        const updatedItem = updater(currentItem);
        const nextItems = currentItems.map((item) => item.id === itemId ? updatedItem : item);
        itemsRef.current = nextItems;
        setItems(nextItems);
        return updatedItem;
    }, []);

    const removeItem = useCallback((itemId: string) => {
        const nextItems = itemsRef.current.filter((item) => item.id !== itemId);
        itemsRef.current = nextItems;
        setItems(nextItems);
    }, []);

    const persistItem = useCallback(async (item: QueueItemRecord) => {
        if (!item.persisted || !persistenceEnabledRef.current) {
            return;
        }

        try {
            await savePersistedAdminUploadQueueItem(toPersistedItem(item));
        } catch (error: unknown) {
            persistenceEnabledRef.current = false;
            console.warn('Failed to persist admin upload queue item', error);
            setPersistenceWarning(appText.admin.bulkUpload.storageUnavailable);
        }
    }, []);

    const processItem = useCallback(async (itemId: string): Promise<QueueProcessResult> => {
        const item = itemsRef.current.find((candidate) => candidate.id === itemId);
        if (!item || !isAdminRef.current) {
            return { status: 'paused' };
        }

        replaceItem(itemId, (currentItem) => ({
            ...currentItem,
            status: 'preparing',
            progress: 0,
            errorMessage: null,
        }));

        try {
            const capturedAt = await extractPhotoCapturedAt(item.file);
            const preparedFile = await preparePhotoFileForUpload(item.file);

            if (preparedFile.size > MAX_PHOTO_FILE_SIZE_BYTES) {
                throw new Error(`Plik przekracza limit ${formatBytes(MAX_PHOTO_FILE_SIZE_BYTES)}.`);
            }

            const contentType = getContentType(preparedFile);
            const lastModifiedAt = new Date(item.lastModified).toISOString();
            const target = await adminClient.createAlbumPhotoUpload(item.albumId, {
                kind: 'photo',
                fileName: preparedFile.name,
                fileSizeBytes: preparedFile.size,
                contentType,
                lastModifiedAt,
                clientUploadId: item.id,
            });

            replaceItem(itemId, (currentItem) => ({
                ...currentItem,
                status: 'uploading',
                progress: 0,
                errorMessage: null,
            }));

            await uploadFileToSignedUrl({
                file: preparedFile,
                uploadUrl: target.uploadUrl,
                headers: {
                    'Content-Type': contentType,
                    'x-ms-blob-type': 'BlockBlob',
                    ...(target.requiredHeaders ?? {}),
                },
                onProgress: (progress) => {
                    replaceItem(itemId, (currentItem) => ({
                        ...currentItem,
                        status: 'uploading',
                        progress,
                    }));
                },
            });

            const completionPayload: CompletePhotoUploadRequest = {
                mediaId: target.mediaId ?? target.photoId,
                photoId: target.photoId,
                kind: 'photo',
                blobName: target.blobName,
                blobUrl: target.blobUrl,
                contentType,
                sizeBytes: preparedFile.size,
                capturedAt: capturedAt ?? undefined,
                lastModifiedAt,
            };

            await adminClient.completeAlbumPhotoUpload(item.albumId, completionPayload);

            if (!isAdminRef.current) {
                return { status: 'paused' };
            }

            const persisted = itemsRef.current.find((candidate) => candidate.id === itemId);

            if (persisted?.persisted) {
                void deletePersistedAdminUploadQueueItem(itemId).catch((error: unknown) => {
                    console.warn('Failed to remove completed admin upload queue item', error);
                });
            }

            removeItem(itemId);
            completedCountRef.current += 1;
            setCompletedCount(completedCountRef.current);
            return { status: 'success', albumId: item.albumId };
        } catch (error: unknown) {
            logErrorDetails(error, 'Admin bulk photo upload failed');

            if (!isOnlineRef.current) {
                replaceItem(itemId, (currentItem) => ({
                    ...currentItem,
                    status: 'queued',
                    progress: 0,
                    errorMessage: null,
                }));
                setPauseReason('offline');
                return { status: 'paused' };
            }

            if (error instanceof ApiError && error.status === 401) {
                replaceItem(itemId, (currentItem) => ({
                    ...currentItem,
                    status: 'queued',
                    progress: 0,
                    errorMessage: null,
                }));
                setPauseReason('session');
                return { status: 'paused' };
            }

            const updatedItem = replaceItem(itemId, (currentItem) => ({
                ...currentItem,
                status: 'error',
                progress: 0,
                errorMessage: getErrorMessageForDisplay(
                    error,
                    appText.admin.bulkUpload.itemFailed,
                ),
            }));

            if (updatedItem) {
                void persistItem(updatedItem);
            }

            return { status: 'error', albumId: item.albumId };
        }
    }, [persistItem, removeItem, replaceItem]);

    const processQueue = useCallback(async () => {
        if (processingRef.current || !isAdminRef.current || !isOnlineRef.current) {
            return;
        }

        processingRef.current = true;
        const pendingIds = new Set<string>();
        const results: QueueProcessResult[] = [];

        const worker = async () => {
            while (isAdminRef.current && isOnlineRef.current) {
                const nextItem = itemsRef.current.find((item) => item.status === 'queued' && !pendingIds.has(item.id));
                if (!nextItem) {
                    return;
                }

                pendingIds.add(nextItem.id);
                const result = await processItem(nextItem.id);
                results.push(result);

                if (result.status === 'paused') {
                    return;
                }
            }
        };

        try {
            await Promise.all(
                Array.from({ length: MAX_PARALLEL_UPLOADS }, () => worker()),
            );
        } finally {
            processingRef.current = false;
        }

        const successfulAlbumIds = [...new Set(
            results
                .filter((result) => result.status === 'success' && result.albumId)
                .map((result) => result.albumId as string),
        )];

        if (successfulAlbumIds.length > 0) {
            invalidateAdminCache('albums');
            invalidateAdminCacheByPrefix('album_media_');
            invalidateAdminCache('overview');
            invalidateCachedApiResourcesByPrefix('gallery_');
            setCompletedAlbumIds(successfulAlbumIds);
            setCompletionVersion((currentVersion) => currentVersion + 1);
        }

        const hasPendingWork = itemsRef.current.some((item) => item.status === 'queued' || item.status === 'preparing' || item.status === 'uploading');
        if (!hasPendingWork && sessionTotalCountRef.current > 0) {
            setLastSummary({
                successfulCount: completedCountRef.current,
                failedCount: itemsRef.current.filter((item) => item.status === 'error').length,
            });
            setLastSummaryDismissed(false);
        }
    }, [processItem]);

    useEffect(() => {
        if (!isAdmin || isHydrating || !isOnline || pauseReason || !items.some((item) => item.status === 'queued')) {
            return;
        }

        void processQueue();
    }, [isAdmin, isHydrating, isOnline, items, pauseReason, processQueue]);

    const enqueueFiles = useCallback(async (albumId: string, files: File[]): Promise<AdminUploadEnqueueResult> => {
        if (!ownerUserId) {
            return {
                addedCount: 0,
                rejectedCount: files.length,
                errors: [appText.errors.auth.accessDenied],
            };
        }

        if (isHydrating) {
            return {
                addedCount: 0,
                rejectedCount: files.length,
                errors: [appText.admin.bulkUpload.queueLoading],
            };
        }

        const currentItems = itemsRef.current;
        const albumItems = currentItems.filter((item) => item.albumId === albumId);
        const currentFingerprints = new Set(albumItems.map((item) => item.fingerprint));
        const errors: string[] = [];
        const accepted: QueueItemRecord[] = [];

        for (const file of files) {
            const fingerprint = getFingerprint(file);

            if (!isPhoto(file)) {
                errors.push(`${file.name}: ${appText.components.mediaUpload.errors.unsupportedFormat}`);
                continue;
            }

            if (file.size <= 0 || file.size > MAX_PHOTO_FILE_SIZE_BYTES) {
                errors.push(`${file.name}: ${appText.components.mediaUpload.errors.tooLarge} ${formatBytes(MAX_PHOTO_FILE_SIZE_BYTES)}.`);
                continue;
            }

            if (currentFingerprints.has(fingerprint) || accepted.some((item) => item.fingerprint === fingerprint)) {
                errors.push(`${file.name}: ${appText.components.mediaUpload.errors.duplicate}`);
                continue;
            }

            currentFingerprints.add(fingerprint);
            accepted.push({
                id: createUuid(),
                albumId,
                file,
                fileName: file.name,
                sizeBytes: file.size,
                status: 'queued',
                progress: 0,
                errorMessage: null,
                createdAt: Date.now(),
                ownerUserId,
                contentType: getContentType(file),
                lastModified: file.lastModified,
                fingerprint,
                persisted: false,
            });
        }

        const availableSlots = Math.max(0, MAX_PHOTOS_PER_ALBUM - albumItems.length);
        const acceptedWithinLimit = accepted.slice(0, availableSlots);

        if (acceptedWithinLimit.length < accepted.length) {
            errors.push(`${appText.admin.bulkUpload.maxPrefix} ${MAX_PHOTOS_PER_ALBUM} ${appText.components.mediaUpload.nouns.photoGenitivePlural} ${appText.admin.bulkUpload.maxSuffix}`);
        }

        let persistedItems = acceptedWithinLimit.map((item) => ({ ...item, persisted: false }));

        if (persistenceEnabledRef.current && acceptedWithinLimit.length > 0) {
            try {
                await savePersistedAdminUploadQueueItems(
                    acceptedWithinLimit.map((item) => toPersistedItem({ ...item, persisted: true })),
                );
                persistedItems = acceptedWithinLimit.map((item) => ({ ...item, persisted: true }));
            } catch (error: unknown) {
                persistenceEnabledRef.current = false;
                console.warn('Failed to persist selected admin upload', error);
                setPersistenceWarning(appText.admin.bulkUpload.storageUnavailable);
            }
        }

        if (persistedItems.length > 0) {
            if (currentItems.length === 0) {
                completedCountRef.current = 0;
                setCompletedCount(0);
                sessionTotalCountRef.current = 0;
                setSessionTotalCount(0);
                setLastSummary(null);
                setLastSummaryDismissed(false);
            }

            const nextItems = [...itemsRef.current, ...persistedItems];
            itemsRef.current = nextItems;
            setItems(nextItems);
            sessionTotalCountRef.current += persistedItems.length;
            setSessionTotalCount(sessionTotalCountRef.current);
        }

        return {
            addedCount: persistedItems.length,
            rejectedCount: files.length - persistedItems.length,
            errors,
        };
    }, [isHydrating, ownerUserId]);

    const retryFailed = useCallback(async (albumId?: string) => {
        const failedItems = itemsRef.current.filter((item) => item.status === 'error' && (!albumId || item.albumId === albumId));
        if (failedItems.length === 0) {
            return;
        }

        setLastSummary(null);
        setLastSummaryDismissed(false);

        for (const item of failedItems) {
            const updatedItem = replaceItem(item.id, (currentItem) => ({
                ...currentItem,
                status: 'queued',
                progress: 0,
                errorMessage: null,
            }));

            if (updatedItem) {
                await persistItem(updatedItem);
            }
        }
    }, [persistItem, replaceItem]);

    const dismissLastSummary = useCallback(() => {
        setLastSummaryDismissed(true);
    }, []);

    const publicItems = useMemo<AdminUploadQueueItem[]>(
        () => items.map(toPublicItem),
        [items],
    );
    const summary = useMemo(
        () => getSummary(items, sessionTotalCount, completedCount),
        [completedCount, items, sessionTotalCount],
    );
    const value = useMemo<AdminUploadQueueContextValue>(() => ({
        items: publicItems,
        summary,
        isHydrating,
        isOnline,
        pauseReason,
        persistenceWarning,
        lastSummary: lastSummaryDismissed ? null : lastSummary,
        completedAlbumIds,
        completionVersion,
        enqueueFiles,
        retryFailed,
        dismissLastSummary,
    }), [completedAlbumIds, completionVersion, dismissLastSummary, enqueueFiles, isHydrating, isOnline, lastSummary, lastSummaryDismissed, pauseReason, persistenceWarning, publicItems, retryFailed, summary]);

    return (
        <AdminUploadQueueContext.Provider value={value}>
            {children}
        </AdminUploadQueueContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminUploadQueue(): AdminUploadQueueContextValue {
    const context = useContext(AdminUploadQueueContext);
    if (!context) {
        throw new Error('useAdminUploadQueue must be used within AdminUploadQueueProvider');
    }

    return context;
}

export { MAX_PHOTOS_PER_ALBUM };
