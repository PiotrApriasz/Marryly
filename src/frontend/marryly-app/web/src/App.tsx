import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { AuthProvider } from './auth/AuthContext';
import { AdminUploadQueueProvider } from './hooks/admin/useAdminUploadQueue';

export default function App() {
    return (
        <AuthProvider>
            <AdminUploadQueueProvider>
                <RouterProvider router={router} />
            </AdminUploadQueueProvider>
        </AuthProvider>
    );
}
