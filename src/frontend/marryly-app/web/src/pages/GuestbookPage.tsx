import Layout from '../components/Layout';
import Section from '../components/Section';
import Button from '../components/Button';

export default function GuestbookPage() {
    return (
        <Layout>
            <div className="pt-20">
                <Section background="white">
                    <div className="text-center">
                        <h1 className="font-script text-5xl text-ink md:text-6xl">
                            Księga gości
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                        <p className="mx-auto mt-8 max-w-2xl font-sans text-lg text-muted">
                            Zostaw nam swoje życzenia i wspomnienia z tego wyjątkowego dnia
                        </p>
                    </div>

                    <div className="mx-auto mt-12 max-w-2xl">
                        <form className="space-y-6">
                            <div>
                                <label htmlFor="name" className="block text-left font-sans text-sm font-medium text-ink">
                                    Twoje imię
                                </label>
                                <input type="text"
                                    id="name"
                                    className="mt-2 w-full rounded-lg border border-sand bg-white px-4 py-3 font-sans text-ink transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                                    placeholder="Jan Kowalski"/>
                            </div>

                            <div>
                                <label htmlFor="message" className="block text-left font-sans text-sm font-medium text-ink">
                                    Twoja wiadomość
                                </label>
                                <textarea id="message"
                                    rows={6}
                                    className="mt-2 w-full rounded-lg border border-sand bg-white px-4 py-3 font-sans text-ink transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                                    placeholder="Podziel się z nami czymkolwiek chcesz..."/>
                            </div>

                            <Button type="submit" variant="primary" size="lg" className="w-full">
                                Wyślij życzenia
                            </Button>
                        </form>
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
