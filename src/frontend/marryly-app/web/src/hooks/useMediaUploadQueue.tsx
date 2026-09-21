import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../api/client';
import { adminClient } from '../api/adminClient';
import { readAccessTokenClaims } from '../api/accessTokenStorage';
import { uploadFileToSignedUrl } from '../api/photoUploadTransport';
import { appText } from '../content/appText';
import { ApiError, getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { extractPhotoCapturedAt } from '../media/extractPhotoMetadata';
import { extractVideoThumbnail } from '../media/extractVideoThumbnail';
import { preparePhotoFileForUpload } from '../media/preparePhotoFileForUpload';
import { invalidateAdminCache, invalidateAdminCacheByPrefix } from './admin/useAdminApiResource';
import { invalidateCachedApiResourcesByPrefix } from './useCachedApiResource';
import { MAX_BATCH_MEDIA_COUNT } from '../constants/mediaUpload';
import {
    deletePersistedUploadQueueItem,
    getPersistedUploadQueue,
    savePersistedUploadQueueItem,
    savePersistedUploadQueueItems,
    type PersistedUploadQueueItem,
} from '../storage/uploadQueueDb';
import type { CompletePhotoUploadRequest, CreatePhotoUploadRequest, PhotoUploadTarget, UploadMediaKind } from '../types/upload.types';
import type {
    MediaUploadEnqueueResult,
    MediaUploadQueueItem,
    MediaUploadQueueScope,
    MediaUploadQueueSummary,
} from '../types/media-upload.types';

const MAX_PARALLEL_UPLOADS = 2;
const MAX_PHOTO_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const PHOTO_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
const VIDEO_FILE_TYPES = [
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/3gpp',
    'video/3gpp2',
    'video/x-m4v',
];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.3gp', '.3gpp'];

interface QueueProcessResult {
    status: 'success' | 'error' | 'paused';
    albumId?: string;
}

interface QueueItemRecord extends MediaUploadQueueItem {
    ownerUserId: string;
    contentType: string;
    lastModified: number;
    fingerprint: string;
    persisted: boolean;
    preparedFile?: File;
}

interface MediaUploadQueueContextValue {
    activeScope: MediaUploadQueueScope | null;
    items: MediaUploadQueueItem[];
    summary: MediaUploadQueueSummary;
    isHydrating: boolean;
    isOnline: boolean;
    pauseReason: 'offline' | 'session' | null;
    persistenceWarning: string | null;
    lastSummary: { successfulCount: number; failedCount: number } | null;
    completedAlbumIds: string[];
    completionVersion: number;
    enqueueFiles: (
        scope: MediaUploadQueueScope,
        albumId: string | null,
        files: File[],
        acceptedKinds: UploadMediaKind[],
    ) => Promise<MediaUploadEnqueueResult>;
    retryFailed: (scope: MediaUploadQueueScope, itemId?: string, albumId?: string) => Promise<void>;
    dismissLastSummary: () => void;
}

const EMPTY_SUMMARY: MediaUploadQueueSummary = {
    totalCount: 0,
    completedCount: 0,
    activeCount: 0,
    queuedCount: 0,
    failedCount: 0,
};

const MediaUploadQueueContext = createContext<MediaUploadQueueContextValue | null>(null);

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
        case '.mp4':
            return 'video/mp4';
        case '.mov':
            return 'video/quicktime';
        case '.m4v':
            return 'video/x-m4v';
        case '.webm':
            return 'video/webm';
        case '.3gp':
        case '.3gpp':
            return 'video/3gpp';
        default:
            return 'application/octet-stream';
    }
}

function getMediaKind(file: File): UploadMediaKind | null {
    const contentType = getContentType(file).toLowerCase();
    const extension = getExtension(file.name);

    if (PHOTO_FILE_TYPES.includes(contentType) || PHOTO_EXTENSIONS.includes(extension)) {
        return 'photo';
    }

    if (VIDEO_FILE_TYPES.includes(contentType) || VIDEO_EXTENSIONS.includes(extension)) {
        return 'video';
    }

    return null;
}

