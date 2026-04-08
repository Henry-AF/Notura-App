module.exports = {
  extends: ["./.eslintrc.json", "plugin:@typescript-eslint/recommended-type-checked"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint"],
  ignorePatterns: ["node_modules/", ".next/", "out/", "build/"],
  overrides: [
    {
      files: ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx"],
      rules: {
        complexity: ["error", 10],
        "max-lines-per-function": [
          "error",
          {
            max: 80,
            skipBlankLines: true,
            skipComments: true
          }
        ],
        "max-params": ["warn", 4],
        "@typescript-eslint/no-unnecessary-condition": "error",
        "@typescript-eslint/no-unnecessary-type-assertion": "error",
        "@typescript-eslint/no-unnecessary-type-arguments": "error",
        "@typescript-eslint/prefer-nullish-coalescing": "off",
        "@typescript-eslint/prefer-optional-chain": "off"
      }
    }
  ]
};
