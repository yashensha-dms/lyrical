// 100% Cloudflare-Native API Client (Zero Supabase Dependency)

export interface User {
  id: string;
  email?: string;
  name?: string;
  pen_name?: string;
  picture?: string;
}

export interface Session {
  access_token: string;
  user: User;
}

const TOKEN_KEY = 'lyrical_cf_token';
const USER_KEY = 'lyrical_cf_user';

type AuthListener = (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED', session: Session | null) => void;
const listeners = new Set<AuthListener>();

function notify(event: 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED', session: Session | null) {
  listeners.forEach((fn) => {
    try { fn(event, session); } catch (e) { console.error('Auth listener error:', e); }
  });
}

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function setStoredSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notify('SIGNED_IN', { access_token: token, user });
}

function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notify('SIGNED_OUT', null);
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData) && !(options.body instanceof Blob)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(endpoint, { ...options, headers });
  if (res.status === 401) {
    clearStoredSession();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  auth: {
    getToken: getStoredToken,
    getUser: async (): Promise<{ data: { user: User | null } }> => {
      const user = getStoredUser();
      const token = getStoredToken();
      if (!token) return { data: { user: null } };
      try {
        const res = await request<{ user: User }>('/api/auth/me');
        if (res.user) {
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          return { data: { user: res.user } };
        }
      } catch {}
      return { data: { user } };
    },
    getSession: async (): Promise<{ data: { session: Session | null } }> => {
      const token = getStoredToken();
      const user = getStoredUser();
      if (!token || !user) return { data: { session: null } };
      return { data: { session: { access_token: token, user } } };
    },
    signInWithGuest: async (name?: string, pen_name?: string): Promise<Session> => {
      const savedUser = getStoredUser();
      const finalName = name || savedUser?.name || 'Writer';
      const finalPenName = pen_name || savedUser?.pen_name || finalName;
      const guestId = savedUser?.id || `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const guestUser: User = {
        id: guestId,
        name: finalName,
        pen_name: finalPenName,
      };
      const guestToken = `local_guest_${guestId}`;

      try {
        const payload: any = { name: finalName, pen_name: finalPenName };
        if (savedUser?.id) payload.id = savedUser.id;

        const data = await request<{ token: string; user: User }>('/api/auth/guest', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setStoredSession(data.token, data.user);
        return { access_token: data.token, user: data.user };
      } catch (err) {
        console.warn('Backend unavailable, proceeding with offline local guest session:', err);
        setStoredSession(guestToken, guestUser);
        return { access_token: guestToken, user: guestUser };
      }
    },
    signInWithGoogleCredential: async (credential: string): Promise<Session> => {
      const data = await request<{ token: string; user: User }>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential })
      });
      setStoredSession(data.token, data.user);
      return { access_token: data.token, user: data.user };
    },
    updateUser: async (updates: { data?: { pen_name?: string | null } }) => {
      const user = getStoredUser();
      if (user && updates.data) {
        if (updates.data.pen_name !== undefined) {
          user.pen_name = updates.data.pen_name || undefined;
        }
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        const token = getStoredToken();
        if (token) notify('USER_UPDATED', { access_token: token, user });
      }
      return { error: null };
    },
    signOut: async () => {
      clearStoredSession();
      return { error: null };
    },
    onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
      listeners.add(callback as any);
      // Immediately notify current state
      const token = getStoredToken();
      const user = getStoredUser();
      if (token && user) {
        callback('SIGNED_IN', { access_token: token, user });
      }
      return {
        data: {
          subscription: {
            unsubscribe: () => listeners.delete(callback as any)
          }
        }
      };
    }
  },

  projects: {
    list: () => request<any[]>('/api/projects'),
    get: (id: string) => request<any>(`/api/projects/${id}`),
    create: (title: string) => request<any>('/api/projects', { method: 'POST', body: JSON.stringify({ title }) }),
    update: (id: string, updates: any) => request<any>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    delete: (id: string) => request<any>(`/api/projects/${id}`, { method: 'DELETE' }),
    join: (id: string) => request<any>(`/api/projects/${id}/join`, { method: 'POST' }),
    getContent: (id: string) => request<{ id: string; title: string; content: string }>(`/api/projects/${id}/content`),
    updateContent: (id: string, content: string, title?: string) => request<{ success: boolean }>(`/api/projects/${id}/content`, {
      method: 'PUT',
      body: JSON.stringify({ content, title })
    })
  },

  phrases: {
    list: () => request<any[]>('/api/phrases'),
    create: (content: string, id?: string) => request<any>('/api/phrases', { method: 'POST', body: JSON.stringify({ content, id }) }),
    delete: (id: string) => request<any>(`/api/phrases/${id}`, { method: 'DELETE' })
  },

  graveyard: {
    list: () => request<any[]>('/api/graveyard'),
    create: (content: string, project_name: string, id?: string) => request<any>('/api/graveyard', {
      method: 'POST',
      body: JSON.stringify({ content, project_name, id })
    }),
    delete: (id: string) => request<any>(`/api/graveyard/${id}`, { method: 'DELETE' })
  },

  scrapbook: {
    get: (projectId: string) => request<any>(`/api/projects/${projectId}/scrapbook`),
    save: (projectId: string, content: any) => request<any>(`/api/projects/${projectId}/scrapbook`, {
      method: 'PUT',
      body: JSON.stringify(content)
    })
  },

  voiceMemos: {
    list: (projectId: string) => request<any[]>(`/api/projects/${projectId}/memos`),
    create: (projectId: string, audio_url: string, id?: string) => request<any>(`/api/projects/${projectId}/memos`, {
      method: 'POST',
      body: JSON.stringify({ audio_url, id })
    }),
    delete: (projectId: string, memoId: string) => request<any>(`/api/projects/${projectId}/memos/${memoId}`, { method: 'DELETE' })
  },

  storage: {
    upload: async (file: Blob | File, filename?: string): Promise<{ url: string; key: string }> => {
      const token = getStoredToken();
      const headers = new Headers();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (filename) headers.set('x-file-name', encodeURIComponent(filename));
      if (file.type) headers.set('x-file-type', file.type);

      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        headers,
        body: file
      });
      if (!res.ok) throw new Error('Failed to upload file to Cloudflare R2');
      const data = await res.json();
      return { url: data.url, key: data.key };
    },
    delete: async (key: string): Promise<boolean> => {
      await request(`/api/storage/delete/${encodeURIComponent(key)}`, { method: 'DELETE' });
      return true;
    }
  }
};
