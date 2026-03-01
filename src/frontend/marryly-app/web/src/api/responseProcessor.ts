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

export class ResponseProcessor {
    async parseError(res: Response): Promise<ApiError> {
        const ct = res.headers.get("content-type") ?? "";

        if (ct.includes("application/problem+json") || ct.includes("application/json")) {
            const parsed: unknown = await res.json().catch(() => null);

            if (isProblemDetails(parsed)) {
                const status = res.status;
                const title = parsed.title;
                const detail = parsed.detail ?? parsed.message;
                const msg = detail ?? title ?? `API error ${status}`;

                return new ApiError({
                    message: msg,
                    status,
                    code: parsed.code,
                    traceId: parsed.traceId,
                    title,
                    detail,
                    raw: parsed,
                });
            }

            return new ApiError({
                message: `API error ${res.status}`,
                status: res.status,
            });
        }

        const text = await res.text().catch(() => "");
        return new ApiError({
            message: text || `API error ${res.status}`,
            status: res.status,
        });
    }
}

export const responseProcessor = new ResponseProcessor();
