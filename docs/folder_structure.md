
├─ root/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ globals.css
│  │  ├─ (marketing)/
│  │  │  ├─ page.tsx
│  │  │  ├─ about/
│  │  │  │  └─ page.tsx
│  │  │  ├─ projects/
│  │  │  │  ├─ page.tsx
│  │  │  │  └─ [slug]/
│  │  │  │     └─ page.tsx
│  │  │  ├─ work/
│  │  │  │  └─ page.tsx
│  │  │  ├─ education/
│  │  │  │  └─ page.tsx
│  │  │  └─ blog/
│  │  │     ├─ page.tsx
│  │  │     └─ [slug]/
│  │  │        └─ page.tsx
│  │  ├─ (legal)/
│  │  │  ├─ imprint/page.tsx
│  │  │  └─ privacy/page.tsx
│  │  ├─ api/
│  │  │  ├─ health/route.ts
│  │  │  └─ revalidate/route.ts
│  │  ├─ error.tsx
│  │  ├─ not-found.tsx
│  │  └─ sitemap.ts
│  │
│  ├─ features/
│  │  ├─ projects/
│  │  │  ├─ ui/
│  │  │  │  ├─ ProjectCard.tsx
│  │  │  │  ├─ ProjectGrid.tsx
│  │  │  │  └─ ProjectHero.tsx
│  │  │  ├─ server/
│  │  │  │  ├─ queries.ts
│  │  │  │  └─ types.ts
│  │  │  └─ index.ts
│  │  │
│  │  ├─ blog/
│  │  │  ├─ ui/
│  │  │  │  ├─ PostCard.tsx
│  │  │  │  ├─ Toc.tsx
│  │  │  │  └─ MdxContent.tsx
│  │  │  ├─ server/
│  │  │  │  ├─ queries.ts
│  │  │  │  └─ mdx.ts
│  │  │  └─ index.ts
│  │  │
│  │  ├─ contact/
│  │  │  ├─ ui/
│  │  │  │  └─ ContactForm.tsx        # "use client" (UX)
│  │  │  ├─ server/
│  │  │  │  ├─ actions.ts             # Server Actions (Form submit)
│  │  │  │  ├─ validators.ts          # zod schema
│  │  │  │  └─ repo.ts                # MongoDB write
│  │  │  └─ index.ts
│  │  │
│  │  └─ analytics/
│  │     ├─ server/
│  │     │  └─ repo.ts                # optional: page views in Mongo
│  │     └─ index.ts
│  │
│  ├─ shared/
│  │  ├─ ui/
│  │  │  ├─ Container.tsx
│  │  │  ├─ Section.tsx
│  │  │  ├─ Button.tsx
│  │  │  ├─ Tag.tsx
│  │  │  ├─ Card.tsx
│  │  │  └─ Header.tsx
│  │  ├─ lib/
│  │  │  ├─ env.ts
│  │  │  ├─ mongodb.ts                # MongoClient singleton (pool)
│  │  │  ├─ dates.ts
│  │  │  ├─ seo.ts
│  │  │  └─ utils.ts
│  │  └─ styles/
│  │     └─ typography.css            # optional
│  │
│  ├─ content/
│  │  ├─ projects/
│  │  │  ├─ my-project.mdx
│  │  │  └─ another-project.mdx
│  │  └─ blog/
│  │     ├─ first-post.mdx
│  │     └─ second-post.mdx
│  │
│  └─ middleware.ts                   # optional
│
├─ public/
│  ├─ images/
│  ├─ og/
│  └─ cv.pdf
│
├─ tailwind.config.ts
├─ postcss.config.mjs
├─ next.config.(js|mjs)
├─ package.json
└─ tsconfig.json