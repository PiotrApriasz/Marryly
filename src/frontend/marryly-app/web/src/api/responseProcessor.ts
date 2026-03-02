import type {ProblemDetails} from "../types/basic.types.ts";
import {ApiError} from "../errors/apiError.ts";

function isProblemDetails(value: unknown): value is ProblemDetails {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    return (
        "title" in v ||
        "detail" in v ||
        "status" in v ||
        "traceId" in v ||
        "code" in v ||
        "message" in v ||
        "stackTrace" in v
    );
}

function looksLikeJson(value: string): boolean {
    const trimmed = value.trim();
    return trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith("\"{");
}

function tryParseNestedJson(value: string): unknown {
    let parsed: unknown = value;

    for (let depth = 0; depth < 2 && typeof parsed === "string"; depth += 1) {
        const trimmed = parsed.trim();

        if (!looksLikeJson(trimmed)) {
            break;
        }

        try {
            parsed = JSON.parse(trimmed);
        } catch {
            break;
        }
    }

    return parsed;
}

export class ResponseProcessor {
    private async parseBody(res: Response): Promise<unknown> {
        const text = await res.text().catch(() => "");

        if (!text) {
            return null;
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("json") || looksLikeJson(text)) {
            return tryParseNestedJson(text);
        }

        return text;
    }

    async parseResponse<T>(res: Response): Promise<T> {
        const body = await this.parseBody(res);

        if (!res.ok) {
            throw this.toApiError(res, body);
        }

        if (body === null) {
            throw new ApiError({
                message: `Empty API response ${res.status}`,
                status: res.status,
            });
        }

        if (typeof body === "string") {
            throw new ApiError({
                message: body.trim().startsWith("<")
                    ? "Invalid API response - expected JSON but received HTML. Check API configuration."
                    : `Invalid API response - expected JSON object but received text.`,
                status: res.status,
            });
        }

        return body as T;
    }

    async parseError(res: Response): Promise<ApiError> {
        const body = await this.parseBody(res);
        return this.toApiError(res, body);
    }

    private toApiError(res: Response, body: unknown): ApiError {
        if (isProblemDetails(body)) {
            const status = body.status ?? res.status;
            const title = body.title;
            const detail = body.detail ?? body.message;
            const message = detail ?? title ?? `API error ${status}`;

            return new ApiError({
                message,
                status,
                code: body.code,
                traceId: body.traceId,
                title,
                detail,
                raw: body,
            });
        }

        if (typeof body === "string" && body.trim()) {
            return new ApiError({
                message: body,
                status: res.status,
            });
        }

        return new ApiError({
            message: `API error ${res.status}`,
            status: res.status,
        });
    }
}

export const responseProcessor = new ResponseProcessor();
