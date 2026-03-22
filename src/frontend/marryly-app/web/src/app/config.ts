function getUseMockPhotos(): boolean {
    if (import.meta.env.VITE_USE_MOCK_PHOTOS === 'true') {
        return true;
    }

    if (typeof window === 'undefined') {
        return false;
    }

    const params = new URLSearchParams(window.location.search);
    return params.get('mockPhotos') === '1';
}

export const config = {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL as string,
    eventId: import.meta.env.VITE_EVENT_ID as string,
    apiErrorDebug: import.meta.env.VITE_API_ERROR_DEBUG === 'true',
    useMockPhotos: getUseMockPhotos(),
};
