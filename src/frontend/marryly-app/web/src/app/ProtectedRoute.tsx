import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../auth/AdminAuthContext';

export default function ProtectedRoute() {
    const { isAuthenticated, isChecking } = useAdminAuth();
    const location = useLocation();

    if (isChecking) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-paper px-4">
                <p className="font-sans text-muted">Sprawdzanie sesji...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/admin" replace state={{ from: location.pathname, reason: 'session-expired' }} />;
    }

    return <Outlet />;
}
