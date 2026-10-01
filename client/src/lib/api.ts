export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function csrf(): string {
  return document.cookie.split('; ').find((c) => c.startsWith('ff_csrf='))?.slice(8) ?? '';
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; raw?: Blob } = {}): Promise<T> {
  const method = init.method ?? (init.body || init.raw ? 'POST' : 'GET');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-CSRF-Token'] = decodeURIComponent(csrf());
  let body: BodyInit | undefined;
  if (init.raw) { body = init.raw; headers['Content-Type'] = init.raw.type || 'application/octet-stream'; }
  else if (init.body !== undefined) { body = JSON.stringify(init.body); headers['Content-Type'] = 'application/json'; }
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, "Couldn't connect. Check your internet and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? 'Something went wrong.');
  return data as T;
}
