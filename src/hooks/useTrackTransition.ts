import { useEffect, useRef, useState } from "react";
import type { NowPlayingData } from "../types";

interface TrackTransition {
  current: NowPlayingData | null;
  outgoing: NowPlayingData | null;
  transitioning: boolean;
}

const TRANSITION_DURATION_MS = 1_100;

function trackKey(data: NowPlayingData | null): string {
  const track = data?.track;
  return track ? `${track.artist}\u0000${track.name}\u0000${track.album}` : "";
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (!url) {
      resolve();
      return;
    }

    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
}

export function useTrackTransition(data: NowPlayingData | null): TrackTransition {
  const [current, setCurrent] = useState<NowPlayingData | null>(null);
  const [outgoing, setOutgoing] = useState<NowPlayingData | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const currentRef = useRef<NowPlayingData | null>(null);
  const sequenceRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const nextKey = trackKey(data);
    const currentKey = trackKey(currentRef.current);

    if (!data?.track || !currentRef.current?.track) {
      currentRef.current = data;
      setCurrent(data);
      setOutgoing(null);
      setTransitioning(false);
      return;
    }

    if (nextKey === currentKey) {
      currentRef.current = data;
      setCurrent(data);
      return;
    }

    const sequence = ++sequenceRef.current;
    const artwork = [data.artistImageUrl, data.track.imageUrl]
      .filter((url, index, urls) => Boolean(url) && urls.indexOf(url) === index);

    void Promise.all(artwork.map(preloadImage)).then(() => {
      if (sequence !== sequenceRef.current) return;

      const previous = currentRef.current;
      currentRef.current = data;
      setOutgoing(previous);
      setCurrent(data);
      setTransitioning(true);

      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setOutgoing(null);
        setTransitioning(false);
        timeoutRef.current = null;
      }, TRANSITION_DURATION_MS);
    });
  }, [data]);

  useEffect(() => () => {
    sequenceRef.current += 1;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  }, []);

  return { current, outgoing, transitioning };
}
