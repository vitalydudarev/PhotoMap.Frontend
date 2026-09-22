export interface DropboxAuthTokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  tokenType: string;
  scope: string;
  accountId: string;
}
