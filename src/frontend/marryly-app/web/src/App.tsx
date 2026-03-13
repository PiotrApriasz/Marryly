import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { AdminAuthProvider } from './auth/AdminAuthContext';

export default function App() {
    return (
        <AdminAuthProvider>
            <RouterProvider router={router} />
        </AdminAuthProvider>
    );
}
