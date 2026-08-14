import { useEffect, useState } from "react";
import type { NowPlayingData } from "../types";

interface NowPlayingState {
  data: NowPlayingData | null;
  error: string | null;
  loading: boolean;
}

export function useNowPlaying(username: string, refreshEvery = 7_000): NowPlayingState {
  const [state, setState] = useState<NowPlayingState>({
    data: null,
    error: null,
    loading: Boolean(username.trim())
  });

  useEffect(() => {
    let active = true;
    let pendingRefresh: Promise<void> | null = null;
    const controllers = new Set<AbortController>();
    const selectedUsername = username.trim();

    if (!selectedUsername) {
      setState({ data: null, error: null, loading: false });
      return;
    }

    const query = `?${new URLSearchParams({ user: selectedUsername }).toString()}`;

    setState({ data: null, error: null, loading: true });

    async function refresh(): Promise<void> {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 6_000);
      controllers.add(controller);
      try {
        const response = await fetch(`/api/now-playing${query}`, {
          signal: controller.signal
        });
        const payload = await response.json() as NowPlayingData & {
          error?: string;
          detail?: string;
        };

        if (!response.ok) {
          throw new Error(payload.detail || payload.error || "Listening data is unavailable.");
        }

        if (active) setState({ data: payload, error: null, loading: false });
      } catch (error) {
        if (active) {
          setState((current) => ({
            ...current,
            error: error instanceof DOMException && error.name === "AbortError"
              ? "Listening data is unavailable."
              : error instanceof Error ? error.message : "Listening data is unavailable.",
            loading: false
          }));
        }
      } finally {
        window.clearTimeout(timeout);
        controllers.delete(controller);
      }
    }

    function requestRefresh(): void {
      if (pendingRefresh) return;
      pendingRefresh = refresh().finally(() => {
        pendingRefresh = null;
      });
    }

    requestRefresh();
    const interval = window.setInterval(() => {
      if (!document.hidden) requestRefresh();
    }, refreshEvery);

    const refreshOnReturn = () => {
      if (!document.hidden) requestRefresh();
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    window.addEventListener("focus", refreshOnReturn);

    return () => {
      active = false;
      controllers.forEach((controller) => controller.abort());
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshOnReturn);
      window.removeEventListener("focus", refreshOnReturn);
    };
  }, [refreshEvery, username]);

  return state;
}
