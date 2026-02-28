import type { Variants } from "framer-motion";

export function makeFadeUp(stagger = 0.1): Variants {
  return {
    hidden: { opacity: 0, y: 20 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * stagger,
        duration: 0.55,
        ease: "easeOut" as const,
      },
    }),
  };
}

export const fadeUp = makeFadeUp();
