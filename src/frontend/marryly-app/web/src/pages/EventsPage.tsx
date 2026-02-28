import Layout from '../components/Layout';
import Section from '../components/Section';
import { useEvents } from '../hooks/useEvents';

function EventsSkeleton() {
    return (
        <div className="mx-auto max-w-3xl space-y-4 animate-pulse">
            {[1, 2, 3, 4].map((item) => (
                <div key={item} className="rounded-lg border border-sand bg-white p-6">
                    <div className="flex items-start gap-4">
                        <div className="h-16 w-16 bg-sand rounded-lg" />
                        <div className="flex-1 space-y-2">
                            <div className="h-6 w-48 bg-sand rounded" />
                            <div className="h-4 w-32 bg-sand/50 rounded" />
                            <div className="h-4 w-40 bg-sand/50 rounded" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pl-PL', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'UTC'
    });
}

export default function EventsPage() {
    const { events, loading, error } = useEvents();

    return (
        <Layout>
            <div className="pt-20">
                <Section background="white">
                    <div className="text-center mb-12">
                        <h1 className="font-script text-5xl text-ink md:text-6xl">
                            Wydarzenia
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                    </div>

                    {loading && <EventsSkeleton />}

                    {error && (
                        <div className="mx-auto max-w-2xl text-center">
                            <div className="rounded-lg border border-rose-200 bg-rose-50 p-6">
                                <p className="font-sans text-lg text-rose-800">
                                    {error}
                                </p>
                                <p className="mt-2 text-sm text-rose-600">
                                    Spróbuj odświeżyć stronę
                                </p>
                            </div>
                        </div>
                    )}

                    {!loading && !error && events.length > 0 && (
                        <div className="mx-auto max-w-3xl">
                            <div className="space-y-4">
                                {events.map((event) => (
                                    <div
                                        key={event.id}
                                        className="rounded-lg border border-sand bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                                    >
                                        <div className="flex items-start gap-6">
                                            <div className="flex-shrink-0 text-center">
                                                <div className="flex h-16 w-16 flex-col items-center justify-center rounded-lg bg-gold/10">
                                                    <span className="font-script text-2xl text-gold">
                                                        {formatTime(event.startsAt)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-script text-2xl text-ink">
                                                    {event.title}
                                                </h3>
                                                <p className="mt-2 flex items-center text-sm text-muted">
                                                    <svg
                                                        className="mr-2 h-4 w-4"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                                        />
                                                    </svg>
                                                    {formatTime(event.startsAt)} - {formatTime(event.endsAt)}
                                                </p>
                                                <p className="mt-1 flex items-center text-sm text-muted">
                                                    <svg
                                                        className="mr-2 h-4 w-4"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                                        />
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                                        />
                                                    </svg>
                                                    {event.location}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!loading && !error && events.length === 0 && (
                        <div className="mx-auto max-w-2xl text-center">
                            <p className="font-sans text-lg text-muted">
                                Wkrótce pojawi się tutaj harmonogram dnia
                            </p>
                        </div>
                    )}
                </Section>
            </div>
        </Layout>
    );
}
