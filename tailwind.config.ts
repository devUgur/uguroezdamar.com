import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./shared/**/*.{ts,tsx}",
    "./content/**/*.{md,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        accent: 'var(--color-accent)',
        'primary-foreground': 'var(--color-primary-foreground)',
        'secondary-foreground': 'var(--color-secondary-foreground)',
        'muted-foreground': 'var(--color-muted-foreground)',
        border: 'var(--color-border)',
        surface: 'var(--color-surface)'
      },
      fontFamily: {
        // use CSS custom properties set in globals.css for runtime control
        sans: ['var(--font-sans)'],
        serif: ['var(--font-serif)'],
        mono: ['var(--font-mono)']
      }
    },
  },
  plugins: [],
} satisfies Config;
