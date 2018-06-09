# Sucrase Webpack loader

[![npm version](https://badge.fury.io/js/@sucrase%2Fwebpack-loader.svg)](https://www.npmjs.com/package/@sucrase/webpack-loader)
[![MIT License](https://img.shields.io/npm/l/express.svg?maxAge=2592000)](LICENSE)

This is a simple Webpack loader that makes it easy to use
[Sucrase](https://github.com/alangpierce/sucrase) in your build.

**Note: Object rest/spread syntax (e.g. `{...a, b: c}`) requires Webpack 4. For
earlier Webpack versions, you can use
[webpack-object-rest-spread-plugin](https://github.com/alangpierce/sucrase/tree/master/integrations/webpack-object-rest-spread-plugin)
alongside this loader.**

## Usage

First install the package and Sucrase as a dev dependency:
```
yarn add --dev @sucrase/webpack-loader sucrase
```

Then add it as a loader to your webpack config:
```
module: {
  rules: [
    {
      test: /\.js$/,
      use: {
        loader: '@sucrase/webpack-loader',
        options: {
          transforms: ['jsx']
        }
      }
    }
  ]
}
```
