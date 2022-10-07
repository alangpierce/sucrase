# Sucrase Jest plugin

[![npm version](https://badge.fury.io/js/@sucrase%2Fjest-plugin.svg)](https://www.npmjs.com/package/@sucrase/jest-plugin)
[![MIT License](https://img.shields.io/npm/l/express.svg?maxAge=2592000)](LICENSE)

This is a simple Jest plugin that makes it easy to use
[Sucrase](https://github.com/alangpierce/sucrase) when running Jest tests.

## Usage

First install the package and `sucrase` as a dev dependency:
```
yarn add --dev @sucrase/jest-plugin sucrase
```

Then change the default transform in jest.config.js file:
```ts
  ...
  transform: { "\\.(js|jsx|ts|tsx)$": "@sucrase/jest-plugin" },
  ...
```

You can specify additional transformation options to Sucrase by passing an object. For example, to enable automatic react transforms:

```ts
  ...
  transform: { "\\.(js|jsx|ts|tsx)$": ["@sucrase/jest-plugin", { jsxRuntime: 'automatic' }] },
  ...
```

By default, the `transforms` option is automatically detected based on file type and Jest mode.
If you pass a `transforms` array in the options, it will apply to all files, regardless of extension.
