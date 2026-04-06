import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import Layout from '../components/Layout';
import Section from '../components/Section';
import Button from '../components/Button';
import ApiErrorAlert from '../components/ApiErrorAlert';
import Card from '../components/Card';
import Notice from '../components/Notice';
import PageHeader from '../components/PageHeader';
import { cn } from '../utils/cn';
import { apiClient } from '../api/client';
import { uploadFileToSignedUrl } from '../api/photoUploadTransport';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { preparePhotoFileForUpload } from '../media/preparePhotoFileForUpload';

type UploadStatus = 'queued' | 'preparing' | 'uploading' | 'success' | 'error';

interface UploadQueueItem {
    id: string;
    file: File;
    preparedFile?: File;
    status: UploadStatus;
    progress: number;
    errorMessage: string | null;
    blobUrl?: string;
}

type UploadSingleResult = 'success' | 'error' | 'skipped';

const MAX_FILES_PER_BATCH = 20;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_PARALLEL_UPLOADS = 2;
const ACCEPTED_FILE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
];
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

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
        default:
            return 'application/octet-stream';
    }
}

function isAcceptedImage(file: File): boolean {
    if (ACCEPTED_FILE_TYPES.includes(file.type)) {
        return true;
    }

    return ACCEPTED_EXTENSIONS.includes(getExtension(file.name));
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

export default function GuestUploadPage() {
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

    const getPluralForm = (count: number, singular: string, paucal: string, plural: string): string => {
        const remainderTen = count % 10;
        const remainderHundred = count % 100;

        if (count === 1) {
            return singular;
        }

        if (remainderTen >= 2 && remainderTen <= 4 && (remainderHundred < 12 || remainderHundred > 14)) {
            return paucal;
        }

        return plural;
    };

    const summarizeUploadResult = (successfulItemsCount: number, failedItemsCount: number) => {
        if (successfulItemsCount > 0) {
            if (failedItemsCount === 0) {
                setUploadSuccessMessage(
                    successfulItemsCount === 1
                        ? 'Zdjęcie zostało wysłane. Możesz dodać kolejne.'
                        : `Pomyślnie wysłano ${successfulItemsCount} ${getPluralForm(successfulItemsCount, 'zdjęcie', 'zdjęcia', 'zdjęć')}. Możesz dodać kolejne.`
                );
            } else {
                setUploadSuccessMessage(
                    `Pomyślnie wysłano ${successfulItemsCount} ${getPluralForm(successfulItemsCount, 'zdjęcie', 'zdjęcia', 'zdjęć')}. Sprawdź pozostałe.`
                );
            }
        } else {
            setUploadSuccessMessage(null);
        }

        if (failedItemsCount > 0) {
            setUploadError(
                `Nie udało się wysłać ${failedItemsCount} ${getPluralForm(failedItemsCount, 'zdjęcia', 'zdjęć', 'zdjęć')}. Spróbuj ponownie.`
            );
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
            const preparedFile = item.preparedFile ?? await preparePhotoFileForUpload(item.file);

            if (preparedFile.size > MAX_FILE_SIZE_BYTES) {
                throw new Error(`Po konwersji plik przekracza limit ${formatBytes(MAX_FILE_SIZE_BYTES)}.`);
            }

            if (preparedFile !== item.preparedFile) {
                updateItem(itemId, (currentItem) => ({
                    ...currentItem,
                    preparedFile,
                }));
            }

            const target = await apiClient.createPhotoUpload({
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

            await apiClient.completePhotoUpload({
                photoId: target.photoId,
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
            logErrorDetails(error, 'Photo upload failed');

            updateItem(itemId, (currentItem) => ({
                ...currentItem,
                status: 'error',
                progress: 0,
                errorMessage: getErrorMessageForDisplay(error, 'Nie udało się wysłać zdjęcia. Spróbuj ponownie.'),
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

            if (!isAcceptedImage(file)) {
                errors.push(`${file.name}: nieobsługiwany format pliku.`);
                return;
            }

            if (file.size > MAX_FILE_SIZE_BYTES) {
                errors.push(`${file.name}: plik jest większy niż ${formatBytes(MAX_FILE_SIZE_BYTES)}.`);
                return;
            }

            if (currentIds.has(itemId) || nextItems.some((item) => item.id === itemId)) {
                errors.push(`${file.name}: ten plik jest już na liście.`);
                return;
            }

            nextItems.push({
                id: itemId,
                file,
                status: 'queued',
                progress: 0,
                errorMessage: null,
            });
        });

        const availableSlots = Math.max(0, MAX_FILES_PER_BATCH - itemsRef.current.length);
        const acceptedItems = nextItems.slice(0, availableSlots);

        if (nextItems.length > acceptedItems.length) {
            errors.push(`Możesz dodać maksymalnie ${MAX_FILES_PER_BATCH} zdjęć jednocześnie.`);
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
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader
                        title="Dodaj zdjęcia"
                        description="Zrób lub wybierz zdjęcia, a wysyłanie rozpocznie się automatycznie."
                    />

                    <div className="mx-auto mt-12 max-w-3xl space-y-6">
                        <input
                            ref={inputRef}
                            type="file"
                            accept={[...ACCEPTED_FILE_TYPES, ...ACCEPTED_EXTENSIONS].join(',')}
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
                                        Dodaj zdjęcia
                                    </p>
                                    <p className="mt-1 text-sm text-muted">
                                        Otworzy aparat lub galerię w telefonie.
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
                                        Zdjęcia zapisane
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
                                            Nie udało się wysłać części zdjęć
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
                                                                Spróbuj wysłać ponownie to zdjęcie.
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
                </Section>
            </div>
            {shouldShowUploadOverlay ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/95 px-6 backdrop-blur-sm">
                    <div className="overlay-surface">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gold/10">
                            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gold/20 border-t-gold" />
                        </div>
                        <h2 className="mt-6 font-sans text-2xl font-medium text-ink">
                            Wysyłamy zdjęcia
                        </h2>
                        <p className="mt-3 text-base text-muted">
                            Zaczekaj chwilę i nie zamykaj tej strony.
                        </p>
                        <p className="mt-2 text-sm text-muted">
                            Po zakończeniu od razu pokażemy potwierdzenie.
                        </p>
                    </div>
                </div>
            ) : null}
        </Layout>
    );
}
