# 3.0.0 (2022-10-08)

* BREAKING: Switch `sucrase` to a peer dependency instead of a regular dependency.
  Please install `sucrase` separately as part of updating to this version. ([#756])
* BREAKING: Require `jest >= 27` and and `sucrase >= 3.25`. ([#749], [#756])
* BREAKING: Specify `disableESTransforms` by default, since it's no longer necessary
  for supported Node versions. ([#754])
* Add support for specifying Sucrase options in Jest config. ([#749]) (Jan Aagaard Meier; also implemented by  stagas in [#663])
* Add support for using Jest in ESM mode, automatically configuring Sucrase accordingly. ([#752])
* Fix unhelpful error messages when an error is thrown from Sucrase. ([#750])

# 2.2.1 (2022-04-28)

* Add support for Jest 28. ([#695]) (Viktor Luft)

# 2.2.0 (2021-10-24)

* Include inline source maps when transforming code. This fixes debugging in
  WebStorm. ([#661])

# 2.1.1 (2021-08-09)

* Add support for Jest 27. ([#640]) (Victor Pontis)

# 2.1.0 (2021-04-11)

* Enable Sucrase's new `jest` transform to hoist `jest.mock` calls.

# 2.0.0 (2018-06-10)

* Switch Sucrase dependency to `^3`, update code to use new return type.

[#640]: https://github.com/alangpierce/sucrase/pull/640
[#661]: https://github.com/alangpierce/sucrase/pull/661
[#663]: https://github.com/alangpierce/sucrase/pull/663
[#695]: https://github.com/alangpierce/sucrase/pull/695
[#749]: https://github.com/alangpierce/sucrase/pull/749
[#750]: https://github.com/alangpierce/sucrase/pull/750
[#752]: https://github.com/alangpierce/sucrase/pull/752
[#754]: https://github.com/alangpierce/sucrase/pull/754
[#756]: https://github.com/alangpierce/sucrase/pull/756
