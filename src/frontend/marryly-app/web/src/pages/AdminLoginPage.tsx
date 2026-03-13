import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../auth/AdminAuthContext';
import ApiErrorAlert from '../components/ApiErrorAlert';
import Layout from '../components/Layout';
import Section from '../components/Section';
import Button from '../components/Button';
import { getErrorMessageForDisplay } from '../errors/apiError';

interface LoginLocationState {
    from?: string;
    reason?: 'session-expired';
}

export default function AdminLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { login, isAuthenticated, isChecking } = useAdminAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const locationState = location.state as LoginLocationState | null;
    const redirectPath = locationState?.from ?? '/admin/dashboard';
    const sessionExpired = locationState?.reason === 'session-expired';

    useEffect(() => {
        if (!isChecking && isAuthenticated) {
            navigate('/admin/dashboard', { replace: true });
        }
    }, [isAuthenticated, isChecking, navigate]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await login(email, password);
            navigate(redirectPath, { replace: true });
        } catch (err: unknown) {
            setError(getErrorMessageForDisplay(err, 'Nie udało się zalogować do panelu.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout showNavigation={false} showFooter={false}>
            <div className="flex min-h-full items-center justify-center">
                <div className="w-full max-w-md px-4">
                <Section background="white">
                    <div className="text-center">
                        <h1 className="font-script text-4xl text-ink md:text-5xl">
                            Panel Młodej Pary
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        {sessionExpired && !error && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left">
                                <p className="font-sans text-sm text-amber-800">
                                    Sesja wygasła. Zaloguj się ponownie.
                                </p>
                            </div>
                        )}
                        {error && <ApiErrorAlert message={error} />}
                        <div>
                            <label htmlFor="email" className="block text-left font-sans text-sm font-medium text-ink">
                                Email
                            </label>
                            <input type="email"
                                id="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className="mt-2 w-full rounded-lg border border-sand bg-white px-4 py-3 font-sans text-ink transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                                autoComplete="username"
                                required
                                placeholder="admin@marryly.pl"/>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-left font-sans text-sm font-medium text-ink">
                                Hasło
                            </label>
                            <input type="password"
                                id="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="mt-2 w-full rounded-lg border border-sand bg-white px-4 py-3 font-sans text-ink transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                                autoComplete="current-password"
                                required
                                placeholder="••••••••"/>
                        </div>

                        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading || isChecking}>
                            {loading ? 'Logowanie...' : 'Zaloguj się'}
                        </Button>
                    </form>
                </Section>
                </div>
            </div>
        </Layout>
    );
}
