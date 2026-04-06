export type AccessRole = 'guest' | 'admin';

export interface AccessUser {
    id: string;
    email?: string | null;
    displayName?: string;
    role: AccessRole;
}

export interface AccessSessionResponse {
    authenticated: boolean;
    eventId?: string;
    user?: AccessUser;
}

export interface AccessLoginResponse extends AccessSessionResponse {
    accessToken?: string;
    expiresAt?: string;
}

export interface AccessTokenClaims {
    exp?: number;
    email?: string;
    sub?: string;
    role?: AccessRole;
    eventId?: string;
}
