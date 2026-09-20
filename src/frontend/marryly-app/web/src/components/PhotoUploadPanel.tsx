import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { appText } from '../content/appText';
import { useGuestUploadQueue, type GuestUploadQueueItem } from '../hooks/useMediaUploadQueue';
import type { UploadMediaKind } from '../types/upload.types';
import ApiErrorAlert from './ApiErrorAlert';
import Button from './Button';
import Card from './Card';
import Notice from './Notice';
import { cn } from '../utils/cn';

type UploadStatus = 'queued' | 'preparing' | 'uploading' | 'success' | 'error';
type UploadQueueItem = Omit<GuestUploadQueueItem, 'status'> & { status: UploadStatus };

interface UploadProgressSummary {
    activeItems: UploadQueueItem[];
    currentItem: UploadQueueItem | null;
    completedCount: number;
    totalCount: number;
    totalProgress: number;
}

interface PhotoUploadPanelProps {
    addButtonLabel?: string;
    addButtonDescription?: string;
    successTitle?: string;
    acceptedKinds?: UploadMediaKind[];
}

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

function formatBytes(size: number): string {
    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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

function getGenericMediaNoun(count: number): string {
    if (count === 1) {
        return 'plik';
    }

    const remainderTen = count % 10;
    const remainderHundred = count % 100;

    return remainderTen >= 2 && remainderTen <= 4 && (remainderHundred < 12 || remainderHundred > 14)
        ? 'pliki'
        : appText.components.mediaUpload.nouns.filePlural;
}

function isPhotoOnly(acceptedKinds: UploadMediaKind[]): boolean {
    return acceptedKinds.length === 1 && acceptedKinds[0] === 'photo';
}

function getSuccessMessage(successfulItemsCount: number, failedItemsCount: number, acceptedKinds: UploadMediaKind[]): string {
    if (isPhotoOnly(acceptedKinds)) {
        if (failedItemsCount === 0) {
            return successfulItemsCount === 1
                ? appText.components.mediaUpload.success.onePhoto
                : `${appText.components.mediaUpload.success.uploadedPrefix} ${successfulItemsCount} ${getPluralForm(successfulItemsCount, appText.components.mediaUpload.nouns.photoSingular, appText.components.mediaUpload.nouns.photoPaucal, appText.components.mediaUpload.nouns.photoPlural)}. ${appText.components.mediaUpload.success.more}`;
        }

        return `${appText.components.mediaUpload.success.uploadedPrefix} ${successfulItemsCount} ${getPluralForm(successfulItemsCount, appText.components.mediaUpload.nouns.photoSingular, appText.components.mediaUpload.nouns.photoPaucal, appText.components.mediaUpload.nouns.photoPlural)}. ${appText.components.mediaUpload.success.checkRemaining}`;
    }

    if (failedItemsCount === 0) {
        return successfulItemsCount === 1
            ? appText.components.mediaUpload.success.oneFile
            : `${appText.components.mediaUpload.success.uploadedPrefix} ${successfulItemsCount} ${getGenericMediaNoun(successfulItemsCount)}. ${appText.components.mediaUpload.success.more}`;
    }

    return `${appText.components.mediaUpload.success.uploadedPrefix} ${successfulItemsCount} ${getGenericMediaNoun(successfulItemsCount)}. ${appText.components.mediaUpload.success.checkRemaining}`;
}

function getFailureMessage(failedItemsCount: number, acceptedKinds: UploadMediaKind[]): string {
    if (isPhotoOnly(acceptedKinds)) {
        return `${appText.components.mediaUpload.errors.uploadOne} ${failedItemsCount} ${getPluralForm(failedItemsCount, appText.components.mediaUpload.nouns.photoAccusativeSingular, appText.components.mediaUpload.nouns.photoGenitivePlural, appText.components.mediaUpload.nouns.photoGenitivePlural)}. ${appText.components.mediaUpload.errors.tryAgain}`;
    }

    return `${appText.components.mediaUpload.errors.uploadOne} ${failedItemsCount} ${getGenericMediaNoun(failedItemsCount)}. ${appText.components.mediaUpload.errors.tryAgain}`;
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
            return appText.components.mediaUpload.status.queued;
        case 'preparing':
            return appText.components.mediaUpload.status.preparing;
        case 'uploading':
            return appText.components.mediaUpload.status.uploading;
        case 'success':
            return appText.components.mediaUpload.status.success;
        case 'error':
            return appText.components.mediaUpload.status.error;
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

function getUploadProgressSummary(
    items: UploadQueueItem[],
    queueSummary: { totalCount: number; completedCount: number },
): UploadProgressSummary {
    const activeItems = items.filter((item) => item.status !== 'error');
    const totalCount = Math.max(queueSummary.totalCount, activeItems.length + queueSummary.completedCount);
    const completedCount = queueSummary.completedCount;
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

    const progressSum = activeItems.reduce((sum, item) => sum + normalizeProgress(item.progress), completedCount * 100);

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
        return appText.components.mediaUpload.overlay.preparing;
    }

    if (summary.currentItem?.status === 'uploading') {
        return appText.components.mediaUpload.overlay.uploading;
    }

    if (summary.currentItem?.status === 'queued') {
        return appText.components.mediaUpload.overlay.preparing;
    }

    return appText.components.mediaUpload.overlay.completing;
}

function UploadProgressOverlay({ items, queueSummary }: {
    items: UploadQueueItem[];
    queueSummary: { totalCount: number; completedCount: number };
}) {
    const summary = getUploadProgressSummary(items, queueSummary);
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
                            {appText.components.mediaUpload.overlay.description}
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
                            {summary.completedCount} z {summary.totalCount} {appText.components.mediaUpload.overlay.completedSummarySuffix}
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
                                            {getStatusLabel(item.status)} • {formatBytes(item.file.size)}
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
    addButtonLabel = appText.components.mediaUpload.defaults.addButtonLabel,
    addButtonDescription = appText.components.mediaUpload.defaults.addButtonDescription,
    successTitle = appText.components.mediaUpload.defaults.successTitle,
    acceptedKinds = ['photo', 'video'],
}: PhotoUploadPanelProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [selectionError, setSelectionError] = useState<string | null>(null);
    const {
        items,
        summary,
        isHydrating,
        lastSummary,
        enqueueFiles,
        retryFailed,
    } = useGuestUploadQueue();

    const hasActiveUpload = items.some((item) => item.status === 'preparing' || item.status === 'uploading');
    const queuedCount = items.filter((item) => item.status === 'queued').length;
    const hasErroredItems = items.some((item) => item.status === 'error');
    const shouldShowUploadOverlay = hasActiveUpload || queuedCount > 0;

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

    const failedCount = lastSummary?.failedCount ?? items.filter((item) => item.status === 'error').length;
    const successfulCount = lastSummary?.successfulCount ?? 0;
    const uploadSuccessMessage = successfulCount > 0
        ? getSuccessMessage(successfulCount, failedCount, acceptedKinds)
        : null;
    const uploadError = failedCount > 0 ? getFailureMessage(failedCount, acceptedKinds) : null;

    const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
        setSelectionError(null);

        if (!event.target.files || event.target.files.length === 0) {
            return;
        }

        const result = await enqueueFiles(Array.from(event.target.files), acceptedKinds);
        event.target.value = '';

        if (result.errors.length > 0) {
            setSelectionError(result.errors.join('\n'));
        }
    };

    const handleRetry = async (itemId: string) => {
        if (hasActiveUpload) {
            return;
        }

        await retryFailed(itemId);
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
                    disabled={isHydrating || shouldShowUploadOverlay}
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
                                    {appText.components.mediaUpload.errors.partialFailureTitle}
                                </p>
                                <p className="mt-1 text-sm text-muted">
                                    {appText.components.mediaUpload.errors.partialFailureDescription}
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
                                                        {appText.components.mediaUpload.errors.retryFile}
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
                                                        {appText.common.actions.retry}
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
                <UploadProgressOverlay items={items} queueSummary={summary} />
            ) : null}
        </>
    );
}
