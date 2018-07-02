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
