# 3.18.1 (2021-04-12)

* Fix regression causing incomplete nullish coalescing and optional chaining in
  some cases. ([#610])

# 3.18.0 (2021-04-11)

* Add `jest` transform analogous to `babel-plugin-jest-hoist`. ([#540]) (Patrik Oldsberg)
* When calling a `register` function or `addHook`, return a function that
  reverts the hook. ([#604]) (Anthony Fu)

# 3.17.1 (2021-01-31)

* Fix bug where TS method overloads in a class would cause later class fields to
  not be handled properly. ([#593])

# 3.17.0 (2020-12-29)

* Fix incorrect export removal when exporting a variable defined using a
  destructure declaration. ([#564])
* Add support for new type syntax in TypeScript 4.1: template interpolations in
  string literal types and `as` to remap keys in mapped types. Also add parsing
  for static blocks and pass them through in the output. ([#567])
* Allow passing `pirates` options `matcher` and `ignoreNodeModules` when
  directly calling `registerJS` and related functions. ([#571], [#573])
  (Gordon Leigh)
* Properly emit private class field declarations in the output code so that
  private  fields can be used when they're supported by the target JS engine.
  ([#574])
* Fix parse error when a method or field has the name `declare`. ([#575])

# 3.16.0 (2020-10-12)

* Add support for TypeScript 4.0 type syntax: labeled tuples, catch clause
  `unknown`. ([#556]) (Patrik Oldsberg)

# 3.15.0 (2020-05-18)

* Add support for `declare` class fields in TypeScript. ([#537])

# 3.14.1 (2020-05-17)

* Add support for `export type {T} from './T';` type-only export syntax. ([#533]) (Patrik Oldsberg)

# 3.14.0 (2020-05-10)

* Add support for TypeScript 3.8 type-only imports and exports. ([#523], [#532])
* Add a `--production` flag to the CLI. ([#529]) (Matthew Phillips)
* Fix crash when using `+` or `-` in constructor parameter defaults. ([#531])

# 3.13.0 (2020-03-28)

* Properly escape file paths in the react-hot-loader transform. ([#512]) (Jan Zípek)
* Fix nullish coalescing when the RHS is an object literal. ([#516])
* Support reading CLI configuration from tsconfig.json. ([#509], [#519]) (Jake Verbaten)

# 3.12.1 (2020-01-13)

* Fix crash when parsing `asserts b` TypeScript return signatures. ([#504])

# 3.12.0 (2020-01-01)

* Add support for TypeScript assertion signature syntax, other parser
  improvements. ([#485], [#487])
* Implement optional chaining and nullish coalescing.
  ([#488], [#490], [#492], [#496], [#497], [#498],
  [tech plan](https://github.com/alangpierce/sucrase/wiki/Sucrase-Optional-Chaining-and-Nullish-Coalescing-Technical-Plan))

# 3.11.0 (2019-12-22)

* Add runtime validation for options. ([#468])
* Allow `.tsx` and `.jsx` options when running `sucrase` from the command line. ([#448]) (Ricardo Tomasi, Alexander Mextner)
* Fix bug where generator markers in methods were removed. ([#463]) (Bjørn Tore Håvie)

# 3.10.1 (2019-03-31)

* Fix parsing of `a<b>c` in TypeScript. ([#438])
* Add support for new TypeScript 3.4 syntax, other parser improvements. ([#439], [#440])
* Elide TS `import =` statements that are only used as a type. ([#441])
* Properly handle async arrow functions with multiline type parameters. ([#443])

# 3.10.0 (2019-03-11)

* Fix bug where `/*/` was being parsed incorrectly. ([#430])
* Properly parse and compile JSX spread children. ([#431])
* Implement TypeScript export elision for exported types. ([#433])

# 3.9.6 (2019-03-01)

* Fix Flow bug where `implements` caused the class name to be incorrectly recognized. ([#409])
* Correctly handle `!:` in TS variable declarations. ([#410])
* Move more import code into helper functions in prep for some upcoming changes.
* Fix bug where some JSX component names were incorrectly turned into strings. ([#425]) (Yang Zhang)

# 3.9.5 (2019-01-13)

* Fix bug when processing a declaration that looks like an export assignment. ([#402])
* Fix TS import elision for JSX fragments and custom pragmas. ([#403])
* Treat reserved words as invalid identifiers when handling enums. ([#405])

# 3.9.4 (2019-01-07)

* Avoid false positive when detecting if a class has a superclass. ([#399])

# 3.9.3 (2019-01-06)

* Fix syntax error on arrow functions with multiline return types. ([#393])

# 3.9.2 (2019-01-02)

* Fix crash on optional arrow function params without type annotations. ([#389])
* Usability bug fixes for website. ([#390])

# 3.9.1 (2018-12-31)

* Fix react-hot-loader transform syntax error with some export styles. ([#384])
* Fix website to properly show react-hot-loader Babel transform output. ([#386])

# 3.9.0 (2018-12-30)

* Add a react-hot-loader transform. ([#376])
* Add support for dynamic `import()` syntax in TS types. ([#380])
* Many improvements to the website, including faster initial pageloads.
* Small performance improvements.

# 3.8.1 (2018-12-03)

* Fix infinite loop when a file ends with a short identifier ([#363])
* Small perf improvements.

# 3.8.0 (2018-11-25)

* Various simplifications in prep for compiling the project with AssemblyScript.
* Performance improvements, varying from 10% to 70% better performance depending
  on use case.
* Fix infinite loop in flow `declare module` parsing ([#359])

# 3.7.1 (2018-11-18)

* Fix crash on empty export expressions ([#338])
* Fix crash on TypeScript `declare global` ([#339])
* Fix crash when using overloaded constructors in TypeScript ([#340])
* Fix TypeScript import elision when imported names are shadowed by variables
  ([#342])
* Fix import name transform to work in code without semicolons ([#337])
  (Alec Larson)

# 3.7.0 (2018-11-11)

* Fix perf regression in TypeScript parsing ([#327])
* Fix broken line numbers in syntax errors, improve parser backtracking
  performance ([#331])
* Add Parser features and bugfixes from the Babel parser, including TypeScript
  3.0 support ([#333])

# 3.6.0 (2018-10-29)

* Add CLI support for jsx pragmas ([#321]) (Josiah Savary)
* Allow super.method() calls in constructor ([#324]) (Erik Arvidsson)

# 3.5.0 (2018-09-30)

* Change class field implementation to use initializer methods ([#313])
* Update TypeScript and Flow support to include new language features recently
  supported by Babel. ([#314], [#315], [#316])
* Properly handle function name inference in named exports ([#317])

# 3.4.2 (2018-08-27)

* Implement destructuring in export declarations ([#305])
* Properly handle function name inference in named exports ([#308])

# 3.4.1 (2018-07-06)

* Quote shorthand prop keys that contain a hyphen ([#292]) (Kevin Gao)
* Fix infinite loop on incomplete JSX. ([#296])

# 3.4.0 (2018-07-01)

* Add a sucrase-node CLI that wraps node. ([#288])
* Allow exported generator functions. ([#290])

# 3.3.0 (2018-06-28)

* Add a --out-extension option to the CLI. ([#282])
* Add a -q/--quiet option in the CLI and use it in the build script. ([#284])
* Don't emit semicolons in class bodies. ([#285])
* Fix ugly emitted comments when removing code between tokens. ([#286])

# 3.2.1 (2018-06-27)

* Allow TS type parameters on object member methods. ([#276])
* Simplify identity source map generator. ([#265])
* Fix crash on destructured params in arrow function types. ([#278])
* Remove @flow directives from comments when the flow transform is enabled.
  ([#279])

# 3.2.0 (2018-06-25)

* Fix crash when using JSX elements as props. ([#268]) (Erik Arvidsson)
* Fix incorrect compilation of TypeScript optional class properties with an
  initializer. ([#264])
* Fix crash on class fields that don't end in a semicolon. ([#271])
* Allow trailing commas after rest elements. ([#272])
* Don't crash on class bodies with an index signature. ([#273])
* Allow member expression identifiers when determining React displayName.
  ([#274])
* Add production option and use it for JSX. ([#270]) (Erik Arvidsson)
* Fix off-by-one error in parsing JSX fragments. ([#275])

# 3.1.0 (2018-06-18)

* Add basic support for source maps ([#257], [#261])

# 3.0.1 (2018-06-11)

* Fix crash in `getVersion`.

# 3.0.0 (2018-06-10)

### Breaking Changes

* `transform` now returns an object ([#244]). You now should write
  `transform(...).code` instead of just `transform(...)`. `code` is the only
  property for now, but this allows Sucrase to return source maps and possibly
  other values.
* The package's `dist` folder has been restructured, so direct internal module
  imports may break.

### Other changes

* Overhaul build system to use Sucrase for everything ([#243])
* Omit import helpers when unused ([#237]) (Alec Larson)
* Fix files accidentally included in final package ([#233])
* Various refactors and performance improvements.

# 2.2.0 (2018-05-19)

* Add support for JSX fragment syntax.
* Add support for custom JSX pragmas rather than defaulting to
  `React.createElement` and `React.Fragment`.

[#233]: https://github.com/alangpierce/sucrase/pull/233
[#237]: https://github.com/alangpierce/sucrase/pull/237
[#243]: https://github.com/alangpierce/sucrase/pull/243
[#244]: https://github.com/alangpierce/sucrase/pull/244
[#257]: https://github.com/alangpierce/sucrase/pull/257
[#261]: https://github.com/alangpierce/sucrase/pull/261
[#264]: https://github.com/alangpierce/sucrase/pull/264
[#265]: https://github.com/alangpierce/sucrase/pull/265
[#268]: https://github.com/alangpierce/sucrase/pull/268
[#270]: https://github.com/alangpierce/sucrase/pull/270
[#271]: https://github.com/alangpierce/sucrase/pull/271
[#272]: https://github.com/alangpierce/sucrase/pull/272
[#273]: https://github.com/alangpierce/sucrase/pull/273
[#274]: https://github.com/alangpierce/sucrase/pull/274
[#275]: https://github.com/alangpierce/sucrase/pull/275
[#276]: https://github.com/alangpierce/sucrase/pull/276
[#278]: https://github.com/alangpierce/sucrase/pull/278
[#279]: https://github.com/alangpierce/sucrase/pull/279
[#282]: https://github.com/alangpierce/sucrase/pull/282
[#284]: https://github.com/alangpierce/sucrase/pull/284
[#285]: https://github.com/alangpierce/sucrase/pull/285
[#286]: https://github.com/alangpierce/sucrase/pull/286
[#288]: https://github.com/alangpierce/sucrase/pull/288
[#290]: https://github.com/alangpierce/sucrase/pull/290
[#292]: https://github.com/alangpierce/sucrase/pull/292
[#296]: https://github.com/alangpierce/sucrase/pull/296
[#305]: https://github.com/alangpierce/sucrase/pull/305
[#308]: https://github.com/alangpierce/sucrase/pull/308
[#313]: https://github.com/alangpierce/sucrase/pull/313
[#314]: https://github.com/alangpierce/sucrase/pull/314
[#315]: https://github.com/alangpierce/sucrase/pull/315
[#316]: https://github.com/alangpierce/sucrase/pull/316
[#317]: https://github.com/alangpierce/sucrase/pull/317
[#321]: https://github.com/alangpierce/sucrase/pull/321
[#324]: https://github.com/alangpierce/sucrase/pull/324
[#327]: https://github.com/alangpierce/sucrase/pull/327
[#331]: https://github.com/alangpierce/sucrase/pull/331
[#333]: https://github.com/alangpierce/sucrase/pull/333
[#337]: https://github.com/alangpierce/sucrase/pull/337
[#338]: https://github.com/alangpierce/sucrase/pull/338
[#339]: https://github.com/alangpierce/sucrase/pull/339
[#340]: https://github.com/alangpierce/sucrase/pull/340
[#342]: https://github.com/alangpierce/sucrase/pull/342
[#359]: https://github.com/alangpierce/sucrase/pull/359
[#363]: https://github.com/alangpierce/sucrase/pull/363
[#376]: https://github.com/alangpierce/sucrase/pull/376
[#380]: https://github.com/alangpierce/sucrase/pull/380
[#384]: https://github.com/alangpierce/sucrase/pull/384
[#386]: https://github.com/alangpierce/sucrase/pull/386
[#389]: https://github.com/alangpierce/sucrase/pull/389
[#390]: https://github.com/alangpierce/sucrase/pull/390
[#393]: https://github.com/alangpierce/sucrase/pull/393
[#399]: https://github.com/alangpierce/sucrase/pull/399
[#402]: https://github.com/alangpierce/sucrase/pull/402
[#403]: https://github.com/alangpierce/sucrase/pull/403
[#405]: https://github.com/alangpierce/sucrase/pull/405
[#409]: https://github.com/alangpierce/sucrase/pull/409
[#410]: https://github.com/alangpierce/sucrase/pull/410
[#425]: https://github.com/alangpierce/sucrase/pull/425
[#430]: https://github.com/alangpierce/sucrase/pull/430
[#431]: https://github.com/alangpierce/sucrase/pull/431
[#433]: https://github.com/alangpierce/sucrase/pull/433
[#438]: https://github.com/alangpierce/sucrase/pull/438
[#439]: https://github.com/alangpierce/sucrase/pull/439
[#440]: https://github.com/alangpierce/sucrase/pull/440
[#441]: https://github.com/alangpierce/sucrase/pull/441
[#443]: https://github.com/alangpierce/sucrase/pull/443
[#448]: https://github.com/alangpierce/sucrase/pull/448
[#463]: https://github.com/alangpierce/sucrase/pull/463
[#468]: https://github.com/alangpierce/sucrase/pull/468
[#485]: https://github.com/alangpierce/sucrase/pull/485
[#487]: https://github.com/alangpierce/sucrase/pull/487
[#488]: https://github.com/alangpierce/sucrase/pull/488
[#490]: https://github.com/alangpierce/sucrase/pull/490
[#492]: https://github.com/alangpierce/sucrase/pull/492
[#496]: https://github.com/alangpierce/sucrase/pull/496
[#497]: https://github.com/alangpierce/sucrase/pull/497
[#498]: https://github.com/alangpierce/sucrase/pull/498
[#504]: https://github.com/alangpierce/sucrase/pull/504
[#509]: https://github.com/alangpierce/sucrase/pull/509
[#512]: https://github.com/alangpierce/sucrase/pull/512
[#516]: https://github.com/alangpierce/sucrase/pull/516
[#519]: https://github.com/alangpierce/sucrase/pull/519
[#523]: https://github.com/alangpierce/sucrase/pull/523
[#529]: https://github.com/alangpierce/sucrase/pull/529
[#531]: https://github.com/alangpierce/sucrase/pull/531
[#532]: https://github.com/alangpierce/sucrase/pull/532
[#533]: https://github.com/alangpierce/sucrase/pull/533
[#537]: https://github.com/alangpierce/sucrase/pull/537
[#556]: https://github.com/alangpierce/sucrase/pull/556
[#564]: https://github.com/alangpierce/sucrase/pull/564
[#567]: https://github.com/alangpierce/sucrase/pull/567
[#571]: https://github.com/alangpierce/sucrase/pull/571
[#573]: https://github.com/alangpierce/sucrase/pull/573
[#574]: https://github.com/alangpierce/sucrase/pull/574
[#575]: https://github.com/alangpierce/sucrase/pull/575
[#593]: https://github.com/alangpierce/sucrase/pull/593
[#540]: https://github.com/alangpierce/sucrase/pull/540
[#604]: https://github.com/alangpierce/sucrase/pull/604
[#610]: https://github.com/alangpierce/sucrase/pull/610
