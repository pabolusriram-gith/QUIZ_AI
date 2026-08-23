import axios from "axios";
import { tokenStorage } from "@/utils/storage";

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
    withCredentials: true,
    timeout: 60000,
    headers: {
        "Content-Type": "application/json",
    },
});

// Request interceptor to automatically attach JWT to requests
api.interceptors.request.use(
    (config) => {
        const token = tokenStorage.getAccessToken();
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // When the request body is FormData, delete the hardcoded Content-Type
        // so the browser can auto-generate "multipart/form-data; boundary=..." correctly.
        if (config.data instanceof FormData) {
            delete config.headers["Content-Type"];
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

interface FailedQueueItem {
    resolve: (token: string | null) => void;
    reject: (error: unknown) => void;
}

let isRefreshing = false;
let failedQueue: FailedQueueItem[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Response interceptor to automatically refresh tokens and retry failed requests on unauthorized errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (
            error.response &&
            error.response.status === 401 &&
            !originalRequest._retry
        ) {
            const isLoginRequest = originalRequest.url && originalRequest.url.includes("/auth/login");
            const isRefreshRequest = originalRequest.url && originalRequest.url.includes("/auth/refresh");
            
            if (isLoginRequest || isRefreshRequest) {
                // Let login or refresh failures pass through directly
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = tokenStorage.getRefreshToken();
            if (refreshToken) {
                try {
                    const refreshUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/auth/refresh`;
                    const response = await axios.post(
                        refreshUrl,
                        { refresh_token: refreshToken },
                        { 
                            headers: { "Content-Type": "application/json" },
                            withCredentials: true
                        }
                    );

                    const { access_token, refresh_token: new_refresh_token } = response.data;
                    const rememberMe = tokenStorage.getRememberPreference();

                    tokenStorage.setAccessToken(access_token, rememberMe);
                    if (new_refresh_token) {
                        tokenStorage.setRefreshToken(new_refresh_token, rememberMe);
                    } else {
                        tokenStorage.setRefreshToken(access_token, rememberMe);
                    }

                    processQueue(null, access_token);
                    isRefreshing = false;

                    originalRequest.headers.Authorization = `Bearer ${access_token}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    isRefreshing = false;
                    
                    tokenStorage.clear();
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("auth-expired"));
                    }
                    return Promise.reject(refreshError);
                }
            } else {
                tokenStorage.clear();
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("auth-expired"));
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;