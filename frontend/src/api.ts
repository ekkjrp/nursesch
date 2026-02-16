// API 클라이언트 — Python FastAPI 백엔드 REST API 호출 (v1.1)

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
    throw new Error(body.detail || body.error || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type');
  if (ct && ct.includes('spreadsheet')) {
    return res.blob() as any;
  }
  return res.json();
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string; nurse: any }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  me: () => request<any>('/auth/me'),
};

// Wards
export const wards = {
  list: () => request<any[]>('/wards'),
  create: (name: string) => request<any>('/wards', { method: 'POST', body: JSON.stringify({ name }) }),
  update: (id: number, name: string) => request<any>(`/wards/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  delete: (id: number) => request<any>(`/wards/${id}`, { method: 'DELETE' }),
};

// Nurses — 직급(grade: HN/CN/RN/AN), 정렬 순서, 나이트 전담, 연차
export const nurses = {
  list: (wardId?: number, sortBy?: string) => {
    const params = new URLSearchParams();
    if (wardId) params.append('ward_id', wardId.toString());
    if (sortBy) params.append('sort_by', sortBy);
    const qs = params.toString();
    return request<any[]>(`/nurses${qs ? `?${qs}` : ''}`);
  },
  create: (data: any) => request<any>('/nurses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => request<any>(`/nurses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<any>(`/nurses/${id}`, { method: 'DELETE' }),
  reorder: (items: { id: number; sort_order: number }[]) =>
    request<any[]>('/nurses/reorder', { method: 'PUT', body: JSON.stringify(items) }),
};

// Rules — Charge/Action 인원, AN 주말 자동 Off 등 포함
export const rules = {
  get: (wardId: number) => request<any>(`/rules/ward/${wardId}`),
  update: (wardId: number, data: any) =>
    request<any>(`/rules/ward/${wardId}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Schedules
export const schedules = {
  list: (wardId?: number) => request<any[]>(`/schedules${wardId ? `?ward_id=${wardId}` : ''}`),
  get: (id: number) => request<any>(`/schedules/${id}`),
  generate: (wardId: number, yearMonth: string, prevMonthEntries: any[] = []) =>
    request<any>('/schedules/generate', {
      method: 'POST',
      body: JSON.stringify({ ward_id: wardId, year_month: yearMonth, prev_month_entries: prevMonthEntries }),
    }),
  updateEntry: (scheduleId: number, entryId: number, shiftType: string) =>
    request<any>(`/schedules/${scheduleId}/entries/${entryId}`, {
      method: 'PUT', body: JSON.stringify({ shift_type: shiftType }),
    }),
  confirm: (id: number) => request<any>(`/schedules/${id}/confirm`, { method: 'POST' }),
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

// Shift Requests — 간호사 근무 요청, 관리자 직접 지정
export const shiftRequests = {
  list: (yearMonth?: string, nurseId?: number) => {
    const params = new URLSearchParams();
    if (yearMonth) params.append('year_month', yearMonth);
    if (nurseId) params.append('nurse_id', nurseId.toString());
    return request<any[]>(`/requests?${params}`);
  },
  create: (data: any) => request<any>('/requests', { method: 'POST', body: JSON.stringify(data) }),
  adminCreate: (data: any) => request<any>('/requests/admin', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id: number) => request<any>(`/requests/${id}/approve`, { method: 'PUT' }),
  reject: (id: number) => request<any>(`/requests/${id}/reject`, { method: 'PUT' }),
  delete: (id: number) => request<any>(`/requests/${id}`, { method: 'DELETE' }),
};

// Leaves — 연차/희망 휴일 관리
export const leaves = {
  get: (nurseId: number, yearMonth: string, wardId?: number) =>
    request<any>(`/leaves/${nurseId}/${yearMonth}${wardId ? `?ward_id=${wardId}` : ''}`),
  upsert: (nurseId: number, yearMonth: string, data: any, wardId?: number) =>
    request<any>(`/leaves/${nurseId}/${yearMonth}${wardId ? `?ward_id=${wardId}` : ''}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
  getWard: (wardId: number, yearMonth: string) =>
    request<any[]>(`/leaves/ward/${wardId}/${yearMonth}`),
};

// Holidays
export const holidays = {
  list: (wardId: number) => request<any[]>(`/holidays?ward_id=${wardId}`),
  create: (wardId: number, data: any) =>
    request<any>(`/holidays?ward_id=${wardId}`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: number) => request<any>(`/holidays/${id}`, { method: 'DELETE' }),
};
