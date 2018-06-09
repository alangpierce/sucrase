# Webpack object rest/spread plugin

[![npm version](https://badge.fury.io/js/@sucrase%2Fwebpack-object-rest-spread-plugin.svg)](https://www.npmjs.com/package/@sucrase/webpack-object-rest-spread-plugin)
[![MIT License](https://img.shields.io/npm/l/express.svg?maxAge=2592000)](LICENSE)

This is a Webpack plugin that hacks the Webpack parser to allow object
rest/spread syntax (e.g. `{...a, b: c}`) in Webpack 3 and earlier.

**Note: This plugin is only necessary when using Webpack 3 or earlier. Webpack 4
natively supports object rest/spread. See https://github.com/webpack/webpack/issues/5548
for troubleshooting tips.**

## Usage

First install the package as a dev dependency:
```
yarn add --dev @sucrase/webpack-object-rest-spread-plugin
```

Then add it as a plugin to your webpack config:
```
const ObjectRestSpreadPlugin = require('@sucrase/webpack-object-rest-spread-plugin');

...

  plugins: [
    new ObjectRestSpreadPlugin(),
  ],
}
```
