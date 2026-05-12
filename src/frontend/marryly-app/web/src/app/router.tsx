import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RouteLoadingScreen from '../components/RouteLoadingScreen';

const AccessPage = lazy(() => import('../pages/AccessPage'));
const MainPage = lazy(() => import('../pages/MainPage'));
const MenuPage = lazy(() => import('../pages/MenuPage'));
const AttractionsPage = lazy(() => import('../pages/AttractionsPage'));
const EventsPage = lazy(() => import('../pages/EventsPage'));
const GuestbookPage = lazy(() => import('../pages/GuestbookPage'));
const GuestUploadPage = lazy(() => import('../pages/GuestUploadPage'));
const CurrentPhotosPage = lazy(() => import('../pages/CurrentPhotosPage'));
const GalleryPage = lazy(() => import('../pages/GalleryPage'));
const GalleryAlbumPage = lazy(() => import('../pages/GalleryAlbumPage'));
const SlideshowPage = lazy(() => import('../pages/SlideshowPage'));
const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage'));
const AdminGuestBookPage = lazy(() => import('../pages/AdminGuestBookPage'));
const AdminAlbumsPage = lazy(() => import('../pages/AdminAlbumsPage'));
const AdminAlbumPage = lazy(() => import('../pages/AdminAlbumPage'));

function pageElement(PageComponent: LazyExoticComponent<ComponentType>) {
    return (
        <Suspense fallback={<RouteLoadingScreen />}>
            <PageComponent />
        </Suspense>
    );
}

export const router = createBrowserRouter([
    { path: '/access', element: pageElement(AccessPage) },
    { path: '/admin', element: <Navigate to="/access?mode=admin" replace /> },
    {
        element: <ProtectedRoute />,
        children: [
            { path: '/', element: pageElement(MainPage) },
            { path: '/menu', element: pageElement(MenuPage) },
            { path: '/attractions', element: pageElement(AttractionsPage) },
            { path: '/events', element: pageElement(EventsPage) },
            { path: '/guestbook', element: pageElement(GuestbookPage) },
            { path: '/guestupload', element: pageElement(GuestUploadPage) },
            { path: '/current', element: pageElement(CurrentPhotosPage) },
            { path: '/gallery', element: pageElement(GalleryPage) },
            { path: '/gallery/:slug', element: pageElement(GalleryAlbumPage) },
            { path: '/slideshow', element: pageElement(SlideshowPage) },
        ],
    },
    {
        element: <ProtectedRoute requireAdmin />,
        children: [
            { path: '/admin/dashboard', element: pageElement(AdminDashboardPage) },
            { path: '/admin/guestbook', element: pageElement(AdminGuestBookPage) },
            { path: '/admin/albums', element: pageElement(AdminAlbumsPage) },
            { path: '/admin/albums/:albumId', element: pageElement(AdminAlbumPage) },
            { path: '/admin/photos', element: <Navigate to="/admin/albums" replace /> },
        ],
    },
]);
