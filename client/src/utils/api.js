import { readApiJson } from './apiResponse';

const TOKEN_KEY = 'invoice_auth_token';

export function getStoredToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function clearStoredToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getStoredToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401 && path !== '/api/auth/login') {
    clearStoredToken();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    const err = new Error('Session expired. Please sign in again.');
    err.status = 401;
    throw err;
  }

  return res;
}

export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  const data = await readApiJson(res);
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
