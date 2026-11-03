export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status = 500, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    window.dispatchEvent(new Event('hub:unauthorized'));
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && ('detail' in data || 'error' in data)
        ? String((data as Record<string, unknown>).detail || (data as Record<string, unknown>).error)
        : '') || `Error ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export const api = {
  get: <T = unknown>(url: string) => apiFetch<T>(url),
  post: <T = unknown>(url: string, body: unknown = {}) =>
    apiFetch<T>(url, { method: 'POST', body: JSON.stringify(body) }),
};
