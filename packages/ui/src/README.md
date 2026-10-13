# UI package structure

Physical layout (aligned with logical grouping):

- **primitives/** – Button, Card, Tag, Container, Section, Select, avatar, animations (form and display building blocks).
- **layout/** – ScrollProgress (generic chrome). App shell elements live in the apps: `SiteHeader`, `SiteFooter`, `SiteLogo` in `apps/site/src/features/navigation` (ADR 0015), the portal's `Topbar` and `Footer` in `apps/portal/src/features/shell` (ADR 0017).
- **theme/** – ThemeProvider, ThemeToggle.
- **feedback/** – Toaster (sonner).
- **icons/** – GitHubIcon, LinkedInIcon.
- **lib/** – utils (e.g. `cn`).

Public API: `index.ts` (all exports) and `client.ts` (client-safe exports for Client Components). The package is consumed as TypeScript source — there is no build step and no `dist` (ADR 0017). Shared UI components do not read cookies or depend on server packages; application-specific session UI and personal branding belong in the application shell.
