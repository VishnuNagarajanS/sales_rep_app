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

  /**
   * Verifies an MFA login challenge using a 6-digit TOTP code.
   */
  async verifyMfa(challengeToken: string, code: string): Promise<ApiResponse<any>> {
    try {
      return await apiClient.post<ApiResponse<any>>('/auth/mfa/verify', { challengeToken, code });
    } catch {
      return await apiClient.post<ApiResponse<any>>('/auth/two-factor/verify', { tempToken: challengeToken, code });
    }
  },

  /**
   * Verifies an MFA login challenge using an emergency single-use recovery code.
   */
  async verifyRecovery(challengeToken: string, recoveryCode: string): Promise<ApiResponse<any>> {
    try {
      return await apiClient.post<ApiResponse<any>>('/auth/mfa/recovery', { challengeToken, recoveryCode });
    } catch {
      return await apiClient.post<ApiResponse<any>>('/auth/two-factor/verify', { tempToken: challengeToken, code: recoveryCode });
    }
  },
};
