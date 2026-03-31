const URLS = {
  auth: 'https://functions.poehali.dev/70423450-4abc-421e-ade7-86acb5aa085e',
  messages: 'https://functions.poehali.dev/ebe32813-e414-4d39-afab-05f4011e39d9',
  channels: 'https://functions.poehali.dev/1442d0dd-91b8-4f14-afca-99d7e1975bc1',
  calls: 'https://functions.poehali.dev/62c76e86-a774-47d5-be72-72f26cf6012e',
};

export function getToken(): string {
  return localStorage.getItem('fire_token') || '';
}

export function setToken(token: string) {
  localStorage.setItem('fire_token', token);
}

export function clearToken() {
  localStorage.removeItem('fire_token');
  localStorage.removeItem('fire_user');
}

export function getStoredUser() {
  try {
    const s = localStorage.getItem('fire_user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function storeUser(user: object) {
  localStorage.setItem('fire_user', JSON.stringify(user));
}

async function req(base: string, path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(base + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (typeof data === 'string') return JSON.parse(data);
    return data;
  } catch {
    return { error: text };
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function register(username: string, name: string, password: string) {
  return req(URLS.auth, '/register', {
    method: 'POST',
    body: JSON.stringify({ username, name, password }),
  });
}

export async function login(username: string, password: string) {
  return req(URLS.auth, '/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function logout() {
  await req(URLS.auth, '/logout', { method: 'POST' });
  clearToken();
}

export async function getMe() {
  return req(URLS.auth, '/me');
}

export async function getUsers() {
  return req(URLS.auth, '/users');
}

export async function updateStatus(status: string) {
  return req(URLS.auth, '/status', {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function updateProfile(name: string, bio: string) {
  return req(URLS.auth, '/profile', {
    method: 'PUT',
    body: JSON.stringify({ name, bio }),
  });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getChats() {
  return req(URLS.messages, '/chats');
}

export async function createChat(partner_id: string) {
  return req(URLS.messages, '/chats', {
    method: 'POST',
    body: JSON.stringify({ partner_id }),
  });
}

export async function getMessages(chat_id: string) {
  return req(URLS.messages, `/messages?chat_id=${chat_id}`);
}

export async function sendMessage(chat_id: string, text: string) {
  return req(URLS.messages, '/messages', {
    method: 'POST',
    body: JSON.stringify({ chat_id, text }),
  });
}

// ─── Channels ─────────────────────────────────────────────────────────────────

export async function getChannels() {
  return req(URLS.channels, '/channels');
}

export async function createChannel(name: string, description: string) {
  return req(URLS.channels, '/channels', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function subscribeChannel(channel_id: string, subscribe: boolean) {
  return req(URLS.channels, '/subscribe', {
    method: 'POST',
    body: JSON.stringify({ channel_id, subscribe }),
  });
}

export async function likeChannel(channel_id: string, like: boolean) {
  return req(URLS.channels, '/like', {
    method: 'POST',
    body: JSON.stringify({ channel_id, like }),
  });
}

export async function getChannelMessages(channel_id: string) {
  return req(URLS.channels, `/channel-messages?channel_id=${channel_id}`);
}

export async function sendChannelMessage(channel_id: string, text: string) {
  return req(URLS.channels, '/channel-messages', {
    method: 'POST',
    body: JSON.stringify({ channel_id, text }),
  });
}

export async function getChannelMembers(channel_id: string) {
  return req(URLS.channels, `/channel-members?channel_id=${channel_id}`);
}

export async function updateChannelSettings(channel_id: string, settings: object) {
  return req(URLS.channels, '/channel-settings', {
    method: 'PUT',
    body: JSON.stringify({ channel_id, ...settings }),
  });
}

export async function assignRole(channel_id: string, user_id: string, role: string) {
  return req(URLS.channels, '/assign-role', {
    method: 'POST',
    body: JSON.stringify({ channel_id, user_id, role }),
  });
}

// ─── Calls ────────────────────────────────────────────────────────────────────

export async function getCalls() {
  return req(URLS.calls, '/');
}

export async function recordCall(callee_id: string, status: string, duration_sec: number) {
  return req(URLS.calls, '/', {
    method: 'POST',
    body: JSON.stringify({ callee_id, status, duration_sec }),
  });
}
