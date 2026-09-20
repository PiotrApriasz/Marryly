import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { appText } from '../content/appText';
import { useGuestUploadQueue } from '../hooks/useMediaUploadQueue';

export default function GuestUploadQueueStatus() {
    const location = useLocation();
    const [isExpanded, setIsExpanded] = useState(false);
    const {
        items,
        summary,
        isOnline,
        pauseReason,
        persistenceWarning,
        lastSummary,
        retryFailed,
        dismissLastSummary,
    } = useGuestUploadQueue();

    if (location.pathname === '/access') {
        return null;
    }

    const failedItems = items.filter((item) => item.status === 'error');
    const activeItem = items.find((item) => item.status === 'uploading') ?? items.find((item) => item.status === 'preparing');
    const shouldRender = location.pathname !== '/guestupload' && (items.length > 0 || lastSummary !== null);

    if (!shouldRender) {
        return null;
    }

    const statusDescription = pauseReason === 'offline'
        ? appText.public.guestUpload.queue.offline
        : pauseReason === 'session'
            ? appText.public.guestUpload.queue.sessionPaused
            : activeItem
                ? `${appText.public.guestUpload.queue.currentFilePrefix} ${activeItem.fileName}`
                : summary.failedCount > 0
                    ? appText.public.guestUpload.queue.waitingForRetry
                    : appText.public.guestUpload.queue.processing;

    return (
        <aside className="fixed bottom-4 right-4 z-40 w-[min(calc(100vw-2rem),26rem)] rounded-2xl border border-sand bg-paper/95 p-4 shadow-2xl backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
                <button
                    type="button"
                    className="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-gold/60"
                    aria-expanded={isExpanded}
                    onClick={() => setIsExpanded((currentValue) => !currentValue)}
                >
                    <p className="font-sans text-sm font-semibold text-ink">{appText.public.guestUpload.queue.title}</p>
                    <p className="mt-1 truncate text-xs text-muted">{statusDescription}</p>
                </button>

                <button
                    type="button"
                    className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-sand/70 hover:text-ink focus:outline-none focus:ring-2 focus:ring-gold/60"
                    aria-label={isExpanded ? 'Ukryj szczegóły kolejki' : 'Pokaż szczegóły kolejki'}
                    onClick={() => setIsExpanded((currentValue) => !currentValue)}
                >
                    {isExpanded ? '−' : '+'}
                </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                <span>{summary.completedCount} {appText.public.guestUpload.queue.completedSuffix} {summary.totalCount}</span>
                <span>{summary.activeCount} {appText.public.guestUpload.queue.activeSuffix} • {summary.failedCount} {appText.public.guestUpload.queue.failedSuffix}</span>
            </div>

            {summary.totalCount > 0 ? (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand" aria-hidden="true">
                    <div
                        className="h-full rounded-full bg-gold transition-[width] duration-300"
                        style={{ width: `${Math.min(100, (summary.completedCount / summary.totalCount) * 100)}%` }}
                    />
                </div>
            ) : null}

            {isExpanded ? (
                <div className="mt-4 space-y-3">
                    {!isOnline ? <p className="text-xs text-amber-700">{appText.public.guestUpload.queue.offline}</p> : null}
                    {persistenceWarning ? <p className="text-xs text-amber-700">{persistenceWarning}</p> : null}

                    {failedItems.length > 0 ? (
                        <div className="space-y-2">
                            {failedItems.slice(0, 5).map((item) => (
                                <p key={item.id} className="truncate text-xs text-rose-700" title={item.errorMessage ?? item.fileName}>
                                    {item.fileName}
                                </p>
                            ))}
                            <button
                                type="button"
                                className="w-full rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-gold/60"
                                onClick={() => void retryFailed()}
                            >
                                {appText.public.guestUpload.queue.retryFailed}
                            </button>
                        </div>
                    ) : null}

                    {lastSummary ? (
                        <div className="flex items-center justify-between gap-3 border-t border-sand pt-3 text-xs text-muted">
                            <span>{appText.public.guestUpload.queue.lastSummaryPrefix} {lastSummary.successfulCount}, {lastSummary.failedCount} {appText.public.guestUpload.queue.failedSuffix}.</span>
                            <button
                                type="button"
                                className="shrink-0 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-gold/60"
                                onClick={dismissLastSummary}
                            >
                                {appText.public.guestUpload.queue.dismiss}
                            </button>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </aside>
    );
}
