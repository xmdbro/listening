import { useEffect, useState } from "react";

const fallback = ["#f7f7f7", "#c4c4c4"] as const;

interface Bucket {
  count: number;
  red: number;
  green: number;
  blue: number;
}

function brighten(red: number, green: number, blue: number): string {
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  const amount = Math.max(0, Math.min(0.72, 0.78 - luminance));
  const lift = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${lift(red)}, ${lift(green)}, ${lift(blue)})`;
}

function paletteFromImage(image: HTMLImageElement): [string, string] {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [...fallback];

  canvas.width = 64;
  canvas.height = 64;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Map<string, Bucket>();

  for (let index = 0; index < pixels.length; index += 16) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];
    const brightness = (red + green + blue) / 3;
    if (alpha < 200 || brightness < 18 || brightness > 245) continue;

    const key = `${red >> 5}-${green >> 5}-${blue >> 5}`;
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  }

  const colors = [...buckets.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 2)
    .map((bucket) => brighten(
      bucket.red / bucket.count,
      bucket.green / bucket.count,
      bucket.blue / bucket.count
    ));

  return [colors[0] ?? fallback[0], colors[1] ?? colors[0] ?? fallback[1]];
}

export function useArtworkColors(imageUrl?: string): readonly [string, string] {
  const [colors, setColors] = useState<readonly [string, string]>(fallback);

  useEffect(() => {
    if (!imageUrl) {
      setColors(fallback);
      return;
    }

    let active = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (!active) return;
      try {
        setColors(paletteFromImage(image));
      } catch {
        setColors(fallback);
      }
    };
    image.onerror = () => { if (active) setColors(fallback); };
    image.src = imageUrl;

    return () => { active = false; };
  }, [imageUrl]);

  return colors;
}

