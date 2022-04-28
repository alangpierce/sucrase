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
[#695]: https://github.com/alangpierce/sucrase/pull/695
