import globals from "globals";

export default [
  {
    files: ["**/*.{js,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es6,
        LaunchParams: "readonly",
      },
    },
    rules: {
      indent: ["error", "tab"],
      "linebreak-style": ["error", "windows"],
      quotes: ["error", "single"],
      semi: ["error", "always"],
      "no-console": "off",
      "no-trailing-spaces": "error",
      "prefer-const": ["error", {
        destructuring: "any",
        ignoreReadBeforeAssign: false,
      }],
    },
  },
];