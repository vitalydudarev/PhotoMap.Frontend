/** Token endpoint response, after snake_case keys have been converted to camelCase. */
export interface OAuthTokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  tokenType: string;
  scope: string;
  accountId: string;
}
