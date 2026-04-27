const LOCAL_API_BASE_URL = 'http://localhost:8080/api/v1';
const API_PREFIX = '/api/v1';

function normalizeApiPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');

  if (!trimmed || trimmed === '/') {
    return API_PREFIX;
  }

  return trimmed.endsWith(API_PREFIX) ? trimmed : `${trimmed}${API_PREFIX}`;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function normalizeApiBaseUrl(rawValue?: string): string {
  const value = rawValue?.trim();
  const hasWindow = typeof window !== 'undefined';

  if (!value) {
    if (hasWindow && !isLocalHostname(window.location.hostname)) {
      return API_PREFIX;
    }

    return LOCAL_API_BASE_URL;
  }

  if (hasWindow && window.location.protocol === 'https:' && value.startsWith('http://')) {
    console.warn(`[apiBase] Ignoring insecure VITE_API_BASE_URL on an HTTPS page: ${value}`);
    return API_PREFIX;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    const url = new URL(value);
    url.pathname = normalizeApiPath(url.pathname);
    return url.toString().replace(/\/$/, '');
  }

  return normalizeApiPath(value);
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
