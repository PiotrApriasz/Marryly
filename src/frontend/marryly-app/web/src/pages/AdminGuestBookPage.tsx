import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import PageState from '../components/PageState';
import Section from '../components/Section';
import { useAdminGuestBookEntries } from '../hooks/admin/useAdminGuestBookEntries';

function GuestBookEntriesSkeleton() {
    return (
        <div className="mx-auto max-w-4xl space-y-4 animate-pulse">
            {[1, 2, 3].map((item) => (
                <div key={item} className="rounded-2xl border border-sand bg-white p-6">
                    <div className="h-6 w-56 rounded bg-sand" />
                    <div className="mt-2 h-4 w-40 rounded bg-sand/70" />
                    <div className="mt-4 h-16 rounded bg-sand/60" />
                </div>
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

export default function AdminGuestBookPage() {
    const { entries, loading, error } = useAdminGuestBookEntries();

    return (
        <Layout>
            <div className="pt-20">
                <Section background="white">
                    <div className="text-center">
                        <h1 className="font-script text-5xl text-ink md:text-6xl">
                            Życzenia Gości
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                        <p className="mx-auto mt-8 max-w-2xl font-sans text-lg text-muted">
                            Wszystkie wiadomości dodane przez gości
                        </p>
                        <div className="mt-8">
                            <Link to="/admin/dashboard" className="font-sans text-sm font-medium text-ink underline-offset-4 transition-colors hover:text-gold hover:underline">
                                Powrót do panelu
                            </Link>
                        </div>
                    </div>

                    <PageState
                        loading={loading}
                        error={error}
                        isEmpty={entries.length === 0}
                        emptyMessage="Brak życzeń od gości."
                        loadingFallback={<GuestBookEntriesSkeleton />}
                    >
                        <div className="mx-auto mt-12 max-w-4xl space-y-4">
                            {entries.map((entry) => (
                                <article key={entry.id} className="rounded-2xl border border-sand bg-white p-6 shadow-sm">
                                    <header className="flex flex-wrap items-center justify-between gap-2">
                                        <h2 className="font-serif text-2xl text-ink">{entry.authorName}</h2>
                                        <time className="font-sans text-sm text-muted">{formatDate(entry.createdAt)}</time>
                                    </header>
                                    <p className="mt-4 whitespace-pre-wrap break-words font-sans text-base leading-relaxed text-ink">
                                        {entry.message}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </PageState>
                </Section>
            </div>
        </Layout>
    );
}
