"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type ApiOptions = { method?: string; body?: unknown };

/** Dispatch a soft refresh for every active useApi hook (e.g. after a global add). */
export function refreshApi() {
  window.dispatchEvent(new Event("money-api-refresh"));
}

/** Fetch wrapper speaking the { ok, ... } / { ok:false, error } envelope. */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || data.ok === false) {
    throw new ApiError(typeof data.error === "string" ? data.error : "Request failed.", res.status);
  }
  return data as T;
}

/**
 * Tiny GET hook with manual refetch (no extra deps).
 *
 * State is keyed by `path#nonce` and written only from async callbacks, so
 * `loading` / `data` / `error` are pure derivations — no setState in effects.
 */
export function useApi<T>(path: string | null) {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{
    path: string | null;
    req: string;
    data: T | null;
    error: string | null;
  } | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const onRefresh = () => setNonce((n) => n + 1);
    window.addEventListener("money-api-refresh", onRefresh);
    return () => {
      alive.current = false;
      window.removeEventListener("money-api-refresh", onRefresh);
    };
  }, []);

  const reqKey = path === null ? null : `${path}#${nonce}`;

  useEffect(() => {
    if (path === null || reqKey === null) return;
    let cancelled = false;
    api<T>(path)
      .then((result) => {
        if (cancelled || !alive.current) return;
        setState({ path, req: reqKey, data: result, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled || !alive.current) return;
        setState((prev) => ({
          path,
          req: reqKey,
          data: prev && prev.path === path ? prev.data : null,
          error: err instanceof Error ? err.message : "Request failed.",
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [path, reqKey]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return {
    data: state && state.path === path ? state.data : null,
    error: state && state.path === path ? state.error : null,
    loading: path !== null && state?.req !== reqKey,
    refetch,
  };
}

/** The browser's local today as YYYY-MM-DD (the server never guesses timezones). */
export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function localMonth(): string {
  return localToday().slice(0, 7);
}
