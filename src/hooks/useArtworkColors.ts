import chroma from "chroma-js";
import { getPaletteSync, type Color } from "colorthief";
import { useEffect, useState } from "react";

export const fallbackArtworkColors = ["#f7f7f7", "#c4c4c4"] as const;

function brightenPaletteColor(color: Color): string {
  const value = chroma(color.array());
  const brightenFactor = 3 * (1 - value.luminance());
  return value.brighten(brightenFactor).hex();
}

export function paletteFromImage(image: HTMLImageElement): readonly [string, string] {
  const colors = (getPaletteSync(image, { colorCount: 3 }) ?? [])
    .map(brightenPaletteColor);

  return [
    colors[0] ?? fallbackArtworkColors[0],
    colors[1] ?? colors[0] ?? fallbackArtworkColors[1]
  ];
}

export function useArtworkColors(imageUrl?: string): readonly [string, string] {
  const [colors, setColors] = useState<readonly [string, string]>(fallbackArtworkColors);

  useEffect(() => {
    if (!imageUrl) {
      setColors(fallbackArtworkColors);
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
        setColors(fallbackArtworkColors);
      }
    };
    image.onerror = () => { if (active) setColors(fallbackArtworkColors); };
    image.src = imageUrl;

    return () => { active = false; };
  }, [imageUrl]);

  return colors;
}
