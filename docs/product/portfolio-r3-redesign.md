# R3 — Portfolio Engineering: Design, Content and Performance Plan

> Proposal · 17 October 2026 · No release approval implied.
> Source evidence: supplied CV (October 2026), the current site repository on `main`,
> ViralSync and Video Lab architecture/README files. Visual changes need owner approval.

## Objective

Build an editorial engineering portfolio that demonstrates real experience from UI to
backend/data to infrastructure without pretending unfinished products are shipped.
Audience priority: engineering hiring teams and potential dual-study partner companies;
secondarily technical peers and prospective clients.

## Voice and visual direction

**Keep:** real SVG brand mark, warm ivory/ink palette, serif-led editorial headlines,
hairline separators, dense mono metadata, generous negative space and calm transitions.
**Improve:** scanability, hierarchy, specific proof, mobile rhythm, accessible contrast,
a meaningful visual showcase of architecture and projects, strong case studies.
**Avoid:** invented testimonials, numbers, dashboards, customer logos or screenshots;
animated backgrounds, scrolljacking, skill progress bars, faux terminal scenes and heavy
client-side motion.

Palette baseline: `#F4F1EB` ivory, `#121212` ink, `#EAE6DF` surface;
retain tested dark-mode equivalents. Introduce a restrained accent only after a
light/dark contrast and visual review. Typography: Playfair Display for high-level
editorial display, Inter for readable body, JetBrains Mono for concise technical labels.
One H1 per page, semantic sections, fluid spacing/typography, WCAG AA contrast.

## Canonical information architecture

| Route | Purpose | Launch behavior |
| --- | --- | --- |
| `/` | Powerful 60-second professional overview | Essential |
| `/projects` | Curated project catalog, honest status | Existing canonical route |
| `/projects/viralsync` | Architecture case study, contributions, constraints | Draft until private content approved |
| `/projects/video-lab` | Production pipeline and safety-gate case study | Draft until private content approved |
| `/about` | Professional background, experience timeline, engineering approach | Populate from verified CV |
| `/contact` | Clear contact and accessible form | Validate end-to-end |
| `/blog` | Technical writing, only when actual articles exist | Keep off main nav until populated |
| `/education` | Existing legacy detail page | Keep stable; consider /about consolidation later |
| `/imprint`, `/privacy` | Required legal information | Operator confirmation is a release gate |
| `/work`, `/work/:slug` | Existing legacy aliases | Preserve permanent redirects |

No extra portfolio application, live GitHub API, CMS, database-backed project content,
or unneeded service is necessary. Git/MDX remains canonical (ADR 0019).

## Homepage — exact ordered content

1. **Header:** existing brand, Projects, About, Contact, theme toggle and accessible
   mobile navigation. Blog/Writing appears only after a published article.
2. **Hero:** retain three-line editorial brand statement as design anchor; make the
   immediate subcopy explicitly communicate full-stack + infrastructure ownership.
   Two actions: Explore Projects / Get in Touch. Location: Dortmund, Germany.
   Optional CV action only after a public, privacy-safe resume PDF is approved.
3. **Evidence strip:** short, defensible facts: professional full-time full-stack
   experience with DevOps, freelance website delivery, building independent products.
   Do not replace evidence with fabricated counts or years of seniority.
4. **Selected Work:** ViralSync, Video Lab as two flagship case studies **only after
   their copy is reviewed and `draft: false` intentionally approved**. On page:
   product/engineering challenge, personal responsibility, technologies, current
   maturity and a clear detail link. Approved real screenshots only; show editorial
   text composition otherwise. Until approved, no placeholder screenshot.
5. **Capabilities:** three substantive pillars: Interface & Experience
   (React/Next, Vue/Nuxt), Systems & Data (Node/Python, REST APIs and relational persistence),
   Shipping & Infrastructure (Linux, CI/CD, Docker, Cloudflare). Avoid isolated
   ungraded logo walls. Each pillar links to a concrete case-study example when ready.
6. **Experience:** a 2-entry chronological preview (Cherry Communication and
   freelance work) with specific responsibilities. Link to detailed /about.
7. **How I build:** accessible design-to-production narrative:
   Problem -> Architecture -> Implementation -> Verification -> Operations.
   Real screenshots, sanitized diagrams or short architecture decision excerpts can
   be added after approval, not generated fake UI.
8. **Writing:** no empty teaser. Render only when verified articles exist.
9. **Contact:** a clear invitation to discuss engineering work, collaboration or a
   dual-study partnership without claiming immediate availability. Link to contact
   page, with validated form and professional social profiles when available.
10. **Footer:** real brand, contact, legal links, copyright, and optionally GitHub/
    LinkedIn if URLs are verified. No unverified employers or certifications.

On the first viewport, the reader should identify: who builds, what they build,
where they are, and one route to tangible proof or contact.

## Project detail template

- Editorial hero: one-sentence value, current development status and author role.
- At-a-glance facts: dates, stack, repo visibility, own contributions, links.
- Problem and constraints.
- Responsibility vs external libraries/integrations.
- Design choices and alternatives considered (e.g. ports/adapters, monorepo
  boundaries, approval gates, event/worker separation).
