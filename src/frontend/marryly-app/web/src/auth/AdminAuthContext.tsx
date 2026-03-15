import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { adminAuthClient } from '../api/adminAuthClient';
import { subscribeToAdminAuthFailures } from '../api/adminAuthEvents';
import { clearAdminAccessToken, hasValidAdminAccessToken, readAdminUser, writeAdminUser } from '../api/adminTokenStorage';
import { ApiError } from '../errors/apiError';
import type { AdminUser } from '../types/admin.types';

interface AdminAuthContextValue {
    isAuthenticated: boolean;
    isChecking: boolean;
    user: AdminUser | null;
    authErrorMessage: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

interface AdminAuthProviderProps {
    children: ReactNode;
}

export function AdminAuthProvider({ children }: AdminAuthProviderProps) {
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<AdminUser | null>(null);
    const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

    const clearSessionState = useCallback((options?: { preserveToken?: boolean }) => {
        if (!options?.preserveToken) {
            clearAdminAccessToken();
        }

        setIsAuthenticated(false);
        setUser(null);
    }, []);

    const refreshSession = useCallback(async () => {
        const hasValidToken = hasValidAdminAccessToken();
        const storedUser = readAdminUser();

        if (!hasValidToken) {
            clearSessionState();
            return;
        }

        try {
            const session = await adminAuthClient.getSession();
            if (session.authenticated && session.user) {
                writeAdminUser(session.user);
                setIsAuthenticated(true);
                setUser(session.user);
                setAuthErrorMessage(null);
                return;
            }

            if (storedUser) {
                setIsAuthenticated(true);
                setUser(storedUser);
                setAuthErrorMessage(null);
                return;
            }

            clearSessionState();
        } catch (error: unknown) {
            if (error instanceof ApiError && error.status === 401) {
                if (storedUser && hasValidAdminAccessToken()) {
                    setIsAuthenticated(true);
                    setUser(storedUser);
                    return;
                }

                clearSessionState({ preserveToken: true });
                return;
            }

            throw error;
        }
    }, [clearSessionState]);

    useEffect(() => {
        let isActive = true;

        const checkSession = async () => {
            try {
                await refreshSession();
            } catch (error) {
                console.error('Failed to verify admin session', error);
                if (isActive) {
                    clearSessionState();
                }
            } finally {
                if (isActive) {
                    setIsChecking(false);
                }
            }
        };

        void checkSession();

        return () => {
            isActive = false;
        };
    }, [clearSessionState, refreshSession]);

    useEffect(() => {
        return subscribeToAdminAuthFailures((detail) => {
            if (detail.reason === 'unauthorized') {
                const diagnosticMessage = detail.detail || detail.message || 'Sesja wygasła lub token został odrzucony.';
                const diagnosticCode = detail.code ? ` [${detail.code}]` : '';
                setAuthErrorMessage(`${diagnosticMessage}${diagnosticCode}`);
                clearSessionState({ preserveToken: true });
            }
        });
    }, [clearSessionState]);

    const login = useCallback(async (email: string, password: string) => {
        setAuthErrorMessage(null);
        const loginResponse = await adminAuthClient.login(email, password);

        if (loginResponse.authenticated && loginResponse.user && loginResponse.accessToken) {
            writeAdminUser(loginResponse.user);
            setIsAuthenticated(true);
            setUser(loginResponse.user);
            setAuthErrorMessage(null);
            return;
        }

        throw new Error('Logowanie zwróciło niepełną odpowiedź. Brakuje accessToken lub danych użytkownika.');
    }, []);

    const logout = useCallback(async () => {
        await adminAuthClient.logout();
        setAuthErrorMessage(null);
        clearSessionState();
    }, [clearSessionState]);

    const value = useMemo<AdminAuthContextValue>(
        () => ({
            isAuthenticated,
            isChecking,
            user,
            authErrorMessage,
            login,
            logout,
            refreshSession,
        }),
        [isAuthenticated, isChecking, user, authErrorMessage, login, logout, refreshSession]
    );

    return (
        <AdminAuthContext.Provider value={value}>
            {children}
        </AdminAuthContext.Provider>
    );
}

export function useAdminAuth(): AdminAuthContextValue {
    const context = useContext(AdminAuthContext);
    if (!context) {
        throw new Error('useAdminAuth must be used within AdminAuthProvider');
    }

    return context;
}
