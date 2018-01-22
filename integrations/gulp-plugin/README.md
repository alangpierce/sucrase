# Sucrase Gulp plugin

[![npm version](https://badge.fury.io/js/@sucrase%2Fgulp-plugin.svg)](https://www.npmjs.com/package/@sucrase/gulp-plugin)
[![MIT License](https://img.shields.io/npm/l/express.svg?maxAge=2592000)](LICENSE)

This is a simple Gulp plugin that makes it easy to tie
[Sucrase](https://github.com/alangpierce/sucrase) into your build.

## Usage

Sucrase is a peer dependency, so you'll need to install it as well: 
```
yarn add --dev @sucrase/gulp-plugin sucrase
```

In your gulpfile, you can add it like this:

```
const sucrase = require('@sucrase/gulp-plugin');

...
  .pipe(sucrase({transforms: ['imports', 'jsx']}))
...
```
