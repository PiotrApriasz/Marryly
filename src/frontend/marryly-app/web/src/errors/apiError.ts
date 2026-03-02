import { config } from '../app/config';
import type {ProblemDetails} from "../types/basic.types.ts";

export class ApiError extends Error {
    public readonly status: number;
    public readonly code?: string;
    public readonly traceId?: string;
    public readonly title?: string;
    public readonly detail?: string;
    public readonly raw?: ProblemDetails;

    constructor(params: {
        message: string;
        status: number;
        code?: string;
        traceId?: string;
        title?: string;
        detail?: string;
        raw?: ProblemDetails;
    }) {
        super(params.message);
        this.name = "ApiError";
        this.status = params.status;
        this.code = params.code;
        this.traceId = params.traceId;
        this.title = params.title;
        this.detail = params.detail;
        this.raw = params.raw;
    }
}

const friendlyMessagesByCode: Record<string, string> = {
    MENU_NOT_FOUND: 'Menu weselne nie zostało jeszcze opublikowane.',
    EVENTS_NOT_FOUND: 'Harmonogram dnia nie został jeszcze opublikowany.',
    SCHEDULE_NOT_FOUND: 'Harmonogram dnia nie został jeszcze opublikowany.',
    UNHANDLED_ERROR: 'Wystąpił problem po stronie serwera. Spróbuj ponownie później.',
};

const friendlyMessagesByStatus: Record<number, string> = {
    400: 'Nie udało się przetworzyć żądania. Spróbuj ponownie.',
    401: 'Brak dostępu do tych danych.',
    403: 'Brak dostępu do tych danych.',
    404: 'Szukane dane nie są obecnie dostępne.',
    500: 'Wystąpił problem po stronie serwera. Spróbuj ponownie później.',
    502: 'Usługa jest chwilowo niedostępna. Spróbuj ponownie później.',
    503: 'Usługa jest chwilowo niedostępna. Spróbuj ponownie później.',
};

function getFriendlyMessage(error: ApiError, fallbackMessage: string): string {
    if (error.code && friendlyMessagesByCode[error.code]) {
        return friendlyMessagesByCode[error.code];
    }

    if (friendlyMessagesByStatus[error.status]) {
        return friendlyMessagesByStatus[error.status];
    }

    return fallbackMessage;
}

function getDebugMessage(error: ApiError, fallbackMessage: string): string {
    const lines: string[] = [];
    const primaryMessage = error.detail || error.raw?.message || error.message || fallbackMessage;

    lines.push(primaryMessage);

    if (error.title && error.title !== primaryMessage) {
        lines.push(`Title: ${error.title}`);
    }

    if (error.code) {
        lines.push(`Code: ${error.code}`);
    }

    if (error.traceId) {
        lines.push(`Trace ID: ${error.traceId}`);
    }

    if (error.raw?.stackTrace) {
        lines.push('');
        lines.push('Stack trace:');
        lines.push(error.raw.stackTrace);
    }

    return lines.join('\n');
}

export function getErrorMessageForDisplay(error: unknown, fallbackMessage: string): string {
    if (error instanceof ApiError) {
        return config.apiErrorDebug
            ? getDebugMessage(error, fallbackMessage)
            : getFriendlyMessage(error, fallbackMessage);
    }

    if (error instanceof Error) {
        return config.apiErrorDebug && error.message
            ? error.message
            : fallbackMessage;
    }

    return fallbackMessage;
}

export function logErrorDetails(error: unknown, context: string): void {
    if (error instanceof ApiError) {
        console.error(context, {
            status: error.status,
            code: error.code,
            traceId: error.traceId,
            title: error.title,
            detail: error.detail,
            raw: error.raw,
        });
        return;
    }

    console.error(context, error);
}
