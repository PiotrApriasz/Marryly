import { config } from '../app/config';

export class ApiClient {
    private readonly baseUrl: string;

    constructor() {
        this.baseUrl = config.apiBaseUrl;
        console.log(this.baseUrl);
    }

    // Tutaj będą metody do komunikacji z API
}

export const apiClient = new ApiClient();