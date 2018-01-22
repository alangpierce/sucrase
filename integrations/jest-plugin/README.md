# Sucrase Jest plugin

[![npm version](https://badge.fury.io/js/@sucrase%2Fjest-plugin.svg)](https://www.npmjs.com/package/@sucrase/jest-plugin)
[![MIT License](https://img.shields.io/npm/l/express.svg?maxAge=2592000)](LICENSE)

This is a simple Jest plugin that makes it easy to use
[Sucrase](https://github.com/alangpierce/sucrase) when running Jest tests.

## Usage

First install the package as a dev dependency:
```
yarn add --dev @sucrase/jest-plugin
```

Then add it as a transform to your Jest config in package.json:
```
  "jest": {
    "transform": {
      ".(js|jsx|ts|tsx)": "@sucrase/jest-plugin"
    },
    ...
  }
```

Currently, the transforms are not configurable; it uses always runs the import
transform and uses the file extension to decide whether to run the JSX, Flow,
and/or TypeScript transforms.
