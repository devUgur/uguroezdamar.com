---
applyTo: '**'
---

# shadcn/ui Rules (Project Contract)

## 1. Installation & CLI
- Components are added ONLY via CLI:
  - pnpm dlx shadcn@latest add <component>
- Never copy/paste from docs unless CLI is impossible.
- components.json must reflect our folder structure and aliases.
- Do not rename shadcn component filenames after generation.

## 2. Folder Structure
- Generated shadcn primitives live in: `src/shared/ui/shadcn/*`
- Project design-system wrappers live in: `src/shared/ui/*`
- Feature components live in: `src/features/*/ui/*`

## 3. Modification Policy
- Prefer NOT to edit generated primitives unless:
  - bugfix required
  - accessibility fix
  - token/theme integration
- If editing a primitive:
  - keep API stable
  - document the change in the file header
  - avoid large refactors
- Prefer wrapper components for styling defaults:
  - e.g. `src/shared/ui/Button.tsx` wraps `src/shared/ui/shadcn/button.tsx`

## 4. Styling
- Tailwind only.
- No inline styles.
- No custom CSS per component.
- All design tokens (colors/radius) are controlled via CSS variables in `src/app/globals.css`.
- Do not introduce new arbitrary colors; use tokens.

## 5. Client/Server
- Server Components by default.
- Add `"use client"` ONLY when required:
  - hooks, event handlers, browser APIs, interactive state.
- Keep client components small ("islands") and pass data via props.

## 6. Accessibility & Semantics
- Keep Radix/shadcn accessibility props intact.
- Never remove aria-* attributes without a reason.
- Prefer semantic HTML (button/label/input).

## 7. Imports & Exports
- Import shadcn primitives from `@/shared/ui/shadcn/<component>`.
- Import wrappers from `@/shared/ui/<Component>`.
- Avoid deep relative imports.

## 8. Updating shadcn
- Update via CLI and re-run `add` where needed.
- Resolve diffs by keeping our wrapper API stable.
- If a primitive changed upstream, adapt wrappers not feature code.