import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { uploadFileToSignedUrl } from '../api/photoUploadTransport';
import ApiErrorAlert from '../components/ApiErrorAlert';
import Button from '../components/Button';
import Field from '../components/Field';
import Input from '../components/Input';
import Layout from '../components/Layout';
import Notice from '../components/Notice';
import PageHeader from '../components/PageHeader';
import Section from '../components/Section';
import Textarea from '../components/Textarea';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { preparePhotoFileForUpload } from '../media/preparePhotoFileForUpload';

type AttachmentKind = 'photo' | 'video';
type AttachmentUploadStatus = 'idle' | 'preparing' | 'uploading' | 'completing' | 'success' | 'error';

interface AttachmentUploadState {
    status: AttachmentUploadStatus;
    file: File | null;
    kind: AttachmentKind | null;
    progress: number;
    mediaId: string | null;
    errorMessage: string | null;
}

const MAX_PHOTO_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE_BYTES = 500 * 1024 * 1024;
const PHOTO_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
const VIDEO_FILE_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/3gpp2', 'video/x-m4v'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.3gp', '.3gpp'];

const emptyAttachmentUploadState: AttachmentUploadState = {
    status: 'idle',
    file: null,
    kind: null,
    progress: 0,
    mediaId: null,
    errorMessage: null,
};

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
    return dotIndex < 0 ? '' : fileName.slice(dotIndex).toLowerCase();
}

function getAttachmentKind(file: File): AttachmentKind | null {
    const extension = getExtension(file.name);

    if (PHOTO_FILE_TYPES.includes(file.type) || PHOTO_EXTENSIONS.includes(extension)) {
        return 'photo';
    }

    if (VIDEO_FILE_TYPES.includes(file.type) || VIDEO_EXTENSIONS.includes(extension)) {
        return 'video';
    }

    return null;
}

function getContentType(file: File, kind: AttachmentKind): string {
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
            return kind === 'video' ? 'video/mp4' : 'application/octet-stream';
    }
}

function getMaxFileSizeBytes(kind: AttachmentKind): number {
    return kind === 'video' ? MAX_VIDEO_FILE_SIZE_BYTES : MAX_PHOTO_FILE_SIZE_BYTES;
}

function getKindLabel(kind: AttachmentKind | null): string {
    return kind === 'video' ? 'film' : 'zdjęcie';
}

function getStatusLabel(status: AttachmentUploadStatus, kind: AttachmentKind | null): string {
    const label = getKindLabel(kind);

    switch (status) {
        case 'preparing':
            return `Przygotowujemy ${label}`;
        case 'uploading':
            return `Przesyłamy ${label}`;
        case 'completing':
            return `Zapisujemy ${label}`;
        case 'success':
            return `${label === 'film' ? 'Film' : 'Zdjęcie'} załączone`;
        case 'error':
            return `Nie udało się załączyć ${label}`;
        case 'idle':
        default:
            return 'Załącznik opcjonalny';
    }
}

