import { appText } from '../content/appText';
import ConfirmActionButton from './ConfirmActionButton';

interface DeleteSelectedMediaButtonProps {
    count: number;
    albumTitle: string;
    onDelete: () => Promise<void>;
    disabled?: boolean;
    loading?: boolean;
    compact?: boolean;
}

export default function DeleteSelectedMediaButton({ count, albumTitle, onDelete, disabled, loading, compact = false }: DeleteSelectedMediaButtonProps) {
    if (count === 0) {
        return null;
    }

    const label = appText.admin.album.deleteSelected.replace('{count}', String(count));
    return (
        <ConfirmActionButton
            confirmMessage={appText.admin.album.deleteSelectedConfirm.replace('{count}', String(count)).replace('{album}', albumTitle)}
            onConfirm={onDelete}
            disabled={disabled}
            loading={loading}
            className={compact ? '!rounded-full' : 'shadow-xl'}
        >
            <span className="inline-flex items-center gap-2">
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M3 6h18M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6m4-6v6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className={compact ? 'sr-only' : undefined}>{label}</span>
                {compact ? <span aria-hidden="true">{count}</span> : null}
            </span>
        </ConfirmActionButton>
    );
}
