import { API_BASE } from "@/lib/utils";

export type TokenInfo = {
  access_token: string;
  token_type: string;
};

export type UsageEvent = {
  id: number;
  kind: string;
  prompt_chars: number;
  completion_chars: number;
  prompt_tokens: number;
  completion_tokens: number;
  input_bytes: number;
  meta?: string | null;
  created_at: string;
};

export type UsageSummary = {
  total_events: number;
  total_input_bytes: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_prompt_chars: number;
  total_completion_chars: number;
};

export function authHeaders(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function login(username: string, password: string): Promise<TokenInfo> {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    // Map 401 to a friendlier message in Chinese
    if (res.status === 401) {
      throw new Error("密码错误");
    }
    // Try to surface backend detail, otherwise generic
    try {
      const data = await res.json();
      const detail = typeof data?.detail === 'string' ? data.detail : undefined;
      throw new Error(detail || `登录失败: ${res.status}`);
    } catch {
      throw new Error(`登录失败: ${res.status}`);
    }
  }
  return res.json();
}

export async function registerUser(username: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Register failed: ${res.status}`);
  return res.json();
}

export async function me(token?: string) {
  const res = await fetch(`${API_BASE}/users/me`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Me failed: ${res.status}`);
  return res.json();
}

export async function usageSummary(token?: string): Promise<UsageSummary> {
  const res = await fetch(`${API_BASE}/users/me/usage/summary`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Usage summary failed: ${res.status}`);
  return res.json();
}

export async function usageList(token?: string): Promise<UsageEvent[]> {
  const res = await fetch(`${API_BASE}/users/me/usage`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Usage list failed: ${res.status}`);
  return res.json();
}

export type OCRKind = "image" | "pdf";

export function uploadAndStream(
  token: string | undefined,
  file: File,
  kind: OCRKind,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  prompt?: string,
) {
  const endpoint = kind === "pdf" ? "pdf" : "image";
  const form = new FormData();
  form.append("file", file);
  if (prompt && prompt.trim()) {
    form.append("prompt", prompt);
  }
  return fetch(`${API_BASE}/ocr/${endpoint}`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
    signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) throw new Error(`Upload failed: ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // We can flush chunks directly since backend is plain text stream
      onChunk(buf);
    }
    if (buf) onChunk(buf);
  });
}
