import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { adminAuthClient } from '../api/adminAuthClient';
import { ApiError } from '../errors/apiError';
import type { AdminUser } from '../types/admin.types';

interface AdminAuthContextValue {
    isAuthenticated: boolean;
    isChecking: boolean;
    user: AdminUser | null;
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

    const refreshSession = useCallback(async () => {
        try {
            const session = await adminAuthClient.getSession();
            if (session.authenticated && session.user) {
                setIsAuthenticated(true);
                setUser(session.user);
                return;
            }

            setIsAuthenticated(false);
            setUser(null);
        } catch (error: unknown) {
            if (error instanceof ApiError && error.status === 401) {
                setIsAuthenticated(false);
                setUser(null);
                return;
            }

            throw error;
        }
    }, []);

    useEffect(() => {
        let isActive = true;

        const checkSession = async () => {
            try {
                await refreshSession();
            } catch (error) {
                console.error('Failed to verify admin session', error);
                if (isActive) {
                    setIsAuthenticated(false);
                    setUser(null);
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
    }, [refreshSession]);

    const login = useCallback(async (email: string, password: string) => {
        const response = await adminAuthClient.login(email, password);
        setIsAuthenticated(response.authenticated);
        setUser(response.user);
    }, []);

    const logout = useCallback(async () => {
        await adminAuthClient.logout();
        setIsAuthenticated(false);
        setUser(null);
    }, []);

    const value = useMemo<AdminAuthContextValue>(
        () => ({
            isAuthenticated,
            isChecking,
            user,
            login,
            logout,
            refreshSession,
        }),
        [isAuthenticated, isChecking, user, login, logout, refreshSession]
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
