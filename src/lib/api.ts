/**
 * Thin fetch client for the local Express API (server/), replacing the old supabase-js
 * client. Every call throws Error(message) on a non-OK response, matching the
 * `catch (err: any) { showToast(err.message, ...) }` pattern used throughout AppContext.
 */

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body as T;
}

const post = <T>(path: string, payload?: unknown) =>
  request<T>(path, { method: 'POST', body: payload !== undefined ? JSON.stringify(payload) : undefined });
const patch = <T>(path: string, payload: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(payload) });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

export interface SessionUser {
  id: string;
  email: string;
}

export const auth = {
  signUp: (email: string, password: string) => post<SessionUser>('/auth/signup', { email, password }),
  signIn: (email: string, password: string) => post<SessionUser>('/auth/login', { email, password }),
  signOut: () => post<{ ok: true }>('/auth/logout'),
  getSession: () => request<{ user: SessionUser | null }>('/auth/session')
};

export const bootstrap = () => request<{ accounts: any[]; strategies: string[]; trades: any[] }>('/bootstrap');

export const accountsApi = {
  create: (payload: { name: string; type: string; color: string }) => post<any>('/accounts', payload),
  rename: (id: string, name: string) => patch<any>(`/accounts/${id}`, { name }),
  remove: (id: string) => del<{ ok: true }>(`/accounts/${id}`)
};

export const strategiesApi = {
  create: (name: string) => post<any>('/strategies', { name }),
  remove: (name: string) => del<{ ok: true }>(`/strategies/${encodeURIComponent(name)}`)
};

export const tradesApi = {
  create: (payload: Record<string, any>) => post<any>('/trades', payload),
  bulkCreate: (trades: Record<string, any>[]) => post<any[]>('/trades/bulk', { trades }),
  update: (id: string, payload: Record<string, any>) => patch<any>(`/trades/${id}`, payload),
  remove: (id: string) => del<{ ok: true }>(`/trades/${id}`),
  bulkDelete: (ids: string[]) => post<{ ok: true }>('/trades/bulk-delete', { ids })
};
