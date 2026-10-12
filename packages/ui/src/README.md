# UI package structure

Physical layout (aligned with logical grouping):

- **primitives/** – Button, Card, Tag, Container, Section, Select, avatar, animations (form and display building blocks).
- **layout/** – Header, Footer, Topbar, ScrollProgress (page structure and chrome).
- **branding/** – Logo.
- **theme/** – ThemeProvider, ThemeToggle.
- **feedback/** – Toaster (sonner).
- **icons/** – GitHubIcon, LinkedInIcon.
- **lib/** – utils (e.g. `cn`).

Public API: `index.ts` (all exports) and `client.ts` (client-safe exports for Client Components). Shared UI components do not read cookies or depend on server packages; application-specific session UI belongs in the app shell.
