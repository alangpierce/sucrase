module.exports = {
  extends: [
    "airbnb-base",
    "prettier",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: `${__dirname}/tsconfig.json`,
  },
  plugins: ["prettier", "@typescript-eslint"],
  rules: {
    camelcase: "off",
    "class-methods-use-this": "off",
    "func-names": "off",
    "import/extensions": "off",
    // This rule has TypeScript false positives, so just disable for now.
    "import/named": "off",
    "import/no-cycle": "off",
    // Currently we need to do relative imports for cross-project references.
    // This could be resolved by switching to lerna or yarn workspaces.
    "import/no-relative-packages": "off",
    "import/order": [
      "error",
      {
        groups: [
          ["builtin", "external", "internal"],
          ["unknown", "parent", "sibling", "index"],
          "object",
        ],
        "newlines-between": "always",
        alphabetize: {order: "asc", caseInsensitive: true},
      },
    ],
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: [
          "**/benchmark/**",
          "**/example-runner/**",
          "**/generator/**",
          "**/test/**",
          "**/test262/**",
          "**/script/**",
        ],
        optionalDependencies: false,
      },
    ],
    "import/no-mutable-exports": "off",
    "import/prefer-default-export": "off",
    "import/no-unresolved": "off",
    "lines-between-class-members": "off",
    "max-classes-per-file": "off",
    "no-await-in-loop": "off",
    "no-bitwise": "off",
    "no-constant-condition": ["error", {checkLoops: false}],
    "no-continue": "off",
    "no-else-return": "off",
    "no-empty-function": "off",
    "no-fallthrough": "off",
    "no-labels": "off",
    "no-param-reassign": "off",
    "no-plusplus": "off",
    "no-restricted-syntax": "off",
    "no-restricted-globals": "off",
    "no-shadow": "off",
    "no-undef": "off",
    "no-underscore-dangle": "off",
    "no-unused-vars": "off",
    "no-use-before-define": "off",
    // False positive on TS constructors with initializers.
    "no-useless-constructor": "off",
    "prefer-destructuring": "off",
    "prettier/prettier": "error",
    strict: "off",
    "@typescript-eslint/array-type": ["error", {default: "generic"}],
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
    "@typescript-eslint/explicit-function-return-type": ["error", {allowExpressions: true}],
    // Disable in favor of explicit-function-return-type.
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-confusing-void-expression": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-inferrable-types": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-shadow": "error",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unused-vars": ["error", {args: "none"}],
    "@typescript-eslint/restrict-template-expressions": [
      "error",
      {
        allowNumber: true,
        allowBoolean: true,
        allowAny: true,
        allowNullish: true,
      },
    ],
    "@typescript-eslint/typedef": "error",
  },
  settings: {
    "import/extensions": [".js", ".ts", ".tsx"],
    "import/resolver": {
      node: {
        extensions: [".js", ".ts", ".tsx"],
      },
    },
  },
};
