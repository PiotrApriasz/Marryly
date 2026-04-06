import Layout from '../components/Layout';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import { useAdminOverview } from '../hooks/admin/useAdminOverview';
import { Link } from 'react-router-dom';

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

export default function AdminDashboardPage() {
    const { overview, loading, error } = useAdminOverview();
    const dashboardItems = [
        { title: 'Zdjęcia', icon: '📸', count: String(overview.photosCount), path: null },
        { title: 'Goście', icon: '👥', count: String(overview.guestsCount), path: null },
        { title: 'Wpisy', icon: '💬', count: String(overview.wishesCount), path: '/admin/guestbook' },
        { title: 'Menu', icon: '🍽️', count: overview.menuPublished ? '1' : '0', path: null },
        { title: 'Atrakcje', icon: '🎉', count: String(overview.attractionsCount), path: null },
        { title: 'Ustawienia', icon: '⚙️', count: String(overview.settingsCount), path: null },
    ];

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader
                        title="Panel Młodej Pary"
                        description="Zarządzanie treścią, gośćmi i ustawieniami wesela"
                    />

                    <PageState
                        loading={loading}
                        error={error}
                        isEmpty={false}
                        emptyMessage=""
                        loadingFallback={<DashboardSkeleton />}
                    >
                        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
