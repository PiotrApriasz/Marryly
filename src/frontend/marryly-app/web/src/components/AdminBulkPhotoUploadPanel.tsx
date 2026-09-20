import { useRef, useState, type ChangeEvent } from 'react';
import { MAX_BATCH_MEDIA_COUNT } from '../constants/mediaUpload';
import { appText } from '../content/appText';
import { useAdminUploadQueue } from '../hooks/admin/useAdminUploadQueue';
import Notice from './Notice';

interface AdminBulkPhotoUploadPanelProps {
    albumId: string;
}

function formatQueueMessage(count: number): string {
    if (count === 1) {
        return appText.admin.bulkUpload.oneAdded;
    }

    return `${appText.admin.bulkUpload.addedPrefix} ${count} ${appText.components.mediaUpload.nouns.photoGenitivePlural}.`;
}

function formatErrorList(errors: string[]): string {
    const visibleErrors = errors.slice(0, 20);
    const hiddenCount = errors.length - visibleErrors.length;

    if (hiddenCount <= 0) {
        return visibleErrors.join('\n');
    }

    return `${visibleErrors.join('\n')}\n${appText.admin.bulkUpload.hiddenErrorsPrefix} ${hiddenCount}.`;
}

export default function AdminBulkPhotoUploadPanel({ albumId }: AdminBulkPhotoUploadPanelProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [selectionError, setSelectionError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const { items, isHydrating, enqueueFiles, retryFailed } = useAdminUploadQueue();
    const albumItems = items.filter((item) => item.albumId === albumId);
    const activeCount = albumItems.filter((item) => item.status === 'preparing' || item.status === 'uploading').length;
    const queuedCount = albumItems.filter((item) => item.status === 'queued').length;
    const failedCount = albumItems.filter((item) => item.status === 'error').length;
    const currentProgress = albumItems.length > 0
        ? albumItems.reduce((total, item) => total + (item.status === 'uploading' ? item.progress : 0), 0) / albumItems.length
        : 0;

    const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
        event.target.value = '';

        if (selectedFiles.length === 0) {
            return;
        }

        setSelectionError(null);
        setSuccessMessage(null);
        const result = await enqueueFiles(albumId, selectedFiles);

        if (result.addedCount > 0) {
            setSuccessMessage(formatQueueMessage(result.addedCount));
        }

        if (result.errors.length > 0) {
            setSelectionError(formatErrorList(result.errors));
        }
    };

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <input
                ref={inputRef}
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                className="hidden"
                onChange={(event) => void handleFileSelection(event)}
            />

            <button
                type="button"
                className="upload-dropzone"
                onClick={() => inputRef.current?.click()}
                disabled={isHydrating}
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
                        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a1 1 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    </div>

                    <div className="min-w-0">
                        <p className="font-sans text-lg font-medium text-ink">
                            {appText.admin.album.upload.addButtonLabel}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                            {appText.admin.album.upload.addButtonDescription}
                        </p>
                    </div>
                </div>
            </button>

            {selectionError ? (
                <Notice tone="warning" className="p-5 text-left">
                    <p className="whitespace-pre-wrap break-words text-sm">{selectionError}</p>
                </Notice>
            ) : null}

            {successMessage ? (
                <Notice tone="success" className="bg-emerald-50/90 px-4 py-3">
                    {successMessage}
                </Notice>
            ) : null}

            {albumItems.length > 0 ? (
                <div className="rounded-2xl border border-sand bg-white/70 p-5" role="status" aria-live="polite">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="font-sans text-sm font-semibold text-ink">
                                {appText.admin.bulkUpload.albumQueueTitle}
                            </p>
                            <p className="mt-1 text-sm text-muted">
                                {queuedCount} {appText.admin.bulkUpload.queuedSuffix}, {activeCount} {appText.admin.bulkUpload.activeSuffix}, {failedCount} {appText.admin.bulkUpload.failedSuffix}
                            </p>
                        </div>

                        {failedCount > 0 ? (
                            <button
                                type="button"
                                className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-gold/60"
                                onClick={() => void retryFailed(albumId)}
                            >
                                {appText.admin.bulkUpload.retryFailed}
                            </button>
                        ) : null}
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-sand" aria-hidden="true">
                        <div
                            className="h-full rounded-full bg-gold transition-[width] duration-300"
                            style={{ width: `${currentProgress}%` }}
                        />
                    </div>
                    <p className="mt-3 text-xs text-muted">
                        {appText.admin.bulkUpload.albumQueueLimitPrefix} {MAX_BATCH_MEDIA_COUNT}.
                    </p>
                </div>
            ) : null}
        </div>
    );
}
