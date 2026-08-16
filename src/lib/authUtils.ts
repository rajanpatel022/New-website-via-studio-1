/**
 * Server-backed OAuth LocalStorage Tokens Helper & OAuth trigger
 */

export function getStoredAccessToken(): string | null {
  try {
    return localStorage.getItem('sheet_expense_google_tokens');
  } catch (e) {
    return null;
  }
}

export function setStoredAccessToken(tokens: string): void {
  try {
    localStorage.setItem('sheet_expense_google_tokens', tokens);
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

export function clearStoredTokens(): void {
  try {
    localStorage.removeItem('sheet_expense_google_tokens');
  } catch (e) {
    console.error('LocalStorage clear error:', e);
  }
}

/**
 * Triggers Google OAuth in a popup window via Express backend endpoint /api/auth/login
 * If popups are blocked by browser, falls back to direct navigation.
 */
export function triggerGoogleLogin(): void {
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.innerWidth - width) / 2;
  const top = window.screenY + (window.innerHeight - height) / 2;

  const popup = window.open(
    '/api/auth/login',
    'google_oauth_popup',
    `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
  );

  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    // Popup was blocked by browser settings, fallback to top page navigation
    window.location.href = '/api/auth/login';
  }
}

/**
 * Helper to make authenticated requests to Express backend API routes.
 * Automatically attaches stored OAuth tokens in the 'Authorization' header
 * if present, assisting in iframe/cross-site environments.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const tokens = getStoredAccessToken();
  const headers = new Headers(options.headers || {});

  if (tokens) {
    headers.set('Authorization', `Bearer ${tokens}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  return res;
}
