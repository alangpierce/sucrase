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
