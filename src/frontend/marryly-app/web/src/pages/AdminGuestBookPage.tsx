import { useState } from 'react';
import Layout from '../components/Layout';
import AdminBackLink from '../components/AdminBackLink';
import AdminPagination from '../components/AdminPagination';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import { useAdminGuestBookEntries } from '../hooks/admin/useAdminGuestBookEntries';

const PAGE_SIZE = 10;

function GuestBookEntriesSkeleton() {
    return (
        <div className="mx-auto max-w-4xl space-y-4 animate-pulse">
            {[1, 2, 3].map((item) => (
                <Card key={item}>
                    <div className="h-6 w-56 rounded bg-sand" />
                    <div className="mt-2 h-4 w-40 rounded bg-sand/70" />
                    <div className="mt-4 h-16 rounded bg-sand/60" />
                </Card>
            ))}
        </div>
    );
}

function formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function GuestBookEntryMedia({ entry }: { entry: { mediaKind?: string | null; mediaUrl?: string | null; mediaThumbnailUrl?: string | null; videoUrl?: string | null } }) {
    const mediaUrl = entry.mediaUrl ?? entry.videoUrl;
    const mediaKind = entry.mediaKind ?? (entry.videoUrl ? 'video' : null);

    if (!mediaUrl) {
        return null;
    }

    if (mediaKind === 'photo') {
        return (
            <a
                href={mediaUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 block overflow-hidden rounded-xl bg-sand"
            >
                <img
                    src={entry.mediaThumbnailUrl ?? mediaUrl}
                    alt="Załączone zdjęcie"
                    className="max-h-[32rem] w-full object-contain"
                    loading="lazy"
                />
            </a>
        );
    }

    return (
        <div className="mt-5 overflow-hidden rounded-xl bg-ink">
            <video
                src={mediaUrl}
                controls
                playsInline
                className="max-h-[32rem] w-full object-contain"
            >
                <a
                    href={mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white underline"
                >
                    Otwórz/pobierz film
                </a>
            </video>
            <div className="bg-ink px-4 pb-4">
                <a
                    href={mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-white underline"
                >
                    Otwórz/pobierz film
                </a>
            </div>
        </div>
    );
}

export default function AdminGuestBookPage() {
    const [currentPage, setCurrentPage] = useState(1);
    const { entriesPage, loading, error } = useAdminGuestBookEntries(currentPage, PAGE_SIZE);
    const { entries, totalPages, totalCount } = entriesPage;

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <AdminBackLink />
                    <PageHeader
                        title="Życzenia Gości"
                        helpText="Wszystkie wiadomości dodane przez gości."
                    />

                    <PageState
                        loading={loading}
                        error={error}
                        isEmpty={entries.length === 0}
                        emptyMessage="Brak życzeń od gości."
                        loadingFallback={<GuestBookEntriesSkeleton />}
                    >
                        <div className="mx-auto mt-12 max-w-4xl">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="font-sans text-sm text-muted">
                                    Strona {currentPage} z {totalPages} • {totalCount} wpisów łącznie
                                </p>
                            </div>

                            <div className="mt-6 space-y-4">
                                {entries.map((entry) => (
                                    <article key={entry.id}>
                                        <Card className="p-6">
                                            <header className="flex flex-wrap items-center justify-between gap-2">
                                                <h2 className="font-serif text-2xl text-ink">{entry.authorName}</h2>
                                                <time className="font-sans text-sm text-muted">{formatDate(entry.createdAt)}</time>
                                            </header>
                                            <p className="mt-4 whitespace-pre-wrap break-words font-sans text-base leading-relaxed text-ink">
                                                {entry.message}
                                            </p>
                                            <GuestBookEntryMedia entry={entry} />
                                        </Card>
                                    </article>
                                ))}
                            </div>

                            <AdminPagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    </PageState>
                </Section>
            </div>
        </Layout>
    );
}
