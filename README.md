# Sucrase

Sucrase is an alternative to Babel that allows super-fast development builds.
Instead of compiling a large range of JS features down to ES5, Sucrase assumes
that you're targeting a modern JS runtime and compiles non-standard language
extensions (currently JSX, later Flow and TypeScript) down to standard
JavaScript. Because of this smaller scope, Sucrase can get away with an
architecture that is much more performant, but requires more work to implement
and maintain each transform.

**Current state:** Very early/experimental, but it seems to work!

## Usage

Currently Sucrase only implements the JSX to `React.createElement` transform and
can only be used as a library. You can use it like this:

```
yarn add sucrase  # Or npm install sucrase
```

```js
import {transform} from 'sucrase';
const codeWithoutJSX = transform(codeWithJSX);
```

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
2. Run the transform by doing a pass through the tokens and performing a number
   of careful find-and-replace operations, like replacing `<Foo` with
   `React.createElement(Foo`.

## Performance

Currently, Sucrase runs about 10x faster than Babel. Here's the output of one
run of `npm run benchmark`:

```
Simulating transpilation of 100,000 lines of code:
Sucrase: 980.442ms
Buble: 2320.480ms
TypeScript: 2443.063ms
Babel: 9682.259ms
```

When using a forked version of Babylon that avoids unused parsing work, the
Sucrase running time drops to around 650ms.

## Project vision and future work

* Add support for `import`/`export` syntax, converting to CommonJS in the same
  way as Babel.
* Add TypeScript support. One challenge here is implementing enums, but a first
  pass may be to fall back to TypeScript/Babel if there are any unsupported
  features.
* Add Flow support.
* Fork the Babylon lexer and simplify it to the essentials of what's needed
  for this project, with a focus on performance.
* Rewrite the code to be valid [AssemblyScript](https://github.com/AssemblyScript/assemblyscript),
  which will allow it to be compiled to wasm and hopefully improve performance
  even more.
* Explore the idea of doing transforms as a single pass through the source code
  without separate tokenize and transform steps.

## Why the name?

Sucrase is an enzyme that processes sugar. Get it?
