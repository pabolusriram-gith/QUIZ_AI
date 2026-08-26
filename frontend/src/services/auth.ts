import api from "./api";

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  is_active: boolean;
  is_verified?: boolean;
  dev_otp?: string;
  created_at: string;
  updated_at: string;
}

export interface ForgotPasswordResponse {
  message: string;
  dev_reset_url?: string;
  dev_reset_token?: string;
}

export interface ResendOtpResponse {
  message: string;
  dev_otp?: string;
}

export const authService = {
  /**
   * Performs authentication request to backend.
   */
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("/auth/login", {
      email,
      password,
    });
    return response.data;
  },

  /**
   * Registers a new user.
   */
  register: async (fullName: string, email: string, password: string, role: string = "student"): Promise<UserResponse> => {
    const response = await api.post<UserResponse>("/auth/register", {
      email,
      password,
      full_name: fullName,
      role,
    });
    return response.data;
  },

  /**
   * Verifies email using 6-digit OTP code and returns session tokens.
   */
  verifyEmail: async (email: string, otpCode: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("/auth/verify-email", {
      email,
      otp_code: otpCode,
    });
    return response.data;
  },

  /**
   * Requests a new 6-digit OTP code to be sent to email.
   */
  resendVerificationOtp: async (email: string): Promise<ResendOtpResponse> => {
    const response = await api.post<ResendOtpResponse>("/auth/resend-verification-otp", {
      email,
    });
    return response.data;
  },

  /**
   * Requests a password reset link for the given email.
   */
  forgotPassword: async (email: string): Promise<ForgotPasswordResponse> => {
    const response = await api.post<ForgotPasswordResponse>("/auth/forgot-password", {
      email,
    });
    return response.data;
  },

  /**
   * Submits a password reset with the token.
   */
  resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>("/auth/reset-password", {
      token,
      new_password: newPassword,
    });
    return response.data;
  },

  /**
   * Fetches the current logged in user's profile details.
   */
  getCurrentUser: async (): Promise<UserResponse> => {
    const response = await api.get<UserResponse>("/users/me");
    return response.data;
  },

  /**
   * Handles user logout.
   */
  logout: async (): Promise<void> => {
    await api.post("/auth/logout");
  },

  /**
   * Updates user role between teacher and student.
   */
  updateRole: async (role: "teacher" | "student"): Promise<UserResponse> => {
    const response = await api.patch<UserResponse>("/users/me/role", { role });
    return response.data;
  },

  /**
   * Attempts to refresh the authentication session token.
   */
  refreshToken: async (token: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("/auth/refresh", {
      refresh_token: token,
    });
    return response.data;
  },
};
