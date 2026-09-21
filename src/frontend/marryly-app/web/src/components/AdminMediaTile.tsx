import Card from './Card';
import ConfirmActionButton from './ConfirmActionButton';
import Notice from './Notice';
import StatusBadge from './StatusBadge';
import { appText } from '../content/appText';
import type { AdminMediaItem } from '../types/admin.types';
import { getMediaAspectRatio } from '../utils/media';

interface AdminMediaTileProps {
    mediaItem: AdminMediaItem;
    secondaryLabel: string;
    thumbnailAlt: string;
    deletingMediaId: string | null;
    onDelete: (mediaId: string) => void | Promise<void>;
    onPreview: (mediaId: string) => void;
}

function formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleString(appText.common.locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
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

function getStatusMetadata(status: string): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
    switch (status) {
        case 'ready':
            return { label: appText.common.status.ready, tone: 'success' };
        case 'processing':
            return { label: appText.common.status.processing, tone: 'warning' };
        case 'failed':
            return { label: appText.common.status.failed, tone: 'danger' };
        default:
            return { label: status, tone: 'neutral' };
    }
}

export default function AdminMediaTile({
    mediaItem,
    secondaryLabel,
    thumbnailAlt,
    deletingMediaId,
    onDelete,
    onPreview,
}: AdminMediaTileProps) {
    const previewUrl = mediaItem.thumbnailBlobUrl ?? mediaItem.previewBlobUrl ?? mediaItem.originalBlobUrl;
    const status = getStatusMetadata(mediaItem.status);
    const isVideo = mediaItem.kind === 'video';

    return (
        <article>
            <Card padding="none" className="overflow-hidden">
                <button
                    type="button"
                    className="masonry-media group block w-full cursor-zoom-in border-0 p-0 text-left"
                    style={{ aspectRatio: getMediaAspectRatio(mediaItem) }}
                    aria-label={thumbnailAlt}
                    onClick={() => onPreview(mediaItem.id)}
                >
                    {isVideo ? (
                        <video
                            src={previewUrl}
                            poster={mediaItem.thumbnailBlobUrl ?? undefined}
                            preload="metadata"
                            muted
                            playsInline
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                    ) : (
                        <img
                            src={previewUrl}
                            alt={thumbnailAlt}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                    )}
                </button>
                <div className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <StatusBadge label={status.label} tone={status.tone} />
                        <span className="font-sans text-xs text-muted">
                            {secondaryLabel}
                        </span>
                    </div>

                    <div className="space-y-2 text-sm text-muted">
                        <p>{appText.admin.common.addedAt}: {formatDate(mediaItem.uploadedAt)}</p>
                        <p>{appText.admin.common.size}: {formatBytes(mediaItem.sizeBytes)}</p>
                        <p>{appText.admin.common.kind}: {isVideo ? appText.common.media.video : appText.common.media.photo}</p>
                        <p>{appText.admin.common.type}: {mediaItem.contentType}</p>
                        {mediaItem.width > 0 && mediaItem.height > 0 ? (
                            <p>{appText.admin.common.dimensions}: {mediaItem.width} × {mediaItem.height}</p>
                        ) : null}
                    </div>

                    {mediaItem.processingError ? (
                        <Notice tone="error" className="p-4">
                            <p className="text-sm">{mediaItem.processingError}</p>
                        </Notice>
                    ) : null}

                    <div className="flex items-center justify-end">
                        <ConfirmActionButton
                            confirmMessage={appText.admin.common.deleteMediaConfirm}
                            onConfirm={() => onDelete(mediaItem.id)}
                            loading={deletingMediaId === mediaItem.id}
                            disabled={deletingMediaId !== null && deletingMediaId !== mediaItem.id}
                        >
                            {appText.common.actions.delete}
                        </ConfirmActionButton>
                    </div>
                </div>
            </Card>
        </article>
    );
}
