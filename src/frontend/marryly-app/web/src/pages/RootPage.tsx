import { useSearchParams } from 'react-router-dom';
import MainPage from './MainPage';
import SharedGalleryPage from './SharedGalleryPage';

export default function RootPage() {
    const [searchParams] = useSearchParams();
    return searchParams.has('view') ? <SharedGalleryPage /> : <MainPage />;
}
