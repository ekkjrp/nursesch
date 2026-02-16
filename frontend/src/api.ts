// API 클라이언트 — 백엔드 REST API 호출

const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  // export 등 blob 응답 처리
  const ct = res.headers.get('content-type');
  if (ct && ct.includes('spreadsheet')) {
    return res.blob() as any;
  }
  return res.json();
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<{ token: string; nurse: any }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  me: () => request<any>('/auth/me'),
};

// Wards
export const wards = {
  list: () => request<any[]>('/wards'),
  get: (id: number) => request<any>(`/wards/${id}`),
  create: (name: string) => request<any>('/wards', { method: 'POST', body: JSON.stringify({ name }) }),
  update: (id: number, name: string) => request<any>(`/wards/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  delete: (id: number) => request<any>(`/wards/${id}`, { method: 'DELETE' }),
};

// Nurses
export const nurses = {
  list: (wardId?: number) => request<any[]>(`/nurses${wardId ? `?wardId=${wardId}` : ''}`),
  create: (data: any) => request<any>('/nurses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => request<any>(`/nurses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<any>(`/nurses/${id}`, { method: 'DELETE' }),
};

// Rules
export const rules = {
  get: (wardId: number) => request<any>(`/rules/${wardId}`),
  update: (wardId: number, data: any) => request<any>(`/rules/${wardId}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Schedules
export const schedules = {
  list: (wardId?: number) => request<any[]>(`/schedules${wardId ? `?wardId=${wardId}` : ''}`),
  get: (id: number) => request<any>(`/schedules/${id}`),
  generate: (wardId: number, yearMonth: string) =>
    request<any>('/schedules/generate', { method: 'POST', body: JSON.stringify({ wardId, yearMonth }) }),
  updateEntry: (id: number, nurseId: number, date: string, shiftType: string) =>
    request<any>(`/schedules/${id}/entry`, { method: 'PUT', body: JSON.stringify({ nurseId, date, shiftType }) }),
  confirm: (id: number) => request<any>(`/schedules/${id}/confirm`, { method: 'PUT' }),
  validate: (id: number) => request<any>(`/schedules/${id}/validate`),
  stats: (id: number) => request<any[]>(`/schedules/${id}/stats`),
  export: async (id: number) => {
    const token = getToken();
    const res = await fetch(`${BASE}/schedules/${id}/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.blob();
  },
};

// Shift Requests
export const shiftRequests = {
  list: (scheduleId?: number) => request<any[]>(`/shift-requests${scheduleId ? `?scheduleId=${scheduleId}` : ''}`),
  create: (data: any) => request<any>('/shift-requests', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id: number) => request<any>(`/shift-requests/${id}/approve`, { method: 'PUT' }),
  reject: (id: number) => request<any>(`/shift-requests/${id}/reject`, { method: 'PUT' }),
};

// Holidays
export const holidays = {
  list: (wardId?: number) => request<any[]>(`/holidays${wardId ? `?wardId=${wardId}` : ''}`),
  create: (data: any) => request<any>('/holidays', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: number) => request<any>(`/holidays/${id}`, { method: 'DELETE' }),
};
