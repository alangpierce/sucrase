# Sucrase

[![Build Status](https://travis-ci.org/alangpierce/sucrase.svg?branch=master)](https://travis-ci.org/alangpierce/sucrase)
[![npm version](https://img.shields.io/npm/v/sucrase.svg)](https://www.npmjs.com/package/sucrase)
[![Install Size](https://packagephobia.now.sh/badge?p=sucrase)](https://packagephobia.now.sh/result?p=sucrase)
[![MIT License](https://img.shields.io/npm/l/express.svg?maxAge=2592000)](LICENSE)
[![Join the chat at https://gitter.im/sucrasejs](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sucrasejs/Lobby)

### [Try it out](https://sucrase.io)

Sucrase is an alternative to Babel that allows super-fast development builds.
Instead of compiling a large range of JS features to be able to work in Internet
Explorer, Sucrase assumes that you're developing with a recent browser or recent
Node.js version, so it focuses on compiling non-standard language extensions:
JSX, TypeScript, and Flow. Because of this smaller scope, Sucrase can get away
with an architecture that is much more performant but less extensible and
maintainable. Sucrase's parser is forked from Babel's parser (so Sucrase is
indebted to Babel and wouldn't be possible without it) and trims it down to a
focused subset of what Babel solves. If it fits your use case, hopefully Sucrase
can speed up your development experience!

**Sucrase has been extensively tested.** It can successfully build
the [Benchling](https://benchling.com/) frontend code,
[Babel](https://github.com/babel/babel),
[React](https://github.com/facebook/react),
[TSLint](https://github.com/palantir/tslint),
[Apollo client](https://github.com/apollographql/apollo-client), and
[decaffeinate](https://github.com/decaffeinate/decaffeinate)
with all tests passing, about 1 million lines of code total.

**Sucrase is about 20x faster than Babel.** Here's one measurement of how Sucrase
compares with other tools on a large TypeScript codebase with 4045 files and
661081 lines of code:
```
             Time      Speed
Sucrase      2.928s    225752 lines per second
swc          13.782s   47966 lines per second
TypeScript   39.603s   16693 lines per second
Babel        52.598s   12569 lines per second
```

## Transforms

The main configuration option in Sucrase is an array of transform names. These
transforms are available:
* **jsx**: Transforms JSX syntax to `React.createElement`, e.g. `<div a={b} />`
  becomes `React.createElement('div', {a: b})`. Behaves like Babel 7's
  [React preset](https://github.com/babel/babel/tree/master/packages/babel-preset-react),
  including adding `createReactClass` display names and JSX context information.
* **typescript**: Compiles TypeScript code to JavaScript, removing type
  annotations and handling features like enums. Does not check types. Sucrase
  transforms each file independently, so you should enable the `isolatedModules`
  TypeScript flag so that the typechecker will disallow the few features like
  `const enum`s that need cross-file compilation.
* **flow**:  Removes Flow type annotations. Does not check types.
* **imports**: Transforms ES Modules (`import`/`export`) to CommonJS
  (`require`/`module.exports`) using the same approach as Babel and TypeScript
  with `--esModuleInterop`. Also includes dynamic `import`.
* **react-hot-loader**: Performs the equivalent of the `react-hot-loader/babel`
  transform in the [react-hot-loader](https://github.com/gaearon/react-hot-loader)
  project. This enables advanced hot reloading use cases such as editing of
  bound methods.

These proposed JS features are built-in and always transformed:
* [Optional chaining](https://github.com/tc39/proposal-optional-chaining): `a?.b`
* [Nullish coalescing](https://github.com/tc39/proposal-nullish-coalescing): `a ?? b`
* [Class fields](https://github.com/tc39/proposal-class-fields): `class C { x = 1; }`.
  This includes static fields but not the `#x` private field syntax.
* [Export namespace syntax](https://github.com/tc39/proposal-export-ns-from):
  `export * as a from 'a';`
* [Numeric separators](https://github.com/tc39/proposal-numeric-separator):
  `const n = 1_234;`
* [Optional catch binding](https://github.com/tc39/proposal-optional-catch-binding):
  `try { doThing(); } catch { }`.

### Unsupported syntax

All JS syntax not mentioned above will "pass through" and needs to be supported
by your JS runtime. For example:
* Decorators, private fields, `throw` expressions, generator arrow functions,
  and `do` expressions are all unsupported in browsers and Node (as of this
  writing), and Sucrase doesn't make an attempt to transpile them.
* Object rest/spread, async functions, and async iterators are all recent
  features that should work fine, but might cause issues if you use older
  versions of tools like webpack. BigInt and newer regex features may or may not
  work, based on your tooling.

### JSX Options
Like Babel, Sucrase compiles JSX to React functions by default, but can be
configured for any JSX use case.
* **jsxPragma**: Element creation function, defaults to `React.createElement`.
* **jsxFragmentPragma**: Fragment component, defaults to `React.Fragment`.

### Legacy CommonJS interop
Two legacy modes can be used with the `import` transform:
* **enableLegacyTypeScriptModuleInterop**: Use the default TypeScript approach
  to CommonJS interop instead of assuming that TypeScript's `--esModuleInterop`
  flag is enabled. For example, if a CJS module exports a function, legacy
  TypeScript interop requires you to write `import * as add from './add';`,
  while Babel, Webpack, Node.js, and TypeScript with `--esModuleInterop` require
  you to write `import add from './add';`. As mentioned in the
  [docs](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-7.html#support-for-import-d-from-cjs-form-commonjs-modules-with---esmoduleinterop),
  the TypeScript team recommends you always use `--esModuleInterop`.
* **enableLegacyBabel5ModuleInterop**: Use the Babel 5 approach to CommonJS
  interop, so that you can run `require('./MyModule')` instead of
  `require('./MyModule').default`. Analogous to
  [babel-plugin-add-module-exports](https://github.com/59naga/babel-plugin-add-module-exports).

## Usage

Installation:

```
yarn add --dev sucrase  # Or npm install --save-dev sucrase
```

Often, you'll want to use one of the build tool integrations:
[Webpack](https://github.com/alangpierce/sucrase/tree/master/integrations/webpack-loader),
[Gulp](https://github.com/alangpierce/sucrase/tree/master/integrations/gulp-plugin),
[Jest](https://github.com/alangpierce/sucrase/tree/master/integrations/jest-plugin),
[Rollup](https://github.com/rollup/rollup-plugin-sucrase),
[Broccoli](https://github.com/stefanpenner/broccoli-sucrase).

Compile on-the-fly via a require hook with some [reasonable defaults](src/register.ts):

```js
// Register just one extension.
require("sucrase/register/ts");
// Or register all at once.
require("sucrase/register");
```

Compile on-the-fly via a drop-in replacement for node:

```
sucrase-node index.ts
```

Run on a directory:

```
sucrase ./srcDir -d ./outDir --transforms typescript,imports
```

Call from JS directly:

```js
import {transform} from "sucrase";
const compiledCode = transform(code, {transforms: ["typescript", "imports"]}).code;
```

## What Sucrase is not

Sucrase is intended to be useful for the most common cases, but it does not aim
to have nearly the scope and versatility of Babel. Some specific examples:

* Sucrase does not check your code for errors. Sucrase's contract is that if you
  give it valid code, it will produce valid JS code. If you give it invalid
  code, it might produce invalid code, it might produce valid code, or it might
  give an error. Always use Sucrase with a linter or typechecker, which is more
  suited for error-checking.
* Sucrase is not pluginizable. With the current architecture, transforms need to
  be explicitly written to cooperate with each other, so each additional
  transform takes significant extra work.
* Sucrase is not good for prototyping language extensions and upcoming language
  features. Its faster architecture makes new transforms more difficult to write
  and more fragile.
* Sucrase will never produce code for old browsers like IE. Compiling code down
  to ES5 is much more complicated than any transformation that Sucrase needs to
  do.
* Sucrase is hesitant to implement upcoming JS features, although some of them
  make sense to implement for pragmatic reasons. Its main focus is on language
  extensions (JSX, TypeScript, Flow) that will never be supported by JS
  runtimes.
* Like Babel, Sucrase is not a typechecker, and must process each file in
  isolation. For example, TypeScript `const enum`s are treated as regular
  `enum`s rather than inlining across files.
* You should think carefully before using Sucrase in production. Sucrase is
  mostly beneficial in development, and in many cases, Babel or tsc will be more
  suitable for production builds.

See the [Project Vision](./docs/PROJECT_VISION.md) document for more details on
the philosophy behind Sucrase.

## Motivation

As JavaScript implementations mature, it becomes more and more reasonable to
disable Babel transforms, especially in development when you know that you're
targeting a modern runtime. You might hope that you could simplify and speed up
the build step by eventually disabling Babel entirely, but this isn't possible
if you're using a non-standard language extension like JSX, TypeScript, or Flow.
Unfortunately, disabling most transforms in Babel doesn't speed it up as much as
you might expect. To understand, let's take a look at how Babel works:

1. Tokenize the input source code into a token stream.
2. Parse the token stream into an AST.
3. Walk the AST to compute the scope information for each variable.
4. Apply all transform plugins in a single traversal, resulting in a new AST.
5. Print the resulting AST.

Only step 4 gets faster when disabling plugins, so there's always a fixed cost
to running Babel regardless of how many transforms are enabled.

Sucrase bypasses most of these steps, and works like this:
1. Tokenize the input source code into a token stream using a trimmed-down fork
   of the Babel parser. This fork does not produce a full AST, but still
   produces meaningful token metadata specifically designed for the later
   transforms.
2. Scan through the tokens, computing preliminary information like all
   imported/exported names.
3. Run the transform by doing a pass through the tokens and performing a number
   of careful find-and-replace operations, like replacing `<Foo` with
   `React.createElement(Foo`.

Because Sucrase works on a lower level and uses a custom parser for its use
case, it is much faster than Babel.

## Contributing

Contributions are welcome, whether they be bug reports, PRs, docs, tests, or
anything else! Please take a look through the [Contributing Guide](./CONTRIBUTING.md)
to learn how to get started.

## License and attribution

Sucrase is MIT-licensed. A large part of Sucrase is based on a fork of the
[Babel parser](https://github.com/babel/babel/tree/master/packages/babel-parser),
which is also MIT-licensed.

## Why the name?

Sucrase is an enzyme that processes sugar. Get it?
