import { config } from '../app/config';

export class ApiClient {
    private baseUrl: string;

    constructor() {
        this.baseUrl = config.apiBaseUrl;
    }

    // Tutaj będą metody do komunikacji z API
}

export const apiClient = new ApiClient();