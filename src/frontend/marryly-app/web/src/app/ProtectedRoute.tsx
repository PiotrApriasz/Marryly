import { Navigate, Outlet, useLocation } from 'react-router-dom';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../auth/AuthContext';

interface ProtectedRouteProps {
    requireAdmin?: boolean;
}

export default function ProtectedRoute({ requireAdmin = false }: ProtectedRouteProps) {
    const { isAdmin, isAuthenticated, isChecking } = useAuth();
    const location = useLocation();
    const from = `${location.pathname}${location.search}${location.hash}`;

    if (isChecking) {
        return <LoadingState fullscreen />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/access" replace state={{ from }} />;
    }

    if (requireAdmin && !isAdmin) {
        return <Navigate to="/access?mode=admin" replace state={{ from, reason: 'admin-required' as const }} />;
    }

    return <Outlet />;
}
