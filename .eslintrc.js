module.exports = {
  extends: ["airbnb-base", "prettier"],
  parser: "@typescript-eslint/parser",
  // Add typescript plugin but don't use it, since that tells WebStorm to run
  // ESLint for .ts files.
  plugins: ["prettier", "typescript"],
  rules: {
    camelcase: "off",
    "class-methods-use-this": "off",
    "func-names": "off",
    "import/extensions": "off",
    // This rule has TypeScript false positives, so just disable for now.
    "import/named": "off",
    "import/no-cycle": "off",
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
    "no-undef": "off",
    "no-underscore-dangle": "off",
    "no-unused-vars": "off",
    "no-use-before-define": "off",
    // False positive on TS constructors with initializers.
    "no-useless-constructor": "off",
    "prefer-destructuring": "off",
    "prettier/prettier": "error",
    "strict": "off",
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
