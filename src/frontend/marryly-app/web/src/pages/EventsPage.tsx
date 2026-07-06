import Layout from '../components/Layout';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import { appText } from '../content/appText';
import { useEvents } from '../hooks/useEvents';

function EventsSkeleton() {
    return (
        <div className="mx-auto max-w-3xl space-y-4 animate-pulse">
            {[1, 2, 3, 4].map((item) => (
                <Card key={item} className="rounded-lg">
                    <div className="flex items-start gap-4">
                        <div className="h-16 w-16 rounded-lg bg-sand" />
                        <div className="flex-1 space-y-2">
                            <div className="h-6 w-48 rounded bg-sand" />
                            <div className="h-4 w-32 rounded bg-sand/50" />
                            <div className="h-4 w-40 rounded bg-sand/50" />
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

function formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString(appText.common.locale, {
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'UTC'
    });
}

export default function EventsPage() {
    const { events, loading, error } = useEvents();

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader title={appText.public.events.title} className="mb-12" />

                    <PageState
                        loading={loading}
                        error={error}
                        isEmpty={events.length === 0}
                        emptyMessage={appText.public.events.empty}
                        loadingFallback={<EventsSkeleton />}
                    >
                        <div className="mx-auto max-w-3xl">
                            <div className="space-y-4">
                                {events.map((event) => (
                                    <Card
                                        key={event.id}
                                        className="rounded-lg transition-shadow hover:shadow-md"
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
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </PageState>
                </Section>
            </div>
        </Layout>
    );
}
