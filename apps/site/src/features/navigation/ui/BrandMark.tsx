/**
 * Inline copy of the canonical brand asset `apps/site/app/icon.svg` (also the favicon).
 * Geometry and colours must stay identical to that file; `tests/brand-mark.test.tsx`
 * fails if the two drift apart.
 */
export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="100" height="100" fill="#111" rx="16" />
      <path
        d="M 26 24 L 26 52 C 26 66 34 72 43 72 C 52 72 60 66 60 52 L 60 30"
        fill="none"
        stroke="#fff"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 74 76 L 74 48 C 74 34 66 28 57 28 C 48 28 40 34 40 48 L 40 70"
        fill="none"
        stroke="#fff"
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default BrandMark;