- Sanitized architecture map and request/data flow.
- Testing, CI and operations evidence, not generic best-practice claims.
- Outcomes explicitly separated into implemented, verified and planned.
- Improvements and lessons learned.
- Related work and relevant contact CTA.

ViralSync: multi-application monorepo, Cloudflare Workers/Hono API, PostgreSQL/Drizzle,
provider boundaries, approval-controlled agent design and deployments. Verify status
of each capability before publishing.

Video Lab: Next.js modular monolith, Mastra Director/production brief, exact-plan
approval gate, provider adapters, FFmpeg/HyperFrames composition, cost ledger and
local/Modal media execution. Verify runnable/production state before publishing.

## Engineering and performance strategy

### Fonts / first render (P0)

Existing global CSS imports eight @fontsource stylesheets with the default
`font-display: swap`: font replacement can occur after first paint. The R3 initial
patch moves font loading into `next/font/local` from installed WOFF2 assets,
with critical-face preloads, metric-adjusted fallbacks and `display: optional`.
This is a first implementation, not proof the problem is resolved.

Trade-off: `optional` may retain fallback fonts on slow first visits instead of
swapping late. The initial patch deliberately loads regular (400) faces only; bold
styles may be synthesized. Evaluate whether locally stored subsetted variable fonts
with explicit weights would improve typography and total transfer before release.

Acceptance requires Chrome/Firefox/Safari, cold and warm cache, 3G/4G simulation,
screenshots at first paint, and computed-family/font-loading verification. Measure
font network requests, total transferred WOFF2 bytes and text-related CLS. Compare
`swap` + adjusted fallback against `optional` by actual visual output.

### Core Web Vitals and JS

- Targets (field-data p75 on mobile): LCP <= 2.5 s, CLS <= 0.1, INP <= 200 ms.
  Treat these as release targets, not measurements already achieved.
- Use server components for static home/project/about content; islands only for
  theme toggle, mobile menu and contact form.
- Keep the hero text-first; do not fetch GitHub data at render time.
- Priority hint only the hero asset (if later added) and critical faces. Images:
  correctly sized next/image sources, responsive `sizes`, AVIF/WebP where supported,
  fixed aspect ratio and meaningful alt. Avoid LCP-blocking ambient videos.
- Review theme hydration visually, route-level code splitting, build output,
  server-only boundaries, compressed HTML/CSS, cache headers, and redirect chains.
- Inspect bundle and local startup with cold-cache and warm-cache measurements.
  Do not invoke production build, migration or portal when running the site dev task.

### Accessibility, SEO and security

- Keyboard focus, skip link, reduced motion, 44px-ish touch targets and semantic
  headings; mobile menu Escape/route-close; screen reader review.
- Title/description per route, canonical URLs, schema.org Person/CreativeWork where
  truthful, sitemap excluding drafts, robots, OG images based on approved artwork.
- English is current canonical language; introduce German only with maintained full
  translations and hreflang. Avoid mixed-language fragments.
- Never expose a private repository, secrets, internal endpoints, private addresses
  or personal phone number on public pages.
- Contact form security and retention must match privacy policy; verify database
  writes and operations, not only 200 response status.

## Execution slices and release gates

**R3.0 Technical foundation (this draft PR)**
- Implement a first font loading change for review and cold-load testing.
- Populate public professional experience/education from the supplied CV.
- Create this specification; no new project publishing or unapproved visual overhaul.
- Confirm lint, types, tests, build, and preview smoke, then browser font tests.

**R3.1 Homepage and navigation**
- Refine hero copy and responsive rhythm; evidence strip, capability pillars,
  experience teaser, contact; screenshots at 320/375/768/1024/1440/1920 in both themes.
- Owner signs off the visual composition before merging.

**R3.2 Case studies**
- Verify claims against code, sanitize diagrams/screenshots, record real implementation
  status, fill role/contributions/period, request explicit private-project publication
  approval, then turn off `draft` in separate content PRs.

**R3.3 Proof and detail**
- Polish /about, project list/detail typography, contact, metadata, language policy,
  accessibility and approved downloadable CV. Add 1 genuine technical article if ready.

**R3.4 Production excellence**
- Lighthouse/Playwright and Axe baselines, Core Web Vitals field measurement,
  first-visit fonts, privacy/legal review, CI success and signed-off Vercel preview.
  Keep DNS/Render/Vercel cutover separate from redesign. Never auto-promote preview.

## Definition of done

- Design approved at desktop and mobile in both themes.
- Hero/about content matches verified history with no invented claims.
- Unapproved projects remain drafts and out of production/sitemap.
- No font face visibly replaces the hero typography during tested cold loads,
  with baseline/after screenshots and browser test conditions documented.
- Measured Lighthouse/CWV evidence recorded; zero serious/critical Axe findings.
- Lint, types, unit/integration tests, production build, smoke and keyboard checks pass.
- Owner approves case-study text, security/privacy and production release separately.

## Existing work to coordinate

- R2-A.1 deliberately preserved the current brand voice; it has an open visual
  approval checkpoint. R3 should not silently replace its canonical logo.
- Open draft PR #7 predates the current content-from-Git architecture; avoid
  merging historical UI work blindly.
- Existing PRs #14 (retired CMS tables) and #18 (pre-launch hygiene) touch other
  release concerns. Rebase conflicts must be reviewed before any merge.
