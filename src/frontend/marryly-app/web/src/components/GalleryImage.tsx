import { useState } from 'react';

interface GalleryImageProps {
    src: string;
    thumbnailSrc?: string | null;
    alt: string;
}

export default function GalleryImage({ src, thumbnailSrc, alt }: GalleryImageProps) {
    const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
    const [useThumbnail, setUseThumbnail] = useState(false);
    const [thumbnailFailed, setThumbnailFailed] = useState(false);
    const hasThumbnail = Boolean(thumbnailSrc && thumbnailSrc !== src);
    const displayedSrc = useThumbnail && thumbnailSrc ? thumbnailSrc : src;
    const ready = loadedSrc === displayedSrc;

    return (
        <span className={`photo-gallery-image ${ready ? 'photo-gallery-image-ready' : ''}`}>
            {hasThumbnail && !thumbnailFailed ? (
                <img
                    src={thumbnailSrc!}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="photo-gallery-image-placeholder"
                    onError={() => setThumbnailFailed(true)}
                />
            ) : null}
            <img
                src={displayedSrc}
                alt={alt}
                loading="lazy"
                decoding="async"
                className="photo-gallery-image-full"
                onLoad={(event) => {
                    const image = event.currentTarget;
                    // Reveal the larger image only after decoding, keeping the
                    // small blurred thumbnail underneath during slow downloads.
                    void image.decode().catch(() => undefined).then(() => setLoadedSrc(displayedSrc));
                }}
                onError={() => {
                    if (hasThumbnail && !useThumbnail) {
                        setUseThumbnail(true);
                    }
                }}
            />
        </span>
    );
}
