const HEIC_CONTENT_TYPES = new Set(['image/heic', 'image/heif']);
const HEIC_EXTENSIONS = new Set(['.heic', '.heif']);

function getExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');

    if (dotIndex < 0) {
        return '';
    }

    return fileName.slice(dotIndex).toLowerCase();
}

function replaceExtension(fileName: string, nextExtension: string): string {
    const dotIndex = fileName.lastIndexOf('.');

    if (dotIndex < 0) {
        return `${fileName}${nextExtension}`;
    }

    return `${fileName.slice(0, dotIndex)}${nextExtension}`;
}

async function shouldConvertHeic(file: File): Promise<boolean> {
    if (HEIC_CONTENT_TYPES.has(file.type) || HEIC_EXTENSIONS.has(getExtension(file.name))) {
        return true;
    }

    try {
        const { isHeic } = await import('heic-to/csp');
        return await isHeic(file);
    } catch {
        return false;
    }
}

export async function preparePhotoFileForUpload(file: File): Promise<File> {
    if (!(await shouldConvertHeic(file))) {
        return file;
    }

    const { heicTo } = await import('heic-to/csp');
    const convertedBlob = await heicTo({
        blob: file,
        type: 'image/jpeg',
        quality: 0.92,
    });

    return new File(
        [convertedBlob],
        replaceExtension(file.name, '.jpeg'),
        {
            type: 'image/jpeg',
            lastModified: file.lastModified,
        }
    );
}
