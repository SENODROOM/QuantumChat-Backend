import type { IUser } from '@quantum-chat/shared';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const API_KEY = import.meta.env.VITE_API_KEY || '';
const WEBSITE_ID = import.meta.env.VITE_WEBSITE_ID || '';

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

interface AuthResponse {
  user: IUser;
  token: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Api-Key': API_KEY,
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_URL}/api/v1${path}`, { ...options, headers });
  let data: { success?: boolean; error?: string; data?: T };
  try {
    data = await res.json();
  } catch {
    throw new Error('Failed to fetch — is the backend running?');
  }
  if (!res.ok || !data.success) throw new Error(data.error || 'Request failed');
  return data.data as T;
}

export function isAdminUser(user: IUser): boolean {
  return ADMIN_ROLES.has(user.role);
}

export function redirectAdminSession(token: string): void {
  localStorage.setItem('qc_admin_token', token);
  window.location.href = getAdminUrl();
}

export function completeAuth(result: AuthResponse, onUserAuth: (session: AuthResponse) => void): void {
  if (isAdminUser(result.user)) {
    redirectAdminSession(result.token);
    return;
  }
  onUserAuth(result);
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, websiteId: WEBSITE_ID }),
  });
}

export async function loginAdmin(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/v1/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Admin login failed');
  return data.data as AuthResponse;
}

export function saveAdminToken(token: string): void {
  localStorage.setItem('qc_admin_token', token);
}

export async function registerUser(data: {
  email: string;
  displayName: string;
  password: string;
  avatarUrl?: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchGoogleClientId(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/google/config`);
    const data = await res.json();
    if (data.success && data.data?.clientId) return data.data.clientId as string;
  } catch {
    /* backend unreachable */
  }
  return null;
}

export async function loginWithGoogle(credential: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
}

export async function fetchCurrentUser(token: string): Promise<IUser> {
  const res = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Api-Key': API_KEY,
    },
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Session expired');
  return data.data as IUser;
}

export async function updateProfile(
  token: string,
  data: { displayName?: string; avatarUrl?: string }
): Promise<IUser> {
  const res = await fetch(`${API_URL}/api/v1/auth/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Api-Key': API_KEY,
    },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || 'Update failed');
  return json.data as IUser;
}

export async function uploadAvatar(token: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}/api/v1/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Api-Key': API_KEY,
    },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');
  const url = data.data.url as string;
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

export function getAdminUrl(): string {
  return import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174';
}

export { API_URL };
