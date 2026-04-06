import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApiClient } from '../api/authApiClient';
import { subscribeToAuthFailures } from '../api/authEvents';
import { clearAccessSession, clearAppSessionCache, hasValidAccessToken, readAccessUser, writeAccessUser } from '../api/accessTokenStorage';
import { ApiError } from '../errors/apiError';
import type { AccessRole, AccessUser } from '../types/auth.types';

interface AuthContextValue {
    isAuthenticated: boolean;
    isChecking: boolean;
    isAdmin: boolean;
    user: AccessUser | null;
    authErrorMessage: string | null;
    loginWithAccessCode: (accessCode: string) => Promise<void>;
    loginAsAdmin: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
    children: ReactNode;
}

function getRole(user: AccessUser | null): AccessRole | null {
    return user?.role ?? null;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<AccessUser | null>(null);
    const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

    const clearSessionState = useCallback(() => {
        clearAccessSession();
        setIsAuthenticated(false);
        setUser(null);
    }, []);

    const applyAuthenticatedUser = useCallback((nextUser: AccessUser) => {
        clearAppSessionCache();
        writeAccessUser(nextUser);
        setIsAuthenticated(true);
        setUser(nextUser);
        setAuthErrorMessage(null);
    }, []);

    const refreshSession = useCallback(async () => {
        const hasValidToken = hasValidAccessToken();
        const storedUser = readAccessUser();

        if (!hasValidToken) {
            clearSessionState();
            return;
        }

        try {
            const session = await authApiClient.getSession();
            if (session.authenticated && session.user) {
                applyAuthenticatedUser(session.user);
                return;
            }
            clearSessionState();
        } catch (error: unknown) {
            if (error instanceof ApiError && error.status === 401) {
                clearSessionState();
                return;
            }

            if (storedUser) {
                setIsAuthenticated(true);
                setUser(storedUser);
                setAuthErrorMessage(null);
                return;
            }

            throw error;
        }
    }, [applyAuthenticatedUser, clearSessionState]);

    useEffect(() => {
        let isActive = true;

        const checkSession = async () => {
            try {
                await refreshSession();
            } catch (error) {
                console.error('Failed to verify access session', error);
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
        return subscribeToAuthFailures((detail) => {
            if (detail.reason === 'unauthorized') {
                setAuthErrorMessage(detail.detail || detail.message || 'Sesja wygasła. Zaloguj się ponownie.');
                clearSessionState();
                return;
            }

            setAuthErrorMessage(detail.detail || detail.message || 'Brak dostępu do tej sekcji.');
        });
    }, [clearSessionState]);

    const loginWithAccessCode = useCallback(async (accessCode: string) => {
        setAuthErrorMessage(null);
        const loginResponse = await authApiClient.loginWithAccessCode(accessCode);

        if (loginResponse.authenticated && loginResponse.user && loginResponse.accessToken) {
            applyAuthenticatedUser(loginResponse.user);
            return;
        }

        throw new Error('Logowanie kodem zwróciło niepełną odpowiedź.');
    }, [applyAuthenticatedUser]);

    const loginAsAdmin = useCallback(async (email: string, password: string) => {
        setAuthErrorMessage(null);
        const loginResponse = await authApiClient.loginAsAdmin(email, password);

        if (loginResponse.authenticated && loginResponse.user && loginResponse.accessToken) {
            applyAuthenticatedUser(loginResponse.user);
            return;
        }

        throw new Error('Logowanie admina zwróciło niepełną odpowiedź.');
    }, [applyAuthenticatedUser]);

    const logout = useCallback(async () => {
        await authApiClient.logout();
        setAuthErrorMessage(null);
        clearSessionState();
    }, [clearSessionState]);

    const isAdmin = getRole(user) === 'admin';

    const value = useMemo<AuthContextValue>(
        () => ({
            isAuthenticated,
            isChecking,
            isAdmin,
            user,
            authErrorMessage,
            loginWithAccessCode,
            loginAsAdmin,
            logout,
            refreshSession,
        }),
        [authErrorMessage, isAdmin, isAuthenticated, isChecking, loginAsAdmin, loginWithAccessCode, logout, refreshSession, user]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }

    return context;
}
