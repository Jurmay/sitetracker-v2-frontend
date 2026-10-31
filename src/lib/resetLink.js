// A password-reset email link opens the app with "type=recovery" (or an
// error, if the link has expired) in the address. Read it once at load,
// before supabase-js tidies the address, so the app can ask for a new
// password even if the PASSWORD_RECOVERY event fired before anyone listened.
const startHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));

export const OPENED_FROM_RESET_LINK = startHash.get('type') === 'recovery';
export const RESET_LINK_ERROR = startHash.get('error_description');
