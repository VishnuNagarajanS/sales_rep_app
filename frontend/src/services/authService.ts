import { apiClient, ApiResponse } from './apiClient';

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export const authService = {
  /**
   * Requests a password reset link to be sent to the given email address.
   */
  async requestPasswordReset(email: string): Promise<ApiResponse<string>> {
    return apiClient.post<ApiResponse<string>>('/auth/forgot-password', { email });
  },

  /**
   * Submits the new password along with the secure reset token.
   */
  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<any>> {
    return apiClient.post<ApiResponse<any>>('/auth/reset-password', { token, newPassword });
  },
};
