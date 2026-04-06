import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface ProtectedRouteProps {
    requireAdmin?: boolean;
}

export default function ProtectedRoute({ requireAdmin = false }: ProtectedRouteProps) {
    const { isAdmin, isAuthenticated, isChecking } = useAuth();
    const location = useLocation();
    const from = `${location.pathname}${location.search}${location.hash}`;

    if (isChecking) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-paper px-4">
                <p className="font-sans text-muted">Sprawdzanie sesji...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/access" replace state={{ from }} />;
    }

    if (requireAdmin && !isAdmin) {
        return <Navigate to="/access?mode=admin" replace state={{ from, reason: 'admin-required' as const }} />;
    }

    return <Outlet />;
}
