import { useState } from 'react';
import type { AdminAlbum } from '../types/admin.types';
import { appText } from '../content/appText';
import ApiErrorAlert from './ApiErrorAlert';
import Button from './Button';
import DeleteSelectedMediaButton from './DeleteSelectedMediaButton';
import Modal from './Modal';
import Notice from './Notice';
import Select from './Select';

interface Props {
    count: number;
    album: AdminAlbum;
    albums: AdminAlbum[];
    busy: boolean;
    deleteDisabled: boolean;
    compact?: boolean;
    error: string | null;
    progress: string | null;
    onOpen: () => void;
    onAdd: (targetAlbumId: string) => Promise<boolean>;
    onRemove: () => Promise<boolean>;
    onDelete: () => Promise<boolean>;
    onDownload: () => Promise<void>;
    downloading: boolean;
    downloadError: string | null;
}

export default function AdminMediaSelectionActions({ count, album, albums, busy, deleteDisabled, compact, error, progress, onOpen, onAdd, onRemove, onDelete, onDownload, downloading, downloadError }: Props) {
    const [dialog, setDialog] = useState<'add' | 'delete' | null>(null);
    const [targetId, setTargetId] = useState('');
    const text = appText.admin.album.selectionActions;
    const targets = albums.filter((item) => item.id !== album.id);
    if (count === 0) return null;

    const openDialog = (mode: 'add' | 'delete') => {
        onOpen();
        setTargetId('');
        setDialog(mode);
    };
    const close = () => { if (!busy) setDialog(null); };
    const complete = async (action: () => Promise<boolean>) => {
        if (await action()) setDialog(null);
    };
    const deleteLabel = text.delete.replace('{count}', String(count));
    return (
        <>
            <div className="flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2">
                <div className={`flex items-center gap-2 ${compact ? '' : 'rounded-xl bg-white p-2 shadow-xl'}`}>
                    <Button variant="secondary" size="sm" className={compact ? 'border-white bg-white !text-ink' : undefined} disabled={busy} onClick={() => openDialog('add')} aria-label={text.add}>
                        <span className="inline-flex items-center gap-2">
                            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7V4h7l2 3h9v13H3V7Zm9 3v7m-3-3.5h6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            <span className={compact ? 'sr-only' : 'hidden sm:inline'}>{text.add}</span>
                        </span>
                    </Button>
                    <Button variant="secondary" size="sm" className={compact ? 'border-white bg-white !text-ink' : undefined} disabled={busy} loading={downloading} onClick={() => void onDownload()} aria-label={text.download} title={text.download}>
                        <span className="inline-flex items-center gap-2">
                            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m0 0-5-5m5 5 5-5M5 21h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            <span className={compact ? 'sr-only' : 'hidden sm:inline'}>{text.download}</span>
                        </span>
                    </Button>
                    <Button variant="danger" size="sm" disabled={busy || deleteDisabled} onClick={() => openDialog('delete')} aria-label={deleteLabel} title={deleteLabel}>
                        <span className="inline-flex items-center gap-1.5">
                            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6m4-6v6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            <span aria-hidden="true">{count}</span>
                        </span>
                    </Button>
                </div>
                {downloading || downloadError ? (
                    <Notice tone={downloadError ? 'error' : 'info'} role={downloadError ? 'alert' : 'status'} className="max-w-sm text-sm shadow-xl">
                        {downloadError ?? text.downloading}
                    </Notice>
                ) : null}
            </div>
            <Modal open={dialog !== null} title={dialog === 'add' ? text.addTitle : text.deleteTitle} onClose={close}>
                <div className="space-y-5">
                    <p className="text-sm text-muted">{text.selected.replace('{count}', String(count))}</p>
                    {error ? <ApiErrorAlert message={error} /> : null}
                    {progress ? <Notice tone="info" role="status">{progress}</Notice> : null}
                    {dialog === 'add' ? (
                        <>
                            <p className="text-sm text-muted">{text.addDescription}</p>
                            {targets.length === 0 ? <Notice tone="info">{text.noAlbums}</Notice> : (
                                <label className="block text-sm font-medium">
                                    {text.targetLabel}
                                    <Select value={targetId} onChange={(event) => setTargetId(event.target.value)} disabled={busy}>
                                        <option value="">{text.targetPlaceholder}</option>
                                        {targets.map((target) => <option key={target.id} value={target.id}>{target.title}</option>)}
                                    </Select>
                                </label>
                            )}
                            <div className="flex flex-wrap justify-end gap-3">
                                <Button variant="ghost" size="sm" onClick={close} disabled={busy}>{appText.common.actions.cancel}</Button>
                                <Button size="sm" disabled={!targets.some((target) => target.id === targetId) || busy} loading={busy} onClick={() => void complete(() => onAdd(targetId))}>{text.add}</Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <p className="text-sm text-muted">{text.removeDescription}</p>
                                <Button variant="secondary" size="sm" disabled={busy || deleteDisabled} loading={busy} onClick={() => void complete(onRemove)}>{text.remove}</Button>
                            </div>
                            <div className="space-y-3 border-t border-sand pt-5">
                                <p className="text-sm text-muted">{text.permanentDescription}</p>
                                <DeleteSelectedMediaButton count={count} albumTitle={album.title} onDelete={() => complete(onDelete)} disabled={busy || deleteDisabled} loading={busy} />
                            </div>
                            <div className="text-right"><Button variant="ghost" size="sm" onClick={close} disabled={busy}>{appText.common.actions.cancel}</Button></div>
                        </>
                    )}
                </div>
            </Modal>
        </>
    );
}
