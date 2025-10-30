import { API_BASE } from "@/lib/utils";

export type TokenInfo = {
  access_token: string;
  token_type: string;
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
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
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

export async function me(token: string) {
  const res = await fetch(`${API_BASE}/users/me`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Me failed: ${res.status}`);
  return res.json();
}

export async function usageSummary(token: string) {
  const res = await fetch(`${API_BASE}/users/me/usage/summary`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Usage summary failed: ${res.status}`);
  return res.json();
}

export async function usageList(token: string) {
  const res = await fetch(`${API_BASE}/users/me/usage`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Usage list failed: ${res.status}`);
  return res.json();
}

export type OCRKind = "image" | "pdf";

export function uploadAndStream(
  token: string,
  file: File,
  kind: OCRKind,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
) {
  const endpoint = kind === "pdf" ? "pdf" : "image";
  const form = new FormData();
  form.append("file", file);
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

