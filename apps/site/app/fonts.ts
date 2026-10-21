import localFont from "next/font/local";

export const sansFont = localFont({
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: true,
  fallback: ["Arial", "sans-serif"],
});

export const displayFont = localFont({
  src: [
    { path: "./fonts/playfair-display-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/playfair-display-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-playfair",
  display: "swap",
  preload: true,
  fallback: ["Georgia", "serif"],
});

export const monoFont = localFont({
  src: "./fonts/jetbrains-mono-latin-400-normal.woff2",
  variable: "--font-jetbrains-mono",
  weight: "400",
  style: "normal",
  display: "swap",
  preload: true,
  fallback: ["ui-monospace", "monospace"],
});
