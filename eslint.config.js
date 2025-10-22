// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const parser = require("@typescript-eslint/parser");

module.exports = [
  eslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
      globals: {
        // Cloudflare Workers runtime globals
        Response: "readonly",
        Request: "readonly",
        fetch: "readonly",
        crypto: "readonly",
        caches: "readonly",
        console: "readonly",
        URL: "readonly",
        FormData: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        ReadableStream: "readonly",
        btoa: "readonly",
        atob: "readonly",
        // Cloudflare Workers types
        ExecutionContext: "readonly",
        D1Database: "readonly",
        KVNamespace: "readonly",
        Vectorize: "readonly",
        Ai: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "no-undef": "off", // TypeScript handles this better
      "no-control-regex": "warn", // Allow control chars in regex for input validation
    },
  },
  {
    ignores: [
      "dist/",
      "node_modules/",
      ".wrangler/",
      "dist-tools/",
      "scripts/",
      "tools/",
      "migrations/",
      "src/generate_vector_inserts.ts", // Not in tsconfig.json project
    ],
  },
];
