import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import nextPlugin from "@next/eslint-plugin-next";
import importPlugin from "eslint-plugin-import";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import { fileURLToPath } from "node:url";
import path from "node:path";

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

export default [
  js.configs.recommended,
  {
    ignores: [
      "node_modules",
      "dist",
      ".next",
      "frontend/.next",
      "frontend/out",
      "frontend/node_modules",
      "contracts/out",
      "contracts/cache",
      "contracts/broadcast",
      "contracts/lib/**/*",
      "**/*.d.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ["./tsconfig.base.json", "./indexer/tsconfig.json", "./frontend/tsconfig.json"],
        tsconfigRootDir,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "@next/next": nextPlugin,
      import: importPlugin,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "no-unused-vars": "off",
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
