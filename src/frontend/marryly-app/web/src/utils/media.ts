export interface MediaDimensions {
    kind?: string | null;
    width?: number | null;
    height?: number | null;
}

export interface MediaDateFields {
    capturedAt?: string | null;
    uploadedAt?: string | null;
}

export function getMediaAspectRatio(media: MediaDimensions): string {
    const width = Number(media.width);
    const height = Number(media.height);

    if (width > 0 && height > 0) {
        return `${width} / ${height}`;
    }

    return media.kind === 'video' ? '16 / 9' : '1 / 1';
}

export function getMediaHeightRatio(media: MediaDimensions): number {
    const width = Number(media.width);
    const height = Number(media.height);

    if (width > 0 && height > 0) {
        return height / width;
    }

    return media.kind === 'video' ? 9 / 16 : 1;
}

export function getAdminMediaHeightRatio(media: MediaDimensions): number {
    return getMediaHeightRatio(media) + 1.75;
}

function getDateTimestamp(value: string | null | undefined): number {
    if (!value) {
        return Number.NEGATIVE_INFINITY;
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function sortMediaByDate<T extends MediaDateFields>(items: T[]): T[] {
    return items
        .map((item, index) => ({ item, index }))
        .sort((left, right) => {
            const effectiveDateDifference = getDateTimestamp(right.item.capturedAt ?? right.item.uploadedAt) -
                getDateTimestamp(left.item.capturedAt ?? left.item.uploadedAt);

            if (effectiveDateDifference !== 0) {
                return effectiveDateDifference;
            }

            const uploadedDateDifference = getDateTimestamp(right.item.uploadedAt) -
                getDateTimestamp(left.item.uploadedAt);

            return uploadedDateDifference !== 0
                ? uploadedDateDifference
                : left.index - right.index;
        })
        .map(({ item }) => item);
}
