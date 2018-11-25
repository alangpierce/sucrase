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
