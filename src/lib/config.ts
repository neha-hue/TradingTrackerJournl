// Optional single-owner account the app signs into automatically on startup, so no
// login screen is shown - see ensureSignedIn() in AppContext.
// Set these in .env.local for local use only. They must NOT be set on the deployed
// site: Vite inlines env values into the JS bundle, so anyone with the URL could read
// them. Without them the app falls back to the normal login screen.
export const AUTO_LOGIN_EMAIL = import.meta.env.VITE_AUTO_LOGIN_EMAIL || '';
export const AUTO_LOGIN_PASSWORD = import.meta.env.VITE_AUTO_LOGIN_PASSWORD || '';
export const AUTO_LOGIN_ENABLED = !!(AUTO_LOGIN_EMAIL && AUTO_LOGIN_PASSWORD);
