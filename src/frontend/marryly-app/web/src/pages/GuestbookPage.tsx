import { type FormEvent, useState } from 'react';
import { apiClient } from '../api/client';
import ApiErrorAlert from '../components/ApiErrorAlert';
import Layout from '../components/Layout';
import Section from '../components/Section';
import Button from '../components/Button';
import { getErrorMessageForDisplay } from '../errors/apiError';

export default function GuestbookPage() {
    const [authorName, setAuthorName] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await apiClient.addGuestBookEntry({
                authorName: authorName.trim(),
                message: message.trim(),
            });

            setIsSubmitted(true);
            setAuthorName('');
            setMessage('');
        } catch (err: unknown) {
            setError(getErrorMessageForDisplay(err, 'Nie udało się wysłać życzeń. Spróbuj ponownie.'));
        } finally {
            setLoading(false);
        }
    };

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
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {isSubmitted && !error && (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-left">
                                    <p className="font-sans text-sm text-emerald-800">
                                        Dziękujemy! Twoje życzenia zostały zapisane.
                                    </p>
                                </div>
                            )}
                            {error && <ApiErrorAlert message={error} />}

                            <div>
                                <label htmlFor="name" className="block text-left font-sans text-sm font-medium text-ink">
                                    Twoje imię
                                </label>
                                <input type="text"
                                    id="name"
                                    value={authorName}
                                    onChange={(event) => setAuthorName(event.target.value)}
                                    className="mt-2 w-full rounded-lg border border-sand bg-white px-4 py-3 font-sans text-ink transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                                    required
                                    placeholder="Jan Kowalski"/>
                            </div>

                            <div>
                                <label htmlFor="message" className="block text-left font-sans text-sm font-medium text-ink">
                                    Twoja wiadomość
                                </label>
                                <textarea id="message"
                                    rows={6}
                                    value={message}
                                    onChange={(event) => setMessage(event.target.value)}
                                    className="mt-2 w-full rounded-lg border border-sand bg-white px-4 py-3 font-sans text-ink transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                                    required
                                    placeholder="Podziel się z nami czymkolwiek chcesz..."/>
                            </div>

                            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
                                {loading ? 'Wysyłanie...' : 'Wyślij życzenia'}
                            </Button>
                        </form>
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
