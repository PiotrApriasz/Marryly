import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import Layout from '../components/Layout';
import Section from '../components/Section';
import Button from '../components/Button';
import ApiErrorAlert from '../components/ApiErrorAlert';
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
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'error':
            return 'bg-rose-50 text-rose-700 border-rose-200';
        case 'uploading':
        case 'preparing':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'queued':
        default:
            return 'bg-sand/50 text-ink border-sand';
    }
}

export default function GuestUploadPage() {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const autoUploadInFlightRef = useRef(false);
    const [items, setItems] = useState<UploadQueueItem[]>([]);
    const itemsRef = useRef<UploadQueueItem[]>([]);
    const [selectionError, setSelectionError] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    const hasActiveUpload = items.some((item) => item.status === 'preparing' || item.status === 'uploading');
    const queuedCount = items.filter((item) => item.status === 'queued').length;
    const successCount = items.filter((item) => item.status === 'success').length;

    useEffect(() => {
        if (hasActiveUpload || queuedCount === 0 || autoUploadInFlightRef.current) {
            return;
        }

        autoUploadInFlightRef.current = true;
        const queuedIds = items
            .filter((item) => item.status === 'queued')
            .map((item) => item.id);

        void runUploadQueue(queuedIds).finally(() => {
            autoUploadInFlightRef.current = false;
        });
    }, [hasActiveUpload, items, queuedCount]);

    const updateItem = (itemId: string, updater: (item: UploadQueueItem) => UploadQueueItem) => {
        setItems((currentItems) =>
            currentItems.map((item) => (item.id === itemId ? updater(item) : item))
        );
    };

    const uploadSingleItem = async (itemId: string) => {
        const item = itemsRef.current.find((candidate) => candidate.id === itemId);

        if (!item || item.status === 'success') {
            return;
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
        } catch (error) {
            logErrorDetails(error, 'Photo upload failed');

            updateItem(itemId, (currentItem) => ({
                ...currentItem,
                status: 'error',
                progress: 0,
                errorMessage: getErrorMessageForDisplay(error, 'Nie udało się wysłać zdjęcia. Spróbuj ponownie.'),
            }));
        }
    };

    const runUploadQueue = async (itemIds: string[]) => {
        const pendingIds = [...itemIds];

        const worker = async () => {
            while (pendingIds.length > 0) {
                const nextItemId = pendingIds.shift();

                if (!nextItemId) {
                    return;
                }

                await uploadSingleItem(nextItemId);
            }
        };

        await Promise.all(
            Array.from({ length: Math.min(MAX_PARALLEL_UPLOADS, pendingIds.length) }, () => worker())
        );
    };

    const addFilesToQueue = (incomingFiles: FileList | File[]) => {
        setSelectionError(null);
        setUploadError(null);

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
        await runUploadQueue([itemId]);
    };

    return (
        <Layout>
            <div className="pt-20">
                <Section background="white">
                    <div className="text-center">
                        <h1 className="font-script text-5xl text-ink md:text-6xl">
                            Dodaj zdjęcia
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                        <p className="mx-auto mt-8 max-w-2xl font-sans text-lg text-muted">
                            Wybierz zdjęcia, a wysyłanie rozpocznie się automatycznie. To ma działać szybko i wygodnie
                            także na telefonie.
                        </p>
                    </div>

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
                            className="w-full rounded-2xl border-2 border-dashed border-sand bg-white p-10 text-center transition-colors hover:border-gold"
                            onClick={() => inputRef.current?.click()}
                        >
                            <svg
                                className="mx-auto h-16 w-16 text-muted"
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
                            <p className="mt-4 font-sans text-lg text-ink">
                                Kliknij, aby wybrać zdjęcia
                            </p>
                            <p className="mt-2 text-sm text-muted">
                                JPG, PNG, WEBP, HEIC, HEIF • HEIC i HEIF są automatycznie konwertowane do JPEG • maks. {MAX_FILES_PER_BATCH} zdjęć • do {formatBytes(MAX_FILE_SIZE_BYTES)} każde
                            </p>
                        </button>

                        {selectionError ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                                <p className="whitespace-pre-wrap break-words text-left text-sm text-amber-800">
                                    {selectionError}
                                </p>
                            </div>
                        ) : null}
                        {uploadError ? <ApiErrorAlert message={uploadError} /> : null}

                        <div className="rounded-2xl border border-sand bg-paper/40 p-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="font-sans text-base font-medium text-ink">
                                        Kolejka uploadu
                                    </p>
                                    <p className="mt-1 text-sm text-muted">
                                        {items.length} plików na liście, {successCount} wysłanych, {queuedCount} czeka
                                    </p>
                                </div>

                                <p className="font-sans text-sm text-muted">
                                    {hasActiveUpload ? 'Trwa wysyłanie...' : 'Nowe zdjęcia startują od razu po wyborze.'}
                                </p>
                            </div>

                            {items.length === 0 ? (
                                <p className="mt-6 rounded-xl border border-dashed border-sand bg-white px-4 py-6 text-center text-sm text-muted">
                                    Po wybraniu zdjęć zobaczysz tu status każdego uploadu.
                                </p>
                            ) : (
                                <div className="mt-6 space-y-4">
                                    {items.map((item) => (
                                        <article
                                            key={item.id}
                                            className="rounded-2xl border border-sand bg-white p-4 shadow-sm"
                                        >
                                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="truncate font-sans text-base font-medium text-ink">
                                                            {item.file.name}
                                                        </p>
                                                        <span
                                                            className={`rounded-full border px-2 py-1 text-xs font-medium ${getStatusClasses(item.status)}`}
                                                        >
                                                            {getStatusLabel(item.status)}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-sm text-muted">
                                                        {formatBytes(item.file.size)}
                                                    </p>

                                                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-sand">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${
                                                                item.status === 'error' ? 'bg-rose-500' : 'bg-gold'
                                                            }`}
                                                            style={{ width: `${item.progress}%` }}
                                                        />
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                                                        <span className="text-muted">
                                                            {item.progress}%
                                                        </span>
                                                        {item.errorMessage ? (
                                                            <span className="text-rose-700">
                                                                {item.errorMessage}
                                                            </span>
                                                        ) : null}
                                                        {item.status === 'success' && item.blobUrl ? (
                                                            <span className="text-emerald-700">
                                                                Zdjęcie zostało zapisane.
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
                                        </article>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
