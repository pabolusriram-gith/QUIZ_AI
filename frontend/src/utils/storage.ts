const ACCESS_TOKEN_KEY = "quizverse_access_token";
const REFRESH_TOKEN_KEY = "quizverse_refresh_token";
const REMEMBER_ME_KEY = "quizverse_remember_me";

export const tokenStorage = {
  /**
   * Retrieves the access token from either localStorage or sessionStorage.
   */
  getAccessToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY);
  },

  /**
   * Saves the access token. If remember is true, uses localStorage; otherwise, sessionStorage.
   */
  setAccessToken: (token: string, remember: boolean): void => {
    if (typeof window === "undefined") return;
    if (remember) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
      localStorage.setItem(REMEMBER_ME_KEY, "true");
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    } else {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
      localStorage.setItem(REMEMBER_ME_KEY, "false");
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  },

  /**
   * Retrieves the refresh token from either localStorage or sessionStorage.
   */
  getRefreshToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Saves the refresh token. If remember is true, uses localStorage; otherwise, sessionStorage.
   */
  setRefreshToken: (token: string, remember: boolean): void => {
    if (typeof window === "undefined") return;
    if (remember) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    } else {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },

  /**
   * Gets the rememberMe preference.
   */
  getRememberPreference: (): boolean => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(REMEMBER_ME_KEY) === "true";
  },

  /**
   * Clears all session and local storage authentication items.
   */
  clear: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
