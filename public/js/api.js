export class ApiError extends Error { constructor(message, status = 0) { super(message); this.status = status; } }

export async function api(path, options = {}) {
  const init = { method: options.method || 'GET', credentials: 'same-origin', headers: { 'x-smartstay-request': '1', ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) } };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  let response;
  try { response = await fetch(`/api${path}`, init); }
  catch { throw new ApiError('Unable to reach SmartStay. Check that the server is running and try again.'); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error || `Request failed (${response.status}).`, response.status);
  return payload;
}

export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: 'POST', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const put = (path, body) => api(path, { method: 'PUT', body });
