import chroma from "chroma-js";
import ColorThief from "colorthief";
import { useEffect, useState } from "react";

const fallback = ["#f7f7f7", "#c4c4c4"] as const;
const colorThief = new ColorThief();

function brightenPaletteColor(color: ColorThief.RGBColor): string {
  const value = chroma(color);
  const brightenFactor = 3 * (1 - value.luminance());
  return value.brighten(brightenFactor).hex();
}

function paletteFromImage(image: HTMLImageElement): readonly [string, string] {
  const colors = colorThief
    .getPalette(image, 3)
    .map(brightenPaletteColor);

  return [
    colors[0] ?? fallback[0],
    colors[1] ?? colors[0] ?? fallback[1]
  ];
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
