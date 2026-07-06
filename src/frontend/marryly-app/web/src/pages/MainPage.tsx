import Layout from '../components/Layout';
import HeroSection from '../components/HeroSection';
import Section from '../components/Section';
import Button from '../components/Button';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import { Link } from 'react-router-dom';
import mainPagePhoto from '../assets/mainPagePhoto.jpeg';

const quickLinks = [
    {
        path: '/menu',
        title: 'Menu wesela',
        description: 'Zobacz, co serwujemy',
        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    },
    {
        path: '/attractions',
        title: 'Atrakcje',
        description: 'Co przygotowaliśmy',
        icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
        path: '/events',
        title: 'Wydarzenia',
        description: 'Harmonogram dnia',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    },
    {
        path: '/gallery',
        title: 'Galeria',
        description: 'Zobacz albumy',
        icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
    },
    {
        path: '/guestupload',
        title: 'Dodaj zdjęcie/film',
        description: 'Podziel się wspomnieniami',
        icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
    },
    {
        path: '/guestbook',
        title: 'Księga gości',
        description: 'Zostaw życzenia',
        icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    },
];

export default function MainPage() {
    return (
        <Layout>
            <HeroSection names={{ first: 'Alicja', second: 'Piotr' }}
                date="31 lipca 2026"
                location="Willa Poprad"
                backgroundImage={mainPagePhoto}/>

            {/* Welcome Section */}
            <Section background="white">
                <div className="text-center">
                    <PageHeader
                        title="Witajcie w naszym dniu"
                        titleAs="h2"
                        titleClassName="font-script text-4xl md:text-5xl"
                    />
                    <p className="page-description leading-relaxed">
                        Z radością zapraszamy Was do wspólnego świętowania naszego szczęścia.
                        To wyjątkowy dzień, który chcemy przeżyć razem z najbliższymi nam osobami.
                    </p>
                    <p className="mx-auto mt-4 max-w-2xl font-sans text-lg leading-relaxed text-muted">
                        Na tej stronie znajdziecie wszystkie informacje dotyczące naszego wesela,
                        a także będziecie mogli podzielić się z nami swoimi zdjęciami i wspomnieniami.
                    </p>
                </div>
            </Section>

            {/* Quick Links Section */}
            <Section background="paper">
                <div className="text-center">
                    <PageHeader
                        title="Informacje dla gości"
                        titleAs="h3"
                        titleClassName="font-serif text-3xl md:text-4xl"
                    />
                    
                    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {quickLinks.map((link) => (
                            <Link key={link.path} to={link.path} className="group">
                                <Card interactive padding="xl" className="hover:shadow-lg">
                                    <div className="mb-4 flex justify-center">
                                        <svg className="h-12 w-12 text-gold transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
                                        </svg>
                                    </div>
                                    <h4 className="font-serif text-xl text-ink">{link.title}</h4>
                                    <p className="mt-2 text-sm text-muted">{link.description}</p>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </div>
            </Section>

            {/* CTA Section */}
            <Section background="white">
                <div className="text-center">
                    <PageHeader
                        title="Nie możemy się doczekać!"
                        titleAs="h3"
                        titleClassName="font-script text-3xl md:text-4xl"
                        description="Dziękujemy, że będziecie z nami w tym wyjątkowym dniu"
                        descriptionClassName="max-w-xl"
                    />
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <Link to="/guestupload">
                            <Button variant="primary" size="lg">
                                Dodaj zdjęcie/film
                            </Button>
                        </Link>
                        <Link to="/guestbook">
                            <Button variant="secondary" size="lg">
                                Zostaw życzenia
                            </Button>
                        </Link>
                    </div>
                </div>
            </Section>
        </Layout>
    );
}
