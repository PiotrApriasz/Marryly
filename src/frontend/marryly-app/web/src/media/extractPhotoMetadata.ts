import exifr from 'exifr';

interface ExifPhotoMetadata {
    DateTimeOriginal?: unknown;
    DateTimeDigitized?: unknown;
    OffsetTimeOriginal?: unknown;
    OffsetTimeDigitized?: unknown;
}

const EXIF_DATE_KEYS = [
    'DateTimeOriginal',
    'DateTimeDigitized',
    'OffsetTimeOriginal',
    'OffsetTimeDigitized',
];

function toIsoDate(value: unknown, offset: unknown): string | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    if (typeof value === 'number') {
        const timestamp = value > 1_000_000_000_000 ? value : value * 1000;
        const date = new Date(timestamp);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    if (typeof value !== 'string') {
        return null;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return null;
    }

    const dateParts = trimmedValue.match(
        /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/,
    );

    if (dateParts) {
        const offsetValue = typeof offset === 'string' && /^[+-]\d{2}:?\d{2}$/.test(offset.trim())
            ? offset.trim().replace(/^(.*\d{2})(\d{2})$/, '$1:$2')
            : null;
        const normalizedValue = `${dateParts[1]}-${dateParts[2]}-${dateParts[3]}T${dateParts[4]}:${dateParts[5]}:${dateParts[6] ?? '00'}`;
        const date = new Date(offsetValue ? `${normalizedValue}${offsetValue}` : `${normalizedValue}Z`);

        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    const date = new Date(trimmedValue);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function extractPhotoCapturedAt(file: File): Promise<string | null> {
    try {
        const metadata = await exifr.parse(file, { pick: EXIF_DATE_KEYS }) as ExifPhotoMetadata | undefined;

        return toIsoDate(metadata?.DateTimeOriginal, metadata?.OffsetTimeOriginal) ??
            toIsoDate(metadata?.DateTimeDigitized, metadata?.OffsetTimeDigitized);
    } catch {
        return null;
    }
}