function AttachmentOverlay({ state }: { state: AttachmentUploadState }) {
    const progress = state.status === 'completing' || state.status === 'success' ? 100 : state.progress;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4 py-8 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="w-full max-w-md rounded-2xl bg-paper p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="font-serif text-2xl text-ink">
                            {getStatusLabel(state.status, state.kind)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted">
                            Nie odświeżaj strony ani nie zamykaj karty. Po zakończeniu załącznik będzie gotowy do wysłania z życzeniami.
                        </p>
                    </div>
                    <div className="shrink-0 rounded-full bg-gold/10 px-3 py-2 font-sans text-sm font-semibold text-gold">
                        {progress}%
                    </div>
                </div>

                <div className="mt-6">
                    <div className="h-3 overflow-hidden rounded-full bg-sand">
                        <div
                            className="h-full rounded-full bg-gold transition-[width] duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    {state.file ? (
                        <div className="mt-3 text-sm text-muted">
                            <p className="truncate font-medium text-ink">{state.file.name}</p>
                            <p className="mt-1">{formatBytes(state.file.size)}</p>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default function GuestbookPage() {
    const attachmentInputRef = useRef<HTMLInputElement | null>(null);
    const [authorName, setAuthorName] = useState('');
    const [message, setMessage] = useState('');
    const [attachmentUpload, setAttachmentUpload] = useState<AttachmentUploadState>(emptyAttachmentUploadState);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const isAttachmentUploadActive = attachmentUpload.status === 'preparing' ||
        attachmentUpload.status === 'uploading' ||
        attachmentUpload.status === 'completing';
    const attachedMediaId = attachmentUpload.status === 'success' ? attachmentUpload.mediaId : null;
    const canSubmit = !loading &&
        !isAttachmentUploadActive &&
        authorName.trim().length > 0 &&
        (message.trim().length > 0 || Boolean(attachedMediaId));

    useEffect(() => {
        if (!isAttachmentUploadActive) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isAttachmentUploadActive]);

    useEffect(() => {
        if (!isAttachmentUploadActive) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isAttachmentUploadActive]);

    const uploadAttachment = async (file: File) => {
        const kind = getAttachmentKind(file);
        if (!kind) {
            setAttachmentUpload({
                status: 'error',
                file,
                kind: null,
                progress: 0,
                mediaId: null,
                errorMessage: 'Wybierz zdjęcie albo film w obsługiwanym formacie.',
            });
            return;
        }

        const maxFileSizeBytes = getMaxFileSizeBytes(kind);
        if (file.size > maxFileSizeBytes) {
            setAttachmentUpload({
                status: 'error',
                file,
                kind,
                progress: 0,
                mediaId: null,
                errorMessage: `Plik jest większy niż ${formatBytes(maxFileSizeBytes)}.`,
            });
            return;
        }

        setError(null);
        setIsSubmitted(false);
        setAttachmentUpload({
            status: 'preparing',
            file,
            kind,
            progress: 0,
            mediaId: null,
            errorMessage: null,
        });

        try {
            const preparedFile = kind === 'photo' ? await preparePhotoFileForUpload(file) : file;
            const contentType = getContentType(preparedFile, kind);

            if (preparedFile.size > maxFileSizeBytes) {
                throw new Error(`Plik po przygotowaniu jest większy niż ${formatBytes(maxFileSizeBytes)}.`);
            }

            const target = await apiClient.createMediaUpload({
                kind,
                fileName: preparedFile.name,
                fileSizeBytes: preparedFile.size,
                contentType,
                lastModifiedAt: new Date(preparedFile.lastModified).toISOString(),
            });
            const mediaId = target.mediaId ?? target.photoId;

            setAttachmentUpload((current) => ({
                ...current,
                status: 'uploading',
                progress: 0,
            }));

            await uploadFileToSignedUrl({
                file: preparedFile,
                uploadUrl: target.uploadUrl,
                headers: {
                    'Content-Type': contentType,
                    'x-ms-blob-type': 'BlockBlob',
                    ...(target.requiredHeaders ?? {}),
                },
                onProgress: (progressPercent) => {
                    setAttachmentUpload((current) => ({
                        ...current,
                        status: 'uploading',
                        progress: progressPercent,
                    }));
                },
            });

            setAttachmentUpload((current) => ({
                ...current,
                status: 'completing',
                progress: 100,
            }));

            await apiClient.completeGuestBookMediaUpload({
                mediaId,
                photoId: target.photoId,
                kind,
                blobName: target.blobName,
                blobUrl: target.blobUrl,
                contentType,
                sizeBytes: preparedFile.size,
            });

            setAttachmentUpload({
                status: 'success',
                file,
                kind,
                progress: 100,
                mediaId,
                errorMessage: null,
            });
        } catch (err: unknown) {
            logErrorDetails(err, 'Guestbook attachment upload failed');
            setAttachmentUpload({
                status: 'error',
                file,
                kind,
                progress: 0,
                mediaId: null,
                errorMessage: getErrorMessageForDisplay(err, 'Nie udało się załączyć pliku. Spróbuj ponownie.'),
            });
        }
    };

    const handleAttachmentSelection = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        void uploadAttachment(file);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canSubmit) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await apiClient.addGuestBookEntry({
                authorName: authorName.trim(),
                message: message.trim(),
                ...(attachedMediaId ? { mediaId: attachedMediaId } : {}),
            });

            setIsSubmitted(true);
            setAuthorName('');
            setMessage('');
            setAttachmentUpload(emptyAttachmentUploadState);
        } catch (err: unknown) {
            setError(getErrorMessageForDisplay(err, 'Nie udało się wysłać życzeń. Spróbuj ponownie.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader
                        title="Księga gości"
                        description="Zostaw nam swoje życzenia i wspomnienia z tego wyjątkowego dnia"
                    />

                    <div className="mx-auto mt-12 max-w-2xl">
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {isSubmitted && !error && (
                                <Notice tone="success" className="rounded-lg p-4 text-left">
                                    <p className="font-sans text-sm">
                                        Dziękujemy! Twoje życzenia zostały zapisane.
                                    </p>
                                </Notice>
                            )}
                            {error && <ApiErrorAlert message={error} />}

                            <Field label="Twoje imię" htmlFor="name" labelTone="strong">
                                <Input
                                    type="text"
                                    id="name"
                                    value={authorName}
                                    onChange={(event) => setAuthorName(event.target.value)}
                                    required
                                    placeholder="Jan Kowalski"
                                />
                            </Field>

                            <Field label="Twoja wiadomość" htmlFor="message" labelTone="strong">
                                <Textarea
                                    id="message"
                                    rows={6}
                                    value={message}
                                    onChange={(event) => setMessage(event.target.value)}
                                    required={!attachedMediaId}
                                    placeholder="Podziel się z nami czymkolwiek chcesz..."
                                />
                            </Field>

                            <div className="rounded-2xl border border-sand bg-sand/30 p-4">
                                <input
                                    ref={attachmentInputRef}
                                    type="file"
                                    accept={['image/*', 'video/*', ...PHOTO_FILE_TYPES, ...PHOTO_EXTENSIONS, ...VIDEO_FILE_TYPES, ...VIDEO_EXTENSIONS].join(',')}
                                    className="hidden"
                                    onChange={handleAttachmentSelection}
                                />
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="font-sans text-sm font-semibold text-ink">
                                            Zdjęcie lub film
                                        </p>
                                        <p className="mt-1 text-sm text-muted">
                                            Możesz dołączyć zdjęcie albo krótki film z telefonu.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => attachmentInputRef.current?.click()}
                                        disabled={loading || isAttachmentUploadActive}
                                    >
                                        {attachedMediaId ? 'Zmień załącznik' : 'Dodaj załącznik'}
                                    </Button>
                                </div>

                                {attachmentUpload.file ? (
                                    <div className="mt-4 rounded-xl bg-white/70 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-ink">
                                                    {attachmentUpload.file.name}
                                                </p>
                                                <p className="mt-1 text-xs text-muted">
                                                    {formatBytes(attachmentUpload.file.size)}
                                                </p>
                                            </div>
                                            <span className="text-xs font-semibold text-muted">
                                                {getStatusLabel(attachmentUpload.status, attachmentUpload.kind)}
                                            </span>
                                        </div>

                                        {isAttachmentUploadActive ? (
                                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
                                                <div
                                                    className="h-full rounded-full bg-gold transition-[width] duration-300"
                                                    style={{ width: `${attachmentUpload.status === 'completing' ? 100 : attachmentUpload.progress}%` }}
                                                />
                                            </div>
                                        ) : null}

                                        {attachmentUpload.errorMessage ? (
                                            <p className="mt-3 text-sm text-rose-700">
                                                {attachmentUpload.errorMessage}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>

                            <Button
                                type="submit"
                                variant="primary"
                                size="lg"
                                className="w-full"
                                loading={loading}
                                disabled={!canSubmit}
                            >
                                Wyślij życzenia
                            </Button>
                        </form>
                    </div>
                </Section>
            </div>
            {isAttachmentUploadActive ? <AttachmentOverlay state={attachmentUpload} /> : null}
        </Layout>
    );
}
