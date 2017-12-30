# Sucrase

[![npm version](https://badge.fury.io/js/sucrase.svg)](https://www.npmjs.com/package/sucrase)
[![MIT License](https://img.shields.io/npm/l/express.svg?maxAge=2592000)](LICENSE)

### [Try it out](https://sucrase.io)

Sucrase is an alternative to Babel that allows super-fast development builds.
Instead of compiling a large range of JS features down to ES5, Sucrase assumes
that you're targeting a modern JS runtime and compiles non-standard language
extensions (JSX, TypeScript, and Flow) down to standard JavaScript. It also
compiles `import` to `require` in the same style as Babel. Because of this
smaller scope, Sucrase can get away with an architecture that is much more
performant, but requires more work to implement and maintain each transform.

**Current state:** The project is under development and you may see bugs if you
run it on a large codebase. You probably shouldn't use it in production, but you
may find it useful in development. Feel free to file issues!

Sucrase can convert the following codebases with all tests passing:
* Sucrase itself (5K lines of code, typescript).
* The [Benchling](https://benchling.com/) frontend codebase
  (500K lines of code, JSX, imports).
* [Babylon](https://github.com/babel/babel/tree/master/packages/babylon)
  (13K lines of code, flow, imports).

## Usage

Installation:

```
yarn add sucrase  # Or npm install sucrase
```

Run on a directory:

```
sucrase ./srcDir --transforms imports,flow -d ./outDir
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
const compiledCode = transform(code, {transforms: ["imports", "flow"]});
```

## Supported transforms

### jsx

Analogous to [babel-plugin-transform-react-jsx](https://babeljs.io/docs/plugins/transform-react-jsx/).

Converts JSX syntax to `React.createElement`, e.g. `<div a={b} />` becomes
`React.createElement('div', {a: b})`.

### typescript

Analogous to [babel-plugin-transform-typescript](https://github.com/babel/babel/tree/master/packages/babel-plugin-transform-typescript).

Compiles TypeScript code to JavaScript, removing type annotations and handling
features like class fields.

#### Limitations

* Does not handle enums yet.
* Does not handle static class fields yet.
* Does not remove type-only imports.
* Some syntax, like `declare`, is not yet supported.
* Only removes types; no type checking.

### flow

Analogous to [babel-plugin-transform-flow-strip-types](https://babeljs.io/docs/plugins/transform-flow-strip-types/).

Removes Flow types, e.g. `const f = (x: number): string => "hi";` to
`const f = (x) => "hi";`.

#### Limitations

* Some syntax, such as `declare`, has not been implemented yet.
* Only removes types; no type checking.

### react-display-name

Analogous to [babel-plugin-transform-react-display-name](https://babeljs.io/docs/plugins/transform-react-display-name/)

Detect and add display name to React component created using `React.createClass`
or `createReactClass`.

#### Limitations

* Does not use the filename as the display name when declaring a class in an
  `export default` position, since the Sucrase API currently does not accept the
  filename.

### imports

Analogous to [babel-plugin-transform-es2015-modules-commonjs](https://babeljs.io/docs/plugins/transform-es2015-modules-commonjs/)

Converts ES Modules (`import`/`export`) to CommonJS (`require`/`module.exports`)
using the same approach as Babel.

#### Limitations

* Assumes that there are no variables shadowing imported names. Any such
  variables will be incorrectly transformed. If you use ESLint, the
  [no-shadow](https://eslint.org/docs/rules/no-shadow) rule should avoid this
  issue.
* Complex assignments to exported names do not update the live bindings
  properly. For example, after `export let a = 1;`, `a = 2;` works, but
  `[a] = [3];` will not cause imported usages of `a` to update.
* The code for handling object shorthand does not take ASI into account, so
  there may be rare bugs if you omit semicolons.
* Imports are not hoisted to the top of the file.

### add-module-exports

Analogous to [babel-plugin-add-module-exports](https://github.com/59naga/babel-plugin-add-module-exports)

Add a snippet to emulate the Babel 5 approach to CommonJS interop: if a module
has only a default export, that default export is used as the module body, which
avoids the need for code like `require('./MyModule').default`.

## Motivation

As JavaScript implementations mature, it becomes more and more reasonable to
disable Babel transforms, especially in development when you know that you're
targeting a modern runtime. You might hope that you could simplify and speed up
the build step by eventually disabling Babel entirely, but this isn't possible
if you're using a non-standard language extension like JSX, Flow, or TypeScript.
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
1. Tokenize the input source code into a token stream using Babel's tokenizer.
2. Scan through the tokens, computing preliminary information like all
   imported/exported names and additional info on the role of each token.
3. Run the transform by doing a pass through the tokens and performing a number
   of careful find-and-replace operations, like replacing `<Foo` with
   `React.createElement(Foo`.

## Performance

Currently, Sucrase runs about 4-5x faster than Babel (even when Babel only runs
the relevant transforms). Here's the output of one run of `npm run benchmark`:

```
Simulating transpilation of 100,000 lines of code:
Sucrase: 2298.723ms
TypeScript: 3420.195ms
Babel: 9364.096ms
```

Previous iterations have been 15-20x faster, and hopefully additional
performance work will bring it back to that speed.

## Project vision and future work

### New features

* Improve correctness issues in the import transform, e.g. implement proper
  variable shadowing detection and automatic semicolon insertion.
* Test the Flow and TypeScript transforms more thoroughly and implement any
  remaining missing features.
* Emit proper source maps. (The line numbers already match up, but this would
  help with debuggers and other tools.)
* Explore the idea of extending this approach to other tools, e.g. module
  bundlers.

### Performance improvements

* Fork the Babylon lexer and simplify it to the essentials of what's needed
  for this project, with a focus on performance.
* Rewrite the code to be valid [AssemblyScript](https://github.com/AssemblyScript/assemblyscript),
  which will allow it to be compiled to wasm and hopefully improve performance
  even more.
* Explore the idea of a JIT to optimize the various token patterns that need to
  be matched as part of code transformation.
* Explore more optimizations, like reducing the number of passes.

### Correctness and stability

* Set up a test suite that runs the compiled code and ensures that it is
  correct.
* Set up Sucrase on a large collection of open source projects and work through
  any bugs discovered.
* Add integrity checks to compare intermediate Sucrase results (like tokens and
  the role of each identifier and pair of curly braces) with the equivalent
  information from Babel.

## Why the name?

Sucrase is an enzyme that processes sugar. Get it?
