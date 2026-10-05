import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/generated/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.turbo/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["apps/api/**/*.module.ts", "apps/api/src/app.module.ts"],
    rules: {
      // Nest modules are decorated classes with no members.
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },
);
