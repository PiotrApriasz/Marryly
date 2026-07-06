import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { uploadFileToSignedUrl } from '../api/photoUploadTransport';
import type { CompletePhotoUploadRequest, CreatePhotoUploadRequest, PhotoUploadTarget } from '../types/upload.types';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { preparePhotoFileForUpload } from '../media/preparePhotoFileForUpload';
import ApiErrorAlert from './ApiErrorAlert';
import Button from './Button';
import Card from './Card';
import Notice from './Notice';
import { cn } from '../utils/cn';

type UploadStatus = 'queued' | 'preparing' | 'uploading' | 'success' | 'error';
type UploadMediaKind = 'photo' | 'video';

interface UploadQueueItem {
    id: string;
    file: File;
    kind: UploadMediaKind;
    preparedFile?: File;
    status: UploadStatus;
    progress: number;
    errorMessage: string | null;
    blobUrl?: string;
}

type UploadSingleResult = 'success' | 'error' | 'skipped';

interface UploadProgressSummary {
    activeItems: UploadQueueItem[];
    currentItem: UploadQueueItem | null;
    completedCount: number;
    totalCount: number;
    totalProgress: number;
}

interface PhotoUploadPanelProps {
    onCreateUpload: (payload: CreatePhotoUploadRequest) => Promise<PhotoUploadTarget>;
    onCompleteUpload: (payload: CompletePhotoUploadRequest) => Promise<void>;
    onAfterUpload?: (summary: { successfulItemsCount: number; failedItemsCount: number }) => void;
    addButtonLabel?: string;
    addButtonDescription?: string;
    successTitle?: string;
    acceptedKinds?: UploadMediaKind[];
}

const MAX_FILES_PER_BATCH = 20;
const MAX_PHOTO_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_PARALLEL_UPLOADS = 2;
const PHOTO_FILE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
];
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

