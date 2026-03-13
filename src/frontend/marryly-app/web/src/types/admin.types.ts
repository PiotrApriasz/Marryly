export interface AdminUser {
    id: string;
    email: string;
    displayName?: string;
}

export interface AdminSessionResponse {
    authenticated: boolean;
    user?: AdminUser;
}

export interface AdminLoginResponse {
    authenticated: boolean;
    user: AdminUser;
}
