# Sucrase

[![Build Status](https://travis-ci.org/alangpierce/sucrase.svg?branch=master)](https://travis-ci.org/alangpierce/sucrase)
[![npm version](https://badge.fury.io/js/sucrase.svg)](https://www.npmjs.com/package/sucrase)
[![MIT License](https://img.shields.io/npm/l/express.svg?maxAge=2592000)](LICENSE)


### [Try it out](https://sucrase.io)

Sucrase is an alternative to Babel that allows super-fast development builds.
Instead of compiling a large range of JS features down to ES5, Sucrase assumes
that you're targeting a modern JS runtime (e.g. Node.js 8 or latest Chrome) and
focuses on compiling non-standard language extensions: JSX, TypeScript, and
Flow. Because of this smaller scope, Sucrase can get away with an architecture
that is much more performant but less extensible and maintainable.

**Current state:** The project is in active development. It is about 13x faster
than Babel and about 5x faster than TypeScript, and it has been tested on
hundreds of thousands of lines of code. You may still find bugs when running on
your code, though. You probably shouldn't use it in production, but you may find
it useful in development. Feel free to file issues!

Sucrase can convert the following codebases with all tests passing:
* Sucrase itself (6K lines of code excluding Babylon fork, typescript, imports).
* The [Benchling](https://benchling.com/) frontend codebase
  (500K lines of code, JSX, imports).
* [Babel](https://github.com/babel/babel) (63K lines of code, flow, imports).
* [TSLint](https://github.com/palantir/tslint) (20K lines of code, typescript,
  imports).
* [Apollo client](https://github.com/apollographql/apollo-client) (34K lines of
  code, typescript, imports)
* [decaffeinate](https://github.com/decaffeinate/decaffeinate) and its
  sub-projects [decaffeinate-parser](https://github.com/decaffeinate/decaffeinate-parser)
  and [coffee-lex](https://github.com/decaffeinate/coffee-lex)
  (38K lines of code, typescript, imports).

## Transforms

The main configuration option in Sucrase is an array of transform names. There
are four main transforms that you may want to enable:
* **jsx**: Converts JSX syntax to `React.createElement`, e.g. `<div a={b} />`
  becomes `React.createElement('div', {a: b})`.
* **typescript**: Compiles TypeScript code to JavaScript, removing type
  annotations and handling features like enums. Does not check types.
* **flow**:  Removes Flow types, e.g. `const f = (x: number): string => "hi";`
  to `const f = (x) => "hi";`. Does not check types.
* **imports**: Converts ES Modules (`import`/`export`) to CommonJS
  (`require`/`module.exports`) using the same approach as Babel. With the
  `typescript` transform enabled, the import conversion uses the behavior of the
  TypeScript compiler (which is slightly more lenient). Also includes dynamic
  `import`.

The following proposed JS features are built-in and always transformed:
* [Class fields](https://github.com/tc39/proposal-class-fields): `class C { x = 1; }`.
  This includes static fields but not the `#x` private field syntax.
* [Export namespace syntax](https://github.com/tc39/proposal-export-ns-from):
  `export * as a from 'a';`
* [Numeric separators](https://github.com/tc39/proposal-numeric-separator):
  `const n = 1_234;`
* [Optional catch binding](https://github.com/tc39/proposal-optional-catch-binding):
  `try { doThing(); } catch { }`.

There are some additional opt-in transforms that are useful in legacy situations:
* **react-display-name**: Detect and add display name to React components created
  using `React.createClass` or `createReactClass`.
* **add-module-exports**: Mimic the Babel 5 approach to CommonJS interop, so that
  you can run `require('./MyModule')` instead of `require('./MyModule').default`.
  Analogous to
  [babel-plugin-add-module-exports](https://github.com/59naga/babel-plugin-add-module-exports).

## Usage

Installation:

```
yarn add --dev sucrase  # Or npm install --save-dev sucrase
```

Run on a directory:

```
sucrase ./srcDir -d ./outDir --transforms typescript,imports
```

Register a require hook with some [reasonable defaults](src/register.ts):

```js
// Register just one extension.
import "sucrase/register/ts";
// Or register all at once.
import "sucrase/register";
```

Call from JS directly:

```js
import {transform} from "sucrase";
const compiledCode = transform(code, {transforms: ["typescript", "imports"]});
```

There are also integrations for
[Webpack](https://github.com/alangpierce/sucrase/tree/master/integrations/webpack-loader),
[Gulp](https://github.com/alangpierce/sucrase/tree/master/integrations/gulp-plugin),
and [Jest](https://github.com/alangpierce/sucrase/tree/master/integrations/jest-plugin).

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

## Performance

Currently, Sucrase runs about 13x faster than Babel (even when Babel only runs
the relevant transforms) and 5x faster than TypeScript. Here's the output of
one run of `npm run benchmark`:

```
Simulating transpilation of 100,000 lines of code:
Sucrase: 777.638ms
TypeScript: 3820.914ms
Babel: 10041.368ms
```

## Project vision and future work

### Performance improvements

* Rewrite the code to run in WebAssembly, either by changing it to be valid
  [AssemblyScript](https://github.com/AssemblyScript/assemblyscript) or by
  rewriting it in Rust.
* Explore the idea of a JIT to optimize the various token patterns that need to
  be matched as part of code transformation.

### New features

* Implement more integrations, like for Webpack and Rollup.
* Emit proper source maps. (The line numbers already match up, but this would
  help with debuggers and other tools.)
* Rethink configuration and try to simplify it as much as possible, and allow
  loading Babel/TypeScript configurations.
* Explore the idea of a tool that patches a Babel/TypeScript installation to
  use Sucrase instead, to make it even easier to try Sucrase on an existing
  codebase.
* Explore the idea of extending this approach to other tools, e.g. module
  bundlers.

### Correctness and stability

* Add more open source projects to the suite of projects that are tested
  automatically.
* Set up a test suite that runs the compiled code and ensures that it is
  correct.
* Add integrity checks to compare intermediate Sucrase results (like tokens and
  the role of each identifier and pair of curly braces) with the equivalent
  information from Babel.
* Fix some known correctness loose ends, like import hoisting, export assignment
  detection for complex assignments, and fully replicating the small differences
  between Babel and the TypeScript compiler.

## License and attribution

Sucrase is MIT-licensed. A large part of Sucrase is based on a fork of
[Babylon](https://github.com/babel/babel/tree/master/packages/babylon), which is
also MIT-licensed.

## Why the name?

Sucrase is an enzyme that processes sugar. Get it?
