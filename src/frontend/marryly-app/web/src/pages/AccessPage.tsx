import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ApiErrorAlert from '../components/ApiErrorAlert';
import Button from '../components/Button';
import Field from '../components/Field';
import Input from '../components/Input';
import Layout from '../components/Layout';
import Notice from '../components/Notice';
import PageHeader from '../components/PageHeader';
import { getErrorMessageForDisplay } from '../errors/apiError';
import type { AccessRole } from '../types/auth.types';

interface AccessLocationState {
    from?: string;
    reason?: 'admin-required' | 'session-expired';
}

interface AccessShellProps {
    title: string;
    description: string;
    children: ReactNode;
}

function AccessShell({ title, description, children }: AccessShellProps) {
    return (
        <div className="auth-shell">
            <div className="auth-shell-glow" />
            <div className="relative">
                <PageHeader
                    title={title}
                    description={description}
                    titleClassName="page-title-elevated"
                    descriptionClassName="page-description-compact"
                />
                <div className="mx-auto mt-10 max-w-xl text-left">
                    {children}
                </div>
            </div>
        </div>
    );
}

function normalizeRedirectPath(value?: string | null): string | undefined {
    if (!value) {
        return undefined;
    }

    const trimmedValue = value.trim();

    if (!trimmedValue.startsWith('/') || trimmedValue.startsWith('//')) {
        return undefined;
    }

    return trimmedValue;
}

function getRedirectPath(role: AccessRole, requestedPath?: string): string {
    if (role === 'admin') {
        return requestedPath?.startsWith('/admin') ? requestedPath : '/admin/dashboard';
    }

    if (requestedPath && !requestedPath.startsWith('/admin')) {
        return requestedPath;
    }

    return '/';
}

