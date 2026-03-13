import Layout from '../components/Layout';
import PageState from '../components/PageState';
import Section from '../components/Section';
import { useAdminOverview } from '../hooks/admin/useAdminOverview';
import { Link } from 'react-router-dom';

function DashboardSkeleton() {
    return (
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="rounded-2xl border border-sand bg-white p-6 text-center">
                    <div className="mx-auto h-10 w-10 rounded-full bg-sand" />
                    <div className="mx-auto mt-4 h-6 w-24 rounded bg-sand" />
                    <div className="mx-auto mt-3 h-8 w-12 rounded bg-sand/70" />
                </div>
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
            <div className="pt-20">
                <Section background="white">
                    <div className="text-center">
                        <h1 className="font-script text-5xl text-ink md:text-6xl">
                            Panel Młodej Pary
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                        <p className="mx-auto mt-8 max-w-2xl font-sans text-lg text-muted">
                            Zarządzanie treścią, gośćmi i ustawieniami wesela
                        </p>
                    </div>

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
                                    <div className="rounded-2xl border border-sand bg-white p-6 text-center transition-all hover:shadow-md">
                                        <div className="text-4xl">{item.icon}</div>
                                        <h3 className="mt-4 font-serif text-xl text-ink">{item.title}</h3>
                                        <p className="mt-2 text-3xl font-bold text-gold">{item.count}</p>
                                    </div>
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
