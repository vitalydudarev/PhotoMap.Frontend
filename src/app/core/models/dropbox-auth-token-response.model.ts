export interface DropboxAuthTokenResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
  accountId: string;
}
