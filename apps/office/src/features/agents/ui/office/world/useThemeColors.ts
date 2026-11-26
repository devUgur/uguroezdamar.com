"use client";

import { useEffect, useState } from "react";
import { Color, SRGBColorSpace } from "three";

const TOKENS = ["background", "surface", "foreground", "card", "primary", "muted", "border", "accent", "destructive"] as const;

export type ThemeColors = Record<(typeof TOKENS)[number], Color>;

/** A token such as `40 29% 94%` (the format of globals.css) as a three.js color in sRGB. */
function readToken(styles: CSSStyleDeclaration, name: string): Color {
  const [hue = 0, saturation = 0, lightness = 50] = styles
    .getPropertyValue(`--${name}`)
    .trim()
    .split(/\s+/)
    .map((part) => Number.parseFloat(part));
  return new Color().setHSL(hue / 360, saturation / 100, lightness / 100, SRGBColorSpace);
}

function readAll(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  return Object.fromEntries(TOKENS.map((name) => [name, readToken(styles, name)])) as ThemeColors;
}

/** The portal's design tokens as three.js colors; follows the light/dark switch of the portal. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(readAll);

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readAll()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  return colors;
}
