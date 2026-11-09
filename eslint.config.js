import js from "@eslint/js";
import react from "eslint-plugin-react";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**", "apps/web/public/**", "e2e/test-results/**", "e2e/playwright-report/**", ".claude/**", ".specify/**"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": true, "ts-nocheck": true, "ts-expect-error": "allow-with-description" },
      ],
      // « import { z } » empêche le tree-shaking : 85,8 Ko gzip contre 7,6 Ko (research.md R10).
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value=/^zod(\\u002Fmini)?$/] > ImportSpecifier",
          message: 'Use `import * as z from "zod/mini"` (research.md R10).',
        },
      ],
    },
  },
  {
    files: ["apps/web/src/**/*.tsx"],
    plugins: { react },
    settings: { react: { version: "19" } },
    rules: { "react/jsx-no-literals": ["error", { noStrings: false, ignoreProps: true }] },
  },
);
