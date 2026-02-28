import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".next/**", "out/**", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
  nextPlugin.configs["core-web-vitals"],
);
