export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const getToken = () => { try { return localStorage.getItem('qa_token'); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem('qa_token', t) : localStorage.removeItem('qa_token'); } catch { /* ignore */ } };

export class ApiError extends Error {
  constructor(code, status, data) { super(code); this.code = code; this.status = status; this.data = data; }
}

export async function api(path, { method = 'GET', body, form, raw } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try { res = await fetch(`${API_URL}${path}`, { method, headers, body: payload }); }
  catch { throw new ApiError('NETWORK', 0); }
  if (raw) {
    if (!res.ok) throw new ApiError('SERVER_ERROR', res.status);
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'SERVER_ERROR', res.status, data);
  return data;
}

export async function download(path, filename) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const imgSrc = (u) => (!u ? '' : u.startsWith('http') ? u : `${API_URL}${u}`);
