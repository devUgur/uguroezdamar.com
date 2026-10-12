# UI package structure

Physical layout (aligned with logical grouping):

- **primitives/** – Button, Card, Tag, Container, Section, Select, avatar, animations (form and display building blocks).
- **layout/** – ScrollProgress, Topbar (generic chrome). Note: App-specific site shell elements (`SiteHeader`, `SiteFooter`, `SiteLogo`) belong to `apps/site/src/features/navigation` (see ADR 0015).
- **theme/** – ThemeProvider, ThemeToggle.
- **feedback/** – Toaster (sonner).
- **icons/** – GitHubIcon, LinkedInIcon.
- **lib/** – utils (e.g. `cn`).

Public API: `index.ts` (all exports) and `client.ts` (client-safe exports for Client Components). Shared UI components do not read cookies or depend on server packages; application-specific session UI and personal branding belong in the application shell.
