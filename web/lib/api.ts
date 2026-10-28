"use client";

import { createSupabaseBrowserClient } from "./supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function getAccessToken(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: { message: text } };
  }
  if (!res.ok) {
    const message = body?.error?.message ?? `Request failed (${res.status})`;
    const err: any = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body as T;
}

export async function apiUpload<T>(path: string, body: BodyInit, contentType = "application/octet-stream"): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers();
  headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { method: "POST", body, headers });
  const text = await res.text();
  let result: any = {};
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = { error: { message: text } };
  }
  if (!res.ok) {
    const error = new Error(result?.error?.message ?? `Upload failed (${res.status})`) as Error & { status?: number; body?: unknown };
    error.status = res.status;
    error.body = result;
    throw error;
  }
  return result as T;
}

export const apiUrl = API_URL;
export { getAccessToken };
