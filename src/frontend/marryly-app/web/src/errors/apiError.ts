import { config } from '../app/config';
import { appText } from '../content/appText';
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

const friendlyMessagesByCode: Record<string, string> = appText.errors.byCode;

const friendlyMessagesByStatus: Record<number, string> = appText.errors.byStatus;

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
        lines.push(`${appText.errors.debug.title}: ${error.title}`);
    }

    if (error.code) {
        lines.push(`${appText.errors.debug.code}: ${error.code}`);
    }

    if (error.traceId) {
        lines.push(`${appText.errors.debug.traceId}: ${error.traceId}`);
    }

    if (error.raw?.stackTrace) {
        lines.push('');
        lines.push(appText.errors.debug.stackTrace);
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