function createQueueItemId(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`;
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

function getExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');

    if (dotIndex < 0) {
        return '';
    }

    return fileName.slice(dotIndex).toLowerCase();
}

function getNormalizedContentType(file: File): string {
    if (file.type) {
        return file.type;
    }

    const extension = getExtension(file.name);

    switch (extension) {
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
    const extension = getExtension(file.name);

    if (PHOTO_FILE_TYPES.includes(file.type) || PHOTO_EXTENSIONS.includes(extension)) {
        return 'photo';
    }

    if (VIDEO_FILE_TYPES.includes(file.type) || VIDEO_EXTENSIONS.includes(extension)) {
        return 'video';
    }

    return null;
}

function getMaxFileSizeBytes(kind: UploadMediaKind): number {
    return kind === 'video' ? MAX_VIDEO_FILE_SIZE_BYTES : MAX_PHOTO_FILE_SIZE_BYTES;
}

function getAcceptedInputValue(acceptedKinds: UploadMediaKind[]): string {
    const acceptedValues = new Set<string>();

    if (acceptedKinds.includes('photo')) {
        ['image/*', ...PHOTO_FILE_TYPES, ...PHOTO_EXTENSIONS].forEach((value) => acceptedValues.add(value));
    }

    if (acceptedKinds.includes('video')) {
        ['video/*', ...VIDEO_FILE_TYPES, ...VIDEO_EXTENSIONS].forEach((value) => acceptedValues.add(value));
    }

    return [...acceptedValues].join(',');
}

function isAcceptedMediaKind(kind: UploadMediaKind, acceptedKinds: UploadMediaKind[]): boolean {
    return acceptedKinds.includes(kind);
}

async function prepareFileForUpload(file: File, kind: UploadMediaKind): Promise<File> {
    if (kind === 'photo') {
        return preparePhotoFileForUpload(file);
    }

    return file;
}

function getGenericMediaNoun(count: number): string {
    if (count === 1) {
        return 'plik';
    }

    const remainderTen = count % 10;
    const remainderHundred = count % 100;

    return remainderTen >= 2 && remainderTen <= 4 && (remainderHundred < 12 || remainderHundred > 14)
        ? 'pliki'
        : 'plików';
}

function getKindLabel(kind: UploadMediaKind): string {
    return kind === 'video' ? 'film' : 'zdjęcie';
}

function getAllowedDescription(acceptedKinds: UploadMediaKind[]): string {
    if (acceptedKinds.length === 1 && acceptedKinds[0] === 'photo') {
        return 'zdjęć';
    }

    if (acceptedKinds.length === 1 && acceptedKinds[0] === 'video') {
        return 'filmów';
    }

    return 'zdjęć i filmów';
}

function shouldAcceptFile(file: File, acceptedKinds: UploadMediaKind[]): UploadMediaKind | null {
    const kind = getMediaKind(file);
    if (!kind || !isAcceptedMediaKind(kind, acceptedKinds)) {
        return null;
    }

    return kind;
}

function isPhotoOnly(acceptedKinds: UploadMediaKind[]): boolean {
    return acceptedKinds.length === 1 && acceptedKinds[0] === 'photo';
}

function getSuccessMessage(successfulItemsCount: number, failedItemsCount: number, acceptedKinds: UploadMediaKind[]): string {
    if (isPhotoOnly(acceptedKinds)) {
        if (failedItemsCount === 0) {
            return successfulItemsCount === 1
                ? 'Zdjęcie zostało wysłane. Możesz dodać kolejne.'
                : `Pomyślnie wysłano ${successfulItemsCount} ${getPluralForm(successfulItemsCount, 'zdjęcie', 'zdjęcia', 'zdjęć')}. Możesz dodać kolejne.`;
        }

        return `Pomyślnie wysłano ${successfulItemsCount} ${getPluralForm(successfulItemsCount, 'zdjęcie', 'zdjęcia', 'zdjęć')}. Sprawdź pozostałe.`;
    }

    if (failedItemsCount === 0) {
        return successfulItemsCount === 1
            ? 'Plik został wysłany. Możesz dodać kolejne zdjęcia lub filmy.'
            : `Pomyślnie wysłano ${successfulItemsCount} ${getGenericMediaNoun(successfulItemsCount)}. Możesz dodać kolejne.`;
    }

    return `Pomyślnie wysłano ${successfulItemsCount} ${getGenericMediaNoun(successfulItemsCount)}. Sprawdź pozostałe.`;
}

function getFailureMessage(failedItemsCount: number, acceptedKinds: UploadMediaKind[]): string {
    if (isPhotoOnly(acceptedKinds)) {
        return `Nie udało się wysłać ${failedItemsCount} ${getPluralForm(failedItemsCount, 'zdjęcia', 'zdjęć', 'zdjęć')}. Spróbuj ponownie.`;
    }

    return `Nie udało się wysłać ${failedItemsCount} ${getGenericMediaNoun(failedItemsCount)}. Spróbuj ponownie.`;
}

function getPluralForm(count: number, singular: string, paucal: string, plural: string): string {
    const remainderTen = count % 10;
    const remainderHundred = count % 100;

    if (count === 1) {
        return singular;
    }

    if (remainderTen >= 2 && remainderTen <= 4 && (remainderHundred < 12 || remainderHundred > 14)) {
        return paucal;
    }

    return plural;
}

function getStatusLabel(status: UploadStatus): string {
    switch (status) {
        case 'queued':
            return 'Gotowe do wysłania';
        case 'preparing':
            return 'Przygotowywanie uploadu';
        case 'uploading':
            return 'Wysyłanie';
        case 'success':
            return 'Wysłane';
        case 'error':
            return 'Błąd';
        default:
            return '';
    }
}

function getStatusClasses(status: UploadStatus): string {
    switch (status) {
        case 'success':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        case 'error':
            return 'border-rose-200 bg-rose-50 text-rose-700';
        case 'uploading':
        case 'preparing':
            return 'border-amber-200 bg-amber-50 text-amber-700';
        case 'queued':
        default:
            return 'border-sand bg-sand/50 text-ink';
    }
}

function normalizeProgress(percent: number): number {
    if (!Number.isFinite(percent)) {
        return 0;
    }

    return Math.min(100, Math.max(0, Math.round(percent)));
}

function getUploadProgressSummary(items: UploadQueueItem[]): UploadProgressSummary {
    const activeItems = items.filter((item) => item.status !== 'error');
    const totalCount = activeItems.length;
    const completedCount = activeItems.filter((item) => item.status === 'success').length;
    const currentItem = activeItems.find((item) => item.status === 'uploading') ??
        activeItems.find((item) => item.status === 'preparing') ??
        activeItems.find((item) => item.status === 'queued') ??
        null;

    if (totalCount === 0) {
        return {
            activeItems,
            currentItem,
            completedCount: 0,
            totalCount: 0,
            totalProgress: 0,
        };
    }

    const progressSum = activeItems.reduce((sum, item) => {
        if (item.status === 'success') {
            return sum + 100;
        }

        return sum + normalizeProgress(item.progress);
    }, 0);

    return {
        activeItems,
        currentItem,
        completedCount,
        totalCount,
        totalProgress: normalizeProgress(progressSum / totalCount),
    };
}

function getOverlayTitle(summary: UploadProgressSummary): string {
    if (summary.currentItem?.status === 'preparing') {
        return 'Przygotowujemy pliki do wysłania';
    }

    if (summary.currentItem?.status === 'uploading') {
        return 'Przesyłamy media';
    }

    return 'Kończymy zapis';
}

function UploadProgressOverlay({ items }: { items: UploadQueueItem[] }) {
    const summary = getUploadProgressSummary(items);
    const visibleItems = summary.activeItems.slice(0, 4);
    const hiddenItemsCount = Math.max(0, summary.activeItems.length - visibleItems.length);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4 py-8 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="w-full max-w-lg rounded-2xl bg-paper p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="font-serif text-2xl text-ink">
                            {getOverlayTitle(summary)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Nie odświeżaj strony ani nie zamykaj karty. Po zakończeniu dostaniesz potwierdzenie.
                        </p>
                    </div>
                    <div className="shrink-0 rounded-full bg-gold/10 px-3 py-2 font-sans text-sm font-semibold text-gold">
                        {summary.totalProgress}%
                    </div>
                </div>

                <div className="mt-6">
                    <div className="h-3 overflow-hidden rounded-full bg-sand">
                        <div
                            className="h-full rounded-full bg-gold transition-[width] duration-300"
                            style={{ width: `${summary.totalProgress}%` }}
                        />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                        <span>
                            {summary.completedCount} z {summary.totalCount} zakończone
                        </span>
                        {summary.currentItem ? (
                            <span className="max-w-full truncate">
                                Teraz: {summary.currentItem.file.name}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="mt-6 space-y-3">
                    {visibleItems.map((item) => {
                        const progress = item.status === 'success' ? 100 : normalizeProgress(item.progress);

                        return (
                            <div key={item.id} className="rounded-xl border border-sand bg-white/65 p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-ink">
                                            {item.file.name}
                                        </p>
                                        <p className="mt-1 text-xs text-muted">
                                            {getStatusLabel(item.status)} • {formatBytes(item.preparedFile?.size ?? item.file.size)}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-xs font-semibold text-muted">
                                        {progress}%
                                    </span>
                                </div>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand/80">
                                    <div
                                        className="h-full rounded-full bg-gold transition-[width] duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}

                    {hiddenItemsCount > 0 ? (
                        <p className="text-center text-xs text-muted">
                            I jeszcze {hiddenItemsCount} w kolejce.
                        </p>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default function PhotoUploadPanel({
    onCreateUpload,
    onCompleteUpload,
    onAfterUpload,
    addButtonLabel = 'Dodaj zdjęcia',
    addButtonDescription = 'Otworzy aparat lub galerię w telefonie.',
    successTitle = 'Zdjęcia zapisane',
    acceptedKinds = ['photo', 'video'],
}: PhotoUploadPanelProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const autoUploadInFlightRef = useRef(false);
    const [items, setItems] = useState<UploadQueueItem[]>([]);
    const itemsRef = useRef<UploadQueueItem[]>([]);
    const [selectionError, setSelectionError] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
    const [isUploadOverlayVisible, setIsUploadOverlayVisible] = useState(false);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    const hasActiveUpload = items.some((item) => item.status === 'preparing' || item.status === 'uploading');
    const queuedCount = items.filter((item) => item.status === 'queued').length;
    const hasErroredItems = items.some((item) => item.status === 'error');
    const shouldShowUploadOverlay = isUploadOverlayVisible || hasActiveUpload;

    useEffect(() => {
        if (!shouldShowUploadOverlay) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [shouldShowUploadOverlay]);

    useEffect(() => {
        if (!shouldShowUploadOverlay) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [shouldShowUploadOverlay]);

    const summarizeUploadResult = (successfulItemsCount: number, failedItemsCount: number) => {
        if (successfulItemsCount > 0) {
            setUploadSuccessMessage(getSuccessMessage(successfulItemsCount, failedItemsCount, acceptedKinds));
        } else {
            setUploadSuccessMessage(null);
        }

        if (failedItemsCount > 0) {
            setUploadError(getFailureMessage(failedItemsCount, acceptedKinds));
        } else {
            setUploadError(null);
        }
    };

    const finalizeBatch = (itemIds: string[], results: UploadSingleResult[]) => {
        const ids = new Set(itemIds);
        const successfulItemsCount = results.filter((result) => result === 'success').length;
        const failedItemsCount = results.filter((result) => result === 'error').length;

        setItems((currentItems) =>
            currentItems.filter((item) => !ids.has(item.id) || item.status === 'error')
        );

        summarizeUploadResult(successfulItemsCount, failedItemsCount);
        onAfterUpload?.({ successfulItemsCount, failedItemsCount });
    };

    const processQueuedUploads = useEffectEvent(async (queuedIds: string[]) => {
        const results = await runUploadQueue(queuedIds);
        finalizeBatch(queuedIds, results);
    });

    useEffect(() => {
        if (hasActiveUpload || queuedCount === 0 || autoUploadInFlightRef.current) {
            return;
        }

        autoUploadInFlightRef.current = true;
        setUploadError(null);
        setUploadSuccessMessage(null);
        setIsUploadOverlayVisible(true);
        const queuedIds = items
            .filter((item) => item.status === 'queued')
            .map((item) => item.id);

        void processQueuedUploads(queuedIds)
            .finally(() => {
                autoUploadInFlightRef.current = false;
                setIsUploadOverlayVisible(false);
            });
    }, [hasActiveUpload, items, queuedCount]);

    const updateItem = (itemId: string, updater: (item: UploadQueueItem) => UploadQueueItem) => {
        setItems((currentItems) =>
            currentItems.map((item) => (item.id === itemId ? updater(item) : item))
        );
    };

    const uploadSingleItem = async (itemId: string): Promise<UploadSingleResult> => {
        const item = itemsRef.current.find((candidate) => candidate.id === itemId);

        if (!item || item.status === 'success') {
            return 'skipped';
        }

        updateItem(itemId, (currentItem) => ({
            ...currentItem,
            status: 'preparing',
            progress: 0,
            errorMessage: null,
        }));

        try {
            const preparedFile = item.preparedFile ?? await prepareFileForUpload(item.file, item.kind);
            const maxFileSizeBytes = getMaxFileSizeBytes(item.kind);

            if (preparedFile.size > maxFileSizeBytes) {
                throw new Error(`Plik przekracza limit ${formatBytes(maxFileSizeBytes)}.`);
            }

            if (preparedFile !== item.preparedFile) {
                updateItem(itemId, (currentItem) => ({
                    ...currentItem,
                    preparedFile,
                }));
            }

            const target = await onCreateUpload({
                kind: item.kind,
                fileName: preparedFile.name,
                fileSizeBytes: preparedFile.size,
                contentType: getNormalizedContentType(preparedFile),
                lastModifiedAt: new Date(preparedFile.lastModified).toISOString(),
            });

            updateItem(itemId, (currentItem) => ({
                ...currentItem,
                status: 'uploading',
                progress: 0,
                errorMessage: null,
            }));

            await uploadFileToSignedUrl({
                file: preparedFile,
                uploadUrl: target.uploadUrl,
                headers: {
                    'Content-Type': getNormalizedContentType(preparedFile),
                    'x-ms-blob-type': 'BlockBlob',
                    ...(target.requiredHeaders ?? {}),
                },
                onProgress: (progressPercent) => {
                    updateItem(itemId, (currentItem) => ({
                        ...currentItem,
                        status: 'uploading',
                        progress: progressPercent,
                    }));
                },
            });

            await onCompleteUpload({
                mediaId: target.mediaId ?? target.photoId,
                photoId: target.photoId,
                kind: target.kind ?? item.kind,
                blobName: target.blobName,
                blobUrl: target.blobUrl,
                contentType: getNormalizedContentType(preparedFile),
                sizeBytes: preparedFile.size,
            });

            updateItem(itemId, (currentItem) => ({
                ...currentItem,
                status: 'success',
                progress: 100,
                errorMessage: null,
                blobUrl: target.blobUrl,
            }));

            return 'success';
        } catch (error) {
            logErrorDetails(error, 'Media upload failed');

            updateItem(itemId, (currentItem) => ({
                ...currentItem,
                status: 'error',
                progress: 0,
                errorMessage: getErrorMessageForDisplay(error, `Nie udało się wysłać ${getKindLabel(item.kind)}. Spróbuj ponownie.`),
            }));

            return 'error';
        }
    };

    const runUploadQueue = async (itemIds: string[]) => {
        const pendingIds = [...itemIds];
        const results: UploadSingleResult[] = [];

        const worker = async () => {
            while (pendingIds.length > 0) {
                const nextItemId = pendingIds.shift();

                if (!nextItemId) {
                    return;
                }

                const result = await uploadSingleItem(nextItemId);
                results.push(result);
            }
        };

        await Promise.all(
            Array.from({ length: Math.min(MAX_PARALLEL_UPLOADS, pendingIds.length) }, () => worker())
        );

        return results;
    };

    const addFilesToQueue = (incomingFiles: FileList | File[]) => {
        setSelectionError(null);
        setUploadError(null);
        setUploadSuccessMessage(null);

        const incomingArray = Array.from(incomingFiles);
        const currentIds = new Set(itemsRef.current.map((item) => item.id));
        const nextItems: UploadQueueItem[] = [];
        const errors: string[] = [];

        incomingArray.forEach((file) => {
            const itemId = createQueueItemId(file);
            const kind = shouldAcceptFile(file, acceptedKinds);

            if (!kind) {
                errors.push(`${file.name}: nieobsługiwany format pliku.`);
                return;
            }

            const maxFileSizeBytes = getMaxFileSizeBytes(kind);
            if (file.size > maxFileSizeBytes) {
                errors.push(`${file.name}: plik jest większy niż ${formatBytes(maxFileSizeBytes)}.`);
                return;
            }

            if (currentIds.has(itemId) || nextItems.some((item) => item.id === itemId)) {
                errors.push(`${file.name}: ten plik jest już na liście.`);
                return;
            }

            nextItems.push({
                id: itemId,
                file,
                kind,
                status: 'queued',
                progress: 0,
                errorMessage: null,
            });
        });

        const availableSlots = Math.max(0, MAX_FILES_PER_BATCH - itemsRef.current.length);
        const acceptedItems = nextItems.slice(0, availableSlots);

        if (nextItems.length > acceptedItems.length) {
            errors.push(`Możesz dodać maksymalnie ${MAX_FILES_PER_BATCH} ${getAllowedDescription(acceptedKinds)} jednocześnie.`);
        }

        if (acceptedItems.length > 0) {
            setIsUploadOverlayVisible(true);
            setItems((currentItems) => [...currentItems, ...acceptedItems]);
        }

        if (errors.length > 0) {
            setSelectionError(errors.join('\n'));
        }
    };

    const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) {
            return;
        }

        addFilesToQueue(event.target.files);
        event.target.value = '';
    };

    const handleRetry = async (itemId: string) => {
        if (hasActiveUpload) {
            return;
        }

        setUploadError(null);
        setUploadSuccessMessage(null);
        setIsUploadOverlayVisible(true);

        try {
            const results = await runUploadQueue([itemId]);
            finalizeBatch([itemId], results);
        } finally {
            setIsUploadOverlayVisible(false);
        }
    };

    return (
        <>
            <div className="mx-auto max-w-3xl space-y-6">
                <input
                    ref={inputRef}
                    type="file"
                    accept={getAcceptedInputValue(acceptedKinds)}
                    multiple
                    className="hidden"
                    onChange={handleFileSelection}
                />

                <button
                    type="button"
                    className="upload-dropzone"
                    onClick={() => inputRef.current?.click()}
                    disabled={shouldShowUploadOverlay}
                >
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
                            <svg
                                className="h-7 w-7"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                            </svg>
                        </div>

                        <div className="min-w-0">
                            <p className="font-sans text-lg font-medium text-ink">
                                {addButtonLabel}
                            </p>
                            <p className="mt-1 text-sm text-muted">
                                {addButtonDescription}
                            </p>
                        </div>
                    </div>
                </button>

                {selectionError ? (
                    <Notice tone="warning" className="p-5 text-left">
                        <p className="whitespace-pre-wrap break-words text-sm">
                            {selectionError}
                        </p>
                    </Notice>
                ) : null}
                {uploadError ? <ApiErrorAlert message={uploadError} /> : null}
                {uploadSuccessMessage ? (
                    <Notice tone="success" className="bg-emerald-50/90 px-4 py-3" contentClassName="mt-0 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>
                        <div className="min-w-0">
                            <p className="font-sans text-sm font-medium text-emerald-900">
                                {successTitle}
                            </p>
                            <p className="text-sm text-emerald-800">
                                {uploadSuccessMessage}
                            </p>
                        </div>
                    </Notice>
                ) : null}

                {hasErroredItems ? (
                    <Notice tone="error" className="bg-rose-50/40 p-5">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="font-sans text-base font-medium text-ink">
                                    Nie udało się wysłać części plików
                                </p>
                                <p className="mt-1 text-sm text-muted">
                                    Możesz ponowić tylko te pozycje, które mają błąd.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 space-y-4">
                            {items.filter((item) => item.status === 'error').map((item) => (
                                <article
                                    key={item.id}
                                    className="mt-6"
                                >
                                    <Card padding="md">
                                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="truncate font-sans text-base font-medium text-ink">
                                                        {item.file.name}
                                                    </p>
                                                    <span
                                                        className={cn('status-badge', getStatusClasses(item.status))}
                                                    >
                                                        {getStatusLabel(item.status)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm text-muted">
                                                    {formatBytes(item.file.size)}
                                                </p>
                                                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                                                    <span className="text-muted">
                                                        Spróbuj wysłać ponownie ten plik.
                                                    </span>
                                                    {item.errorMessage ? (
                                                        <span className="text-rose-700">
                                                            {item.errorMessage}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-3">
                                                {item.status === 'error' ? (
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => void handleRetry(item.id)}
                                                        disabled={hasActiveUpload}
                                                    >
                                                        Ponów
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </Card>
                                </article>
                            ))}
                        </div>
                    </Notice>
                ) : null}
            </div>
            {shouldShowUploadOverlay ? (
                <UploadProgressOverlay items={items} />
            ) : null}
        </>
    );
}
