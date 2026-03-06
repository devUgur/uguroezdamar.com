import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

const codeFiles = ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"];

const alwaysRestrictedPatterns = [
  {
    group: ["@/shared/ui/*", "**/shared/ui/*"],
    message: "Legacy UI imports are forbidden. Use @ugur/ui entrypoint imports.",
  },
  {
    group: ["@ugur/*/src/*", "@ugur/*/dist/*"],
    message: "Deep imports are forbidden. Import from the package entrypoint only.",
  },
];

const portalRestrictedPatterns = [
  {
    group: ["@/apps/site/**", "apps/site/**", "**/apps/site/**"],
    message: "Portal must not import app-internal code from apps/site. Use shared packages instead.",
  },
  {
    group: ["features/*/server/*", "features/**/server/**", "@/features/*/server/*", "@/features/**/server/**"],
    message: "Portal must not import legacy feature server modules. Use @ugur/server or apps/portal/src/server loaders.",
  },
  {
    group: ["shared/lib/*", "shared/lib/**", "@/shared/lib/*", "@/shared/lib/**"],
    message: "Portal must not import shared/lib directly. Use @ugur/server or apps/portal/src/server loaders.",
  },
  {
    group: ["@ugur/ui/src/*", "@ugur/ui/dist/*", "@ugur/server/src/*", "@ugur/server/dist/*"],
    message: "Deep imports are forbidden. Import from the package entrypoint only.",
  },
];

const siteRestrictedPatterns = [
  {
    group: ["@/apps/portal/**", "apps/portal/**", "**/apps/portal/**"],
    message: "Site must not import app-internal code from apps/portal. Use shared packages instead.",
  },
];

export default tseslint.config(
  {
    ignores: [".next/**", "out/**", "node_modules/**", "**/dist/**"],
  },
  {
    files: codeFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...alwaysRestrictedPatterns,
            {
              group: ["@ugur/server/*"],
              message:
                "@ugur/server deep imports are server-only and must stay in server contexts.",
            },
          ],
          paths: [
            {
              name: "@ugur/server",
              message:
                "@ugur/server is server-only. Use it only in route handlers, server actions, middleware, or src/server modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "app/api/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "apps/*/app/api/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "apps/*/app/**/route.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "apps/*/app/**/actions.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "apps/*/src/server/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "apps/*/middleware.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "middleware.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "packages/server/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: alwaysRestrictedPatterns,
        },
      ],
    },
  },
  {
    files: ["apps/site/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...alwaysRestrictedPatterns,
            ...siteRestrictedPatterns,
            {
              group: ["@ugur/server/*"],
              message:
                "@ugur/server deep imports are server-only and must stay in server contexts.",
            },
          ],
          paths: [
            {
              name: "@ugur/server",
              message:
                "@ugur/server is server-only. Use it only in route handlers, server actions, middleware, or src/server modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "apps/site/app/api/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "apps/site/app/**/route.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "apps/site/app/**/actions.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "apps/site/src/server/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "apps/site/middleware.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [...alwaysRestrictedPatterns, ...siteRestrictedPatterns],
        },
      ],
    },
  },
  {
    files: ["apps/portal/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...alwaysRestrictedPatterns,
            ...portalRestrictedPatterns,
            {
              group: ["@ugur/server/*"],
              message:
                "@ugur/server deep imports are server-only and must stay in server contexts.",
            },
          ],
          paths: [
            {
              name: "@ugur/server",
              message:
                "@ugur/server is server-only. Use it only in route handlers, server actions, middleware, or src/server modules.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "apps/portal/app/api/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "apps/portal/app/**/route.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "apps/portal/app/**/actions.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "apps/portal/src/server/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "apps/portal/middleware.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [...alwaysRestrictedPatterns, ...portalRestrictedPatterns],
        },
      ],
    },
  },
  ...tseslint.configs.recommended,
  nextPlugin.configs["core-web-vitals"],
);
