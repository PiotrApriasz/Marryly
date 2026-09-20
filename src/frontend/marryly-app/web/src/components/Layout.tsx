import type {ReactNode} from 'react';
import Navigation from './Navigation';
import Footer from './Footer';
import AdminUploadQueueStatus from './AdminUploadQueueStatus';
import GuestUploadQueueStatus from './GuestUploadQueueStatus';

interface LayoutProps {
    children: ReactNode;
    showNavigation?: boolean;
    showFooter?: boolean;
}

export default function Layout({ 
    children, 
    showNavigation = true,
    showFooter = true 
}: LayoutProps) {
    return (
        <div className="flex min-h-screen flex-col bg-paper">
            {showNavigation && <Navigation />}
            
            <main className="flex-1">
                {children}
            </main>
            
            {showFooter && <Footer />}
            <AdminUploadQueueStatus />
            <GuestUploadQueueStatus />
        </div>
    );
}
