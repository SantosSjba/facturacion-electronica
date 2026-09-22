// @ts-check
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/.cache/**",
      "docs/sunat-oficial/**",
      "**/*.d.ts",
      "**/tmp/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.mjs", "eslint.config.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslintConfigPrettier,
  {
    files: ["**/scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
  {
    files: ["apps/api/src/application/**/*.{ts,tsx}", "packages/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@nestjs/common",
              message:
                "Clean architecture: application/domain must not import Nest. Use ports + infrastructure adapters.",
            },
            {
              name: "@nestjs/core",
              message:
                "Clean architecture: application/domain must not import Nest. Use ports + infrastructure adapters.",
            },
            {
              name: "@nestjs/config",
              message:
                "Clean architecture: application/domain must not import Nest. Use ports + infrastructure adapters.",
            },
          ],
          patterns: [
            {
              group: ["@nestjs/*"],
              message:
                "Clean architecture: application/domain must not import @nestjs/*. Keep Nest in interfaces/infrastructure only.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/api/**/*.{ts,tsx}"],
    rules: {
      // Nest DI modules/controllers are intentionally empty-ish classes.
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },
);
