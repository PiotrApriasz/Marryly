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