const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return RAW_API_BASE ? `${RAW_API_BASE}${normalizedPath}` : normalizedPath;
}

export function isStaticHostWithoutBackend(): boolean {
  if (RAW_API_BASE) return false;
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('github.io');
}

export async function parseApiJson<T>(res: Response, featureLabel = 'Backend API'): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (res.status === 404 || isStaticHostWithoutBackend()) {
      throw new Error(
        `${featureLabel} requires the Node.js Express server. Static GitHub Pages hosts the frontend only — deploy server.ts and configure VITE_API_BASE_URL to enable server-backed endpoints.`
      );
    }
    throw new Error(`${featureLabel} returned an unexpected response (HTTP ${res.status}).`);
  }
  return (await res.json()) as T;
}