export default function AccessPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const queryAccessCode = searchParams.get('accessCode')?.trim() ?? '';
    const queryRedirectTo = normalizeRedirectPath(searchParams.get('redirectTo'));
    const adminModeRequested = searchParams.get('mode') === 'admin';
    const location = useLocation();
    const navigate = useNavigate();
    const locationState = location.state as AccessLocationState | null;
    const requestedPath = normalizeRedirectPath(locationState?.from) ?? queryRedirectTo;
    const [accessCode, setAccessCode] = useState(queryAccessCode);
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [guestLoading, setGuestLoading] = useState(false);
    const [adminLoading, setAdminLoading] = useState(false);
    const [guestError, setGuestError] = useState<string | null>(null);
    const [adminError, setAdminError] = useState<string | null>(null);
    const [isAdminFormVisible, setIsAdminFormVisible] = useState(adminModeRequested);
    const attemptedAutoLoginRef = useRef<string | null>(null);
    const { authErrorMessage, isAdmin, isAuthenticated, isChecking, loginAsAdmin, loginWithAccessCode, user } = useAuth();

    useEffect(() => {
        setAccessCode(queryAccessCode);
    }, [queryAccessCode]);

    useEffect(() => {
        setIsAdminFormVisible(adminModeRequested);
    }, [adminModeRequested]);

    const bannerMessage = useMemo(() => {
        if (locationState?.reason === 'admin-required') {
            return 'Ta sekcja wymaga dostępu administratora. Zaloguj się poniżej jako admin.';
        }

        return authErrorMessage;
    }, [authErrorMessage, locationState?.reason]);

    useEffect(() => {
        if (isChecking || !isAuthenticated || !user) {
            return;
        }

        if (adminModeRequested && !isAdmin) {
            return;
        }

        navigate(getRedirectPath(user.role, requestedPath), { replace: true });
    }, [adminModeRequested, isAdmin, isAuthenticated, isChecking, navigate, requestedPath, user]);

    useEffect(() => {
        if (isChecking || isAuthenticated || !queryAccessCode) {
            return;
        }

        if (attemptedAutoLoginRef.current === queryAccessCode) {
            return;
        }

        attemptedAutoLoginRef.current = queryAccessCode;
        setGuestLoading(true);
        setGuestError(null);

        void loginWithAccessCode(queryAccessCode)
            .then(() => {
                navigate(getRedirectPath('guest', requestedPath), { replace: true });
            })
            .catch((error: unknown) => {
                setGuestError(getErrorMessageForDisplay(error, 'Nie udało się użyć kodu dostępu.'));
            })
            .finally(() => {
                setGuestLoading(false);
            });
    }, [isAuthenticated, isChecking, loginWithAccessCode, navigate, queryAccessCode, requestedPath]);

    const handleGuestSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setGuestLoading(true);
        setGuestError(null);

        try {
            await loginWithAccessCode(accessCode.trim());
            navigate(getRedirectPath('guest', requestedPath), { replace: true });
        } catch (error: unknown) {
            setGuestError(getErrorMessageForDisplay(error, 'Nie udało się zalogować kodem dostępu.'));
        } finally {
            setGuestLoading(false);
        }
    };

    const handleAdminSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setAdminLoading(true);
        setAdminError(null);

        try {
            await loginAsAdmin(adminEmail.trim(), adminPassword);
            navigate(getRedirectPath('admin', requestedPath), { replace: true });
        } catch (error: unknown) {
            setAdminError(getErrorMessageForDisplay(error, 'Nie udało się zalogować do panelu.'));
        } finally {
            setAdminLoading(false);
        }
    };

    const handleToggleAdminForm = () => {
        setIsAdminFormVisible((current) => {
            const nextValue = !current;
            const nextParams = new URLSearchParams(searchParams);

            if (nextValue) {
                nextParams.set('mode', 'admin');
            } else {
                nextParams.delete('mode');
            }

            setSearchParams(nextParams, { replace: true });
            return nextValue;
        });
    };

    const accessDescription = queryAccessCode
        ? 'Trwa sprawdzanie kodu dostępu z kodu QR.'
        : 'Aby uzyskać dostęp do aplikacji, wpisz kod dostępu lub zeskanuj kod QR dostępny na sali.';
    const adminDescription = 'Zaloguj się jako admin.';

    return (
        <Layout showNavigation={false} showFooter={false}>
            <div className="flex min-h-full items-center justify-center px-4 py-10">
                <div className="w-full max-w-3xl">
                    {bannerMessage ? (
                        <Notice tone="warning" className="mb-5 px-5 py-4 text-left shadow-[0_12px_30px_rgba(160,120,86,0.12)]">
                            <p className="whitespace-pre-wrap font-sans text-sm leading-6">
                                {bannerMessage}
                            </p>
                        </Notice>
                    ) : null}

                    {adminModeRequested && isAuthenticated && !isAdmin ? (
                        <Notice tone="info" className="mb-5 px-5 py-4 text-left shadow-[0_12px_30px_rgba(160,120,86,0.12)]">
                            <p className="font-sans text-sm leading-6">
                                Jesteś zalogowany jako gość. Aby wejść do panelu, użyj danych administratora.
                            </p>
                        </Notice>
                    ) : null}

                    {isAdminFormVisible ? (
                        <AccessShell
                            title="Młoda Para"
                            description={adminDescription}
                        >
                            <form className="space-y-5" onSubmit={handleAdminSubmit}>
                                {adminError ? <ApiErrorAlert message={adminError} /> : null}

                                <Field label="Email" htmlFor="adminEmail">
                                    <Input
                                        type="email"
                                        id="adminEmail"
                                        value={adminEmail}
                                        onChange={(event) => setAdminEmail(event.target.value)}
                                        surface="muted"
                                        autoComplete="username"
                                        required
                                        placeholder="admin@marryly.pl"
                                    />
                                </Field>

                                <Field label="Hasło" htmlFor="adminPassword">
                                    <Input
                                        type="password"
                                        id="adminPassword"
                                        value={adminPassword}
                                        onChange={(event) => setAdminPassword(event.target.value)}
                                        surface="muted"
                                        autoComplete="current-password"
                                        required
                                        placeholder="••••••••"
                                    />
                                </Field>

                                <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="lg"
                                        className="flex-1"
                                        loading={adminLoading}
                                        disabled={isChecking}
                                    >
                                        Przejdź do panelu admina
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="lg"
                                        className="flex-1"
                                        onClick={handleToggleAdminForm}
                                    >
                                        Wróć do logowania jako gość
                                    </Button>
                                </div>
                            </form>
                        </AccessShell>
                    ) : (
                        <AccessShell
                            title="Wymagany dostęp"
                            description={accessDescription}
                        >
                            <form className="space-y-5" onSubmit={handleGuestSubmit}>
                                {guestError ? <ApiErrorAlert message={guestError} /> : null}

                                <Field label="Kod dostępu" htmlFor="accessCode">
                                    <Input
                                        type="text"
                                        id="accessCode"
                                        value={accessCode}
                                        onChange={(event) => setAccessCode(event.target.value)}
                                        surface="muted"
                                        autoComplete="one-time-code"
                                        required
                                        placeholder="Wpisz kod dostępu"
                                    />
                                </Field>

                                <div className="grid gap-3 pt-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="lg"
                                        className="w-full"
                                        loading={guestLoading}
                                        disabled={isChecking}
                                    >
                                        Wejdź do aplikacji
                                    </Button>
                                    <span className="text-center font-sans text-sm uppercase tracking-[0.28em] text-muted">
                                        lub
                                    </span>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="lg"
                                        className="w-full"
                                        onClick={handleToggleAdminForm}
                                        disabled={isChecking}
                                    >
                                        Zaloguj się jako admin
                                    </Button>
                                </div>
                            </form>
                        </AccessShell>
                    )}
                </div>
            </div>
        </Layout>
    );
}
