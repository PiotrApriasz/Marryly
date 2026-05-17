import Layout from '../components/Layout';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import { useAdminOverview } from '../hooks/admin/useAdminOverview';
import { useAdminGuests } from '../hooks/admin/useAdminGuests';
import { Link } from 'react-router-dom';
import type { AdminGuestListSummary } from '../types/admin.types';

function DashboardSkeleton() {
    return (
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((item) => (
                <Card key={item} className="text-center">
                    <div className="mx-auto h-10 w-10 rounded-full bg-sand" />
                    <div className="mx-auto mt-4 h-6 w-24 rounded bg-sand" />
                    <div className="mx-auto mt-3 h-8 w-12 rounded bg-sand/70" />
                </Card>
            ))}
        </div>
    );
}

function GuestDashboardCard({
    summary,
    loading,
}: {
    summary: AdminGuestListSummary;
    loading: boolean;
}) {
    const metrics = [
        { label: 'Razem z Parą Młodą', value: summary.attendingTotalWithCouple },
        { label: 'Dorośli', value: summary.adultsCount },
        { label: 'Usługodawcy', value: summary.vendorsCount },
        { label: 'Dzieci 3-10', value: summary.children3To10Count },
        { label: 'Dzieci do 3 lat', value: summary.childrenUnder3Count },
        { label: 'Noclegi', value: summary.accommodationNeededCount },
        { label: 'Transport', value: summary.transportNeededCount },
    ];

    return (
        <Link to="/admin/guests" className="block lg:col-span-3">
            <Card className="dashboard-guests-card">
                <div className="dashboard-guests-card-main">
                    <div>
                        <h3 className="font-serif text-2xl text-ink">Lista gości</h3>
                    </div>
                    <div className="text-left lg:text-right">
                        <p className="font-sans text-sm text-muted">Potwierdziło</p>
                        {loading ? (
                            <div className="mt-2 h-9 w-28 rounded bg-sand/70" />
                        ) : (
                            <div className="mt-1 flex items-baseline gap-2 lg:justify-end">
                                <p className="text-4xl font-bold leading-none text-gold">{summary.confirmedCount}/{summary.invitedCount}</p>
                                <p className="font-sans text-sm text-muted">{summary.confirmationPercent}%</p>
                            </div>
                        )}
                        <div className="guest-summary-progress mt-4">
                            <div
                                className="guest-summary-progress-value"
                                style={{ width: `${Math.min(100, summary.confirmationPercent)}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {metrics.map((item) => (
                        <div key={item.label} className="guest-summary-metric">
                            <p className="font-sans text-xs text-muted">{item.label}</p>
                            {loading ? (
                                <div className="mt-2 h-6 w-10 rounded bg-sand/70" />
                            ) : (
                                <p className="mt-1 text-xl font-bold text-ink">{item.value}</p>
                            )}
                        </div>
                    ))}
                </div>
            </Card>
        </Link>
    );
}

export default function AdminDashboardPage() {
    const { overview, loading, error } = useAdminOverview();
    const { guestList, loading: guestsLoading } = useAdminGuests();
    const dashboardItems = [
        { title: 'Galeria', icon: '📸', count: String(overview.photosCount), path: '/admin/albums' },
        { title: 'Wpisy', icon: '💬', count: String(overview.wishesCount), path: '/admin/guestbook' },
        { title: 'Menu', icon: '🍽️', count: overview.menuPublished ? '1' : '0', path: '/admin/menu' },
        { title: 'Atrakcje', icon: '🎉', count: String(overview.attractionsCount), path: null },
        { title: 'Ustawienia', icon: '⚙️', count: String(overview.settingsCount), path: null },
    ];

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader
                        title="Panel Młodej Pary"
                        helpText="Zarządzanie treścią, gośćmi i ustawieniami wesela."
                    />

                    <PageState
                        loading={loading}
                        error={error}
                        isEmpty={false}
                        emptyMessage=""
                        loadingFallback={<DashboardSkeleton />}
                    >
                        <div className="mt-12 grid gap-6 lg:grid-cols-3">
                            <GuestDashboardCard summary={guestList.summary} loading={guestsLoading} />
                        </div>

                        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {dashboardItems.map((item) => {
                                const cardContent = (
                                    <Card className="text-center transition-all hover:shadow-md">
                                        <div className="text-4xl">{item.icon}</div>
                                        <h3 className="mt-4 font-serif text-xl text-ink">{item.title}</h3>
                                        <p className="mt-2 text-3xl font-bold text-gold">{item.count}</p>
                                    </Card>
                                );

                                if (!item.path) {
                                    return <div key={item.title}>{cardContent}</div>;
                                }

                                return (
                                    <Link key={item.title} to={item.path} className="block">
                                        {cardContent}
                                    </Link>
                                );
                            })}
                        </div>
                    </PageState>
                </Section>
            </div>
        </Layout>
    );
}
