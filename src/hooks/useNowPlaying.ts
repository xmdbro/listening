import { useEffect, useState } from "react";
import type { NowPlayingData } from "../types";

interface NowPlayingState {
  data: NowPlayingData | null;
  error: string | null;
  loading: boolean;
}

export function useNowPlaying(refreshEvery = 15_000): NowPlayingState {
  const [state, setState] = useState<NowPlayingState>({
    data: null,
    error: null,
    loading: true
  });

  useEffect(() => {
    let active = true;

    async function refresh(): Promise<void> {
      try {
        const response = await fetch("/api/now-playing", {
          signal: AbortSignal.timeout(6_000)
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
            error: error instanceof Error ? error.message : "Listening data is unavailable.",
            loading: false
          }));
        }
      }
    }

    void refresh();
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, refreshEvery);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshEvery]);

  return state;
}
