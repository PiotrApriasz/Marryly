import { createBrowserRouter } from "react-router-dom";
import MainPage from "../pages/MainPage";
import MenuPage from "../pages/MenuPage";
import AttractionsPage from "../pages/AttractionsPage";
import EventsPage from "../pages/EventsPage";
import GuestbookPage from "../pages/GuestbookPage";
import GuestUploadPage from "../pages/GuestUploadPage";
import CurrentPhotosPage from "../pages/CurrentPhotosPage";
import GalleryPage from "../pages/GalleryPage";
import SlideshowPage from "../pages/SlideshowPage";
import AdminLoginPage from "../pages/AdminLoginPage";
import AdminDashboardPage from "../pages/AdminDashboardPage";

export const router = createBrowserRouter([
    { path: "/", element: <MainPage /> },
    { path: "/menu", element: <MenuPage /> },
    { path: "/attractions", element: <AttractionsPage /> },
    { path: "/events", element: <EventsPage /> },
    { path: "/guestbook", element: <GuestbookPage /> },
    { path: "/guestupload", element: <GuestUploadPage /> },
    { path: "/current", element: <CurrentPhotosPage /> },
    { path: "/gallery", element: <GalleryPage /> },
    { path: "/slideshow", element: <SlideshowPage /> },
    { path: "/admin", element: <AdminLoginPage /> },
    { path: "/admin/dashboard", element: <AdminDashboardPage /> },
]);