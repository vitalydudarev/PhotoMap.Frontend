/** Set before leaving for a photo source page so that page starts authorization on arrival. */
export const AUTH_FIRST_STEP = 'auth-first-step';

/** The provider's OAuth configuration, kept across the redirect to exchange the code on return. */
export const AUTH_CONFIGURATION = 'auth-configuration';

/** PKCE values, kept across the redirect (RFC 7636). */
export const AUTH_STATE = 'auth-state';
export const AUTH_CODE_VERIFIER = 'auth-code-verifier';