function getMaxFileSizeBytes(kind: UploadMediaKind): number | null {
    return kind === 'video' ? null : MAX_PHOTO_FILE_SIZE_BYTES;
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

function getFingerprint(file: File, kind: UploadMediaKind): string {
    return `${kind}\u0000${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

function getPersistedScope(item: PersistedUploadQueueItem): MediaUploadQueueScope {
    return item.scope === 'guest' ? 'guest' : 'admin';
}

function toPersistedItem(item: QueueItemRecord): PersistedUploadQueueItem {
    return {
        id: item.id,
        ownerUserId: item.ownerUserId,
        scope: item.scope,
        albumId: item.albumId,
        file: item.file,
        fileName: item.fileName,
        kind: item.kind,
        contentType: item.contentType,
        sizeBytes: item.sizeBytes,
        lastModified: item.lastModified,
        fingerprint: item.fingerprint,
        status: item.status,
        errorMessage: item.errorMessage,
        createdAt: item.createdAt,
    };
}

function fromPersistedItem(item: PersistedUploadQueueItem): QueueItemRecord {
    const file = item.file instanceof File
        ? item.file
        : new File([item.file], item.fileName, {
            type: item.contentType,
            lastModified: item.lastModified,
        });
    const scope = getPersistedScope(item);
    const hasPersistedKind = item.kind === 'photo' || item.kind === 'video';
    const kind = item.kind === 'video' ? 'video' : 'photo';

    return {
        id: item.id,
        scope,
        albumId: scope === 'admin' ? item.albumId ?? null : null,
        file,
        fileName: item.fileName,
        kind,
        sizeBytes: item.sizeBytes,
        status: item.status === 'error' ? 'error' : 'queued',
        progress: 0,
        errorMessage: item.status === 'error' ? item.errorMessage : null,
        createdAt: item.createdAt,
        ownerUserId: item.ownerUserId,
        contentType: item.contentType,
        lastModified: item.lastModified,
        fingerprint: hasPersistedKind && item.fingerprint
            ? item.fingerprint
            : getFingerprint(file, kind),
        persisted: true,
    };
}

function getSummary(
    items: QueueItemRecord[],
    sessionTotalCount: number,
    completedCount: number,
): MediaUploadQueueSummary {
    return {
        totalCount: Math.max(sessionTotalCount, items.length + completedCount),
        completedCount,
        activeCount: items.filter((item) => item.status === 'preparing' || item.status === 'uploading').length,
        queuedCount: items.filter((item) => item.status === 'queued').length,
        failedCount: items.filter((item) => item.status === 'error').length,
    };
}

function toPublicItem(item: QueueItemRecord): MediaUploadQueueItem {
    return {
        id: item.id,
        scope: item.scope,
        albumId: item.albumId,
        file: item.file,
        fileName: item.fileName,
        kind: item.kind,
        sizeBytes: item.sizeBytes,
        status: item.status,
        progress: item.progress,
        errorMessage: item.errorMessage,
        createdAt: item.createdAt,
    };
}

function getAllowedDescription(acceptedKinds: UploadMediaKind[]): string {
    if (acceptedKinds.length === 1 && acceptedKinds[0] === 'photo') {
        return appText.components.mediaUpload.nouns.photoGenitivePlural;
    }

    if (acceptedKinds.length === 1 && acceptedKinds[0] === 'video') {
        return appText.components.mediaUpload.nouns.videoGenitivePlural;
    }

    return appText.components.mediaUpload.nouns.photoAndVideoGenitivePlural;
}

function getErrorForRejectedFile(file: File, acceptedKinds: UploadMediaKind[]): string | null {
    const kind = getMediaKind(file);
    if (!kind || !acceptedKinds.includes(kind)) {
        return `${file.name}: ${appText.components.mediaUpload.errors.unsupportedFormat}`;
    }

    const maxFileSizeBytes = getMaxFileSizeBytes(kind);
    if (file.size <= 0) {
        return `${file.name}: ${appText.components.mediaUpload.errors.unsupportedFormat}`;
    }

    if (maxFileSizeBytes !== null && file.size > maxFileSizeBytes) {
        return `${file.name}: ${appText.components.mediaUpload.errors.tooLarge} ${formatBytes(maxFileSizeBytes)}.`;
    }

    return null;
}

export function MediaUploadQueueProvider({ children }: { children: ReactNode }) {
    const { isAdmin, isAuthenticated, user } = useAuth();
    const activeScope: MediaUploadQueueScope | null = isAuthenticated && user
        ? (isAdmin ? 'admin' : 'guest')
        : null;
    const ownerUserId = user
        ? isAdmin
            ? user.id
            : `guest:${readAccessTokenClaims()?.eventId ?? 'current-event'}`
        : null;
    const [items, setItems] = useState<QueueItemRecord[]>([]);
    const itemsRef = useRef<QueueItemRecord[]>([]);
    const [isHydrating, setIsHydrating] = useState(false);
    const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
    const isOnlineRef = useRef(isOnline);
    const isAuthenticatedRef = useRef(isAuthenticated);
    const activeScopeRef = useRef(activeScope);
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
        isOnlineRef.current = isOnline;
    }, [isOnline]);

    useEffect(() => {
        isAuthenticatedRef.current = isAuthenticated;
        activeScopeRef.current = activeScope;
    }, [activeScope, isAuthenticated]);

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
        setPersistenceWarning(null);
        setIsHydrating(Boolean(ownerUserId && activeScope));
        persistenceEnabledRef.current = true;

        if (!ownerUserId || !activeScope) {
            setIsHydrating(false);
            return () => {
                isActive = false;
            };
        }

        void getPersistedUploadQueue(ownerUserId)
            .then((persistedItems) => {
                if (!isActive) {
                    return;
                }

                const hydratedItems = persistedItems
                    .filter((item) => getPersistedScope(item) === activeScope)
                    .map(fromPersistedItem);
                itemsRef.current = hydratedItems;
                setItems(hydratedItems);
                sessionTotalCountRef.current = hydratedItems.length;
                setSessionTotalCount(hydratedItems.length);
            })
            .catch((error: unknown) => {
                if (!isActive) {
                    return;
                }

                console.warn('Failed to hydrate media upload queue', error);
                persistenceEnabledRef.current = false;
                setPersistenceWarning(appText.components.mediaUpload.errors.persistenceUnavailable);
            })
            .finally(() => {
                if (isActive) {
                    setIsHydrating(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [activeScope, ownerUserId]);

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
            await savePersistedUploadQueueItem(toPersistedItem(item));
        } catch (error: unknown) {
            persistenceEnabledRef.current = false;
            console.warn('Failed to persist media upload queue item', error);
            setPersistenceWarning(appText.components.mediaUpload.errors.persistenceUnavailable);
        }
    }, []);

    const createUploadTarget = useCallback((item: QueueItemRecord, request: CreatePhotoUploadRequest): Promise<PhotoUploadTarget> => {
        if (item.scope === 'admin') {
            if (!item.albumId) {
                return Promise.reject(new Error('Album is required for an admin upload.'));
            }

            return adminClient.createAlbumPhotoUpload(item.albumId, request);
        }

        return apiClient.createMediaUpload(request);
    }, []);

    const completeUpload = useCallback((item: QueueItemRecord, payload: CompletePhotoUploadRequest): Promise<void> => {
        if (item.scope === 'admin') {
            if (!item.albumId) {
                return Promise.reject(new Error('Album is required for an admin upload.'));
            }

            return adminClient.completeAlbumPhotoUpload(item.albumId, payload);
        }

        return apiClient.completeMediaUpload(payload);
    }, []);

    const uploadVideoThumbnail = useCallback((item: QueueItemRecord, mediaId: string, thumbnail: File): Promise<void> => {
        return item.scope === 'admin'
            ? adminClient.uploadVideoThumbnail(mediaId, thumbnail)
            : apiClient.uploadVideoThumbnail(mediaId, thumbnail);
    }, []);

    const processItem = useCallback(async (itemId: string): Promise<QueueProcessResult> => {
        const item = itemsRef.current.find((candidate) => candidate.id === itemId);
        if (!item || item.scope !== activeScopeRef.current || !isAuthenticatedRef.current) {
            return { status: 'paused' };
        }

        replaceItem(itemId, (currentItem) => ({
            ...currentItem,
            status: 'preparing',
            progress: 0,
            errorMessage: null,
        }));

        try {
            const capturedAt = item.kind === 'photo'
                ? await extractPhotoCapturedAt(item.file)
                : null;
            const preparedFile = item.preparedFile ?? (item.kind === 'photo'
                ? await preparePhotoFileForUpload(item.file)
                : item.file);
            const videoThumbnail = item.kind === 'video'
                ? await extractVideoThumbnail(preparedFile, preparedFile.name)
                : null;
            const maxFileSizeBytes = getMaxFileSizeBytes(item.kind);

            if (maxFileSizeBytes !== null && preparedFile.size > maxFileSizeBytes) {
                throw new Error(`Plik przekracza limit ${formatBytes(maxFileSizeBytes)}.`);
            }

            if (preparedFile !== item.preparedFile) {
                replaceItem(itemId, (currentItem) => ({
                    ...currentItem,
                    preparedFile,
                }));
            }

            const contentType = getContentType(preparedFile);
            const lastModifiedAt = new Date(item.lastModified).toISOString();
            const target = await createUploadTarget(item, {
                kind: item.kind,
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

            await completeUpload(item, {
                mediaId: target.mediaId ?? target.photoId,
                photoId: target.photoId,
                kind: target.kind ?? item.kind,
                blobName: target.blobName,
                blobUrl: target.blobUrl,
                contentType,
                sizeBytes: preparedFile.size,
                capturedAt: capturedAt ?? undefined,
                lastModifiedAt,
            });

            if (videoThumbnail) {
                await uploadVideoThumbnail(item, target.mediaId ?? target.photoId, videoThumbnail);
            }

            if (item.scope !== activeScopeRef.current || !isAuthenticatedRef.current) {
                return { status: 'paused', albumId: item.albumId ?? undefined };
            }

            const persisted = itemsRef.current.find((candidate) => candidate.id === itemId);
            if (persisted?.persisted) {
                void deletePersistedUploadQueueItem(itemId).catch((error: unknown) => {
                    console.warn('Failed to remove completed media upload queue item', error);
                });
            }

            removeItem(itemId);
            completedCountRef.current += 1;
            setCompletedCount(completedCountRef.current);
            return { status: 'success', albumId: item.albumId ?? undefined };
        } catch (error: unknown) {
            logErrorDetails(error, `${item.scope === 'admin' ? 'Admin' : 'Guest'} bulk media upload failed`);

            if (!isOnlineRef.current) {
                replaceItem(itemId, (currentItem) => ({
                    ...currentItem,
                    status: 'queued',
                    progress: 0,
                    errorMessage: null,
                }));
                setPauseReason('offline');
                return { status: 'paused', albumId: item.albumId ?? undefined };
            }

            if (error instanceof ApiError && error.status === 401) {
                replaceItem(itemId, (currentItem) => ({
                    ...currentItem,
                    status: 'queued',
                    progress: 0,
                    errorMessage: null,
                }));
                setPauseReason('session');
                return { status: 'paused', albumId: item.albumId ?? undefined };
            }

            const updatedItem = replaceItem(itemId, (currentItem) => ({
                ...currentItem,
                status: 'error',
                progress: 0,
                errorMessage: getErrorMessageForDisplay(
                    error,
                    item.scope === 'admin'
                        ? appText.admin.bulkUpload.itemFailed
                        : `${appText.components.mediaUpload.errors.uploadOne} ${item.kind === 'photo' ? appText.common.media.photoLower : appText.common.media.videoLower}. ${appText.components.mediaUpload.errors.tryAgain}`,
                ),
            }));

            if (updatedItem) {
                void persistItem(updatedItem);
            }

            return { status: 'error', albumId: item.albumId ?? undefined };
        }
    }, [completeUpload, createUploadTarget, persistItem, removeItem, replaceItem, uploadVideoThumbnail]);

    const processQueue = useCallback(async () => {
        if (processingRef.current || !activeScopeRef.current || !isAuthenticatedRef.current || !isOnlineRef.current) {
            return;
        }

        processingRef.current = true;
        const pendingIds = new Set<string>();
        const results: QueueProcessResult[] = [];

        const worker = async () => {
            while (activeScopeRef.current && isAuthenticatedRef.current && isOnlineRef.current) {
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
        const hasSuccessfulUpload = results.some((result) => result.status === 'success');

        if (successfulAlbumIds.length > 0) {
            invalidateAdminCache('albums');
            invalidateAdminCacheByPrefix('album_media_');
            invalidateAdminCache('overview');
            setCompletedAlbumIds(successfulAlbumIds);
            setCompletionVersion((currentVersion) => currentVersion + 1);
        }

        if (hasSuccessfulUpload) {
            invalidateCachedApiResourcesByPrefix('gallery_');
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
        if (isHydrating || !activeScope || !isOnline || pauseReason || !items.some((item) => item.status === 'queued')) {
            return;
        }

        void processQueue();
    }, [activeScope, isHydrating, isOnline, items, pauseReason, processQueue]);

    const enqueueFiles = useCallback(async (
        scope: MediaUploadQueueScope,
        albumId: string | null,
        files: File[],
        acceptedKinds: UploadMediaKind[],
    ): Promise<MediaUploadEnqueueResult> => {
        if (!ownerUserId || activeScope !== scope) {
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
                errors: [appText.components.mediaUpload.errors.queueLoading],
            };
        }

        const currentItems = itemsRef.current;
        const scopeItems = currentItems.filter((item) => item.scope === scope);
        const queueItems = scope === 'admin'
            ? scopeItems.filter((item) => item.albumId === albumId)
            : scopeItems;
        const currentFingerprints = new Set(queueItems.map((item) => item.fingerprint));
        const errors: string[] = [];
        const accepted: QueueItemRecord[] = [];

        for (const file of files) {
            const kind = getMediaKind(file);
            const validationError = getErrorForRejectedFile(file, acceptedKinds);

            if (validationError) {
                errors.push(validationError);
                continue;
            }

            if (!kind) {
                continue;
            }

            const fingerprint = getFingerprint(file, kind);
            if (currentFingerprints.has(fingerprint) || accepted.some((item) => item.fingerprint === fingerprint)) {
                errors.push(`${file.name}: ${appText.components.mediaUpload.errors.duplicate}`);
                continue;
            }

            currentFingerprints.add(fingerprint);
            accepted.push({
                id: createUuid(),
                scope,
                albumId: scope === 'admin' ? albumId : null,
                file,
                fileName: file.name,
                kind,
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

        const availableSlots = Math.max(0, MAX_BATCH_MEDIA_COUNT - queueItems.length);
        const acceptedWithinLimit = accepted.slice(0, availableSlots);

        if (acceptedWithinLimit.length < accepted.length) {
            const maxPrefix = scope === 'admin'
                ? appText.admin.bulkUpload.maxPrefix
                : appText.components.mediaUpload.errors.maxBatchPrefix;
            const maxSuffix = scope === 'admin'
                ? appText.admin.bulkUpload.maxSuffix
                : appText.components.mediaUpload.errors.maxBatchSuffix;
            errors.push(`${maxPrefix} ${MAX_BATCH_MEDIA_COUNT} ${scope === 'admin' ? appText.components.mediaUpload.nouns.photoGenitivePlural : getAllowedDescription(acceptedKinds)} ${maxSuffix}`);
        }

        let persistedItems = acceptedWithinLimit.map((item) => ({ ...item, persisted: false }));

        if (persistenceEnabledRef.current && acceptedWithinLimit.length > 0) {
            try {
                await savePersistedUploadQueueItems(
                    acceptedWithinLimit.map((item) => toPersistedItem({ ...item, persisted: true })),
                );
                persistedItems = acceptedWithinLimit.map((item) => ({ ...item, persisted: true }));
            } catch (error: unknown) {
                persistenceEnabledRef.current = false;
                console.warn('Failed to persist selected media upload', error);
                setPersistenceWarning(appText.components.mediaUpload.errors.persistenceUnavailable);
            }
        }

        if (persistedItems.length > 0) {
            setLastSummary(null);
            setLastSummaryDismissed(false);

            if (currentItems.length === 0) {
                completedCountRef.current = 0;
                setCompletedCount(0);
                sessionTotalCountRef.current = 0;
                setSessionTotalCount(0);
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
    }, [activeScope, isHydrating, ownerUserId]);

    const retryFailed = useCallback(async (scope: MediaUploadQueueScope, itemId?: string, albumId?: string) => {
        const failedItems = itemsRef.current.filter((item) =>
            item.scope === scope &&
            item.status === 'error' &&
            (!itemId || item.id === itemId) &&
            (!albumId || item.albumId === albumId));

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

    const publicItems = useMemo(() => items.map(toPublicItem), [items]);
    const summary = useMemo(
        () => getSummary(items, sessionTotalCount, completedCount),
        [completedCount, items, sessionTotalCount],
    );
    const value = useMemo<MediaUploadQueueContextValue>(() => ({
        activeScope,
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
    }), [activeScope, completedAlbumIds, completionVersion, dismissLastSummary, enqueueFiles, isHydrating, isOnline, lastSummary, lastSummaryDismissed, pauseReason, persistenceWarning, publicItems, retryFailed, summary]);

    return (
        <MediaUploadQueueContext.Provider value={value}>
            {children}
        </MediaUploadQueueContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMediaUploadQueue(): MediaUploadQueueContextValue {
    const context = useContext(MediaUploadQueueContext);
    if (!context) {
        throw new Error('useMediaUploadQueue must be used within MediaUploadQueueProvider');
    }

    return context;
}

export interface GuestUploadQueueItem extends MediaUploadQueueItem {
    scope: 'guest';
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGuestUploadQueue() {
    const queue = useMediaUploadQueue();
    const items = queue.activeScope === 'guest'
        ? queue.items.filter((item): item is GuestUploadQueueItem => item.scope === 'guest')
        : [];
    const summary = queue.activeScope === 'guest' ? queue.summary : EMPTY_SUMMARY;

    const enqueueFiles = (files: File[], acceptedKinds: UploadMediaKind[]) =>
        queue.enqueueFiles('guest', null, files, acceptedKinds);
    const retryFailed = (itemId?: string) => queue.retryFailed('guest', itemId);

    return {
        ...queue,
        items,
        summary,
        lastSummary: queue.activeScope === 'guest' ? queue.lastSummary : null,
        enqueueFiles,
        retryFailed,
    };
}
