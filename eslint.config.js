import globals from "globals";
import js from "@eslint/js";
import path from "node:path";
import prettier from "eslint-config-prettier";
import promise from "eslint-plugin-promise";
import svelte from "eslint-plugin-svelte";
import unicorn from "eslint-plugin-unicorn";
import ts from "typescript-eslint";
import { defineConfig } from "eslint/config";
import { includeIgnoreFile } from "@eslint/compat";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");
const svelteTypeChecked =
  svelte.configs["flat/recommended-type-checked"] ?? svelte.configs.recommended;

export default defineConfig(
  { ignores: ["eslint.config.js"] },
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ...ts.configs.strictTypeChecked,
  ...ts.configs.stylisticTypeChecked,
  ...svelteTypeChecked,
  unicorn.configs.recommended,
  promise.configs["flat/recommended"],
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.js", "vite.config.ts", "scripts/*.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/default-param-last": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-use-before-define": "error",
      "@typescript-eslint/prefer-as-const": "error",
      "no-shadow": "off",
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-use-before-define": "off",
      "promise/no-multiple-resolved": "error",
      "promise/no-nesting": "error",
      "promise/prefer-await-to-callbacks": "error",
      "promise/prefer-await-to-then": "error",
      "unicorn/no-empty-file": "off",
      "unicorn/no-null": "off",
      "unicorn/prevent-abbreviations": "off",
    },
  },
  {
    files: ["**/*.svelte"],
    rules: {
      "unicorn/filename-case": ["error", { case: "pascalCase" }],
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".svelte"],
      },
    },
  }
);
