# Project Vision

This is a collection of little essays that help solidify and communicate what
this project is all about. Ultimately, every project needs to say "no" to some
features, and keeping a small scope is particularly important for Sucrase. My
hope is that these notes help guide and clarify those sorts of decisions.

All of these are open to discussion! It's written in first person for now, but
it may later make sense to make the phrasing more general.

## Sucrase exists to make programming more fun

This is probably true of most tools, but I want to call it out explicitly: I
started Sucrase because it seemed like there was an opportunity for me to be
happier when programming. I was running into some specific problems that I felt
could be improved:
* Build times can be slow, and in many (but not all) scenarios, Babel and tsc
  are a big part of that.
* Slow build times mean that we use caches, and caches can be fragile. It's
  frustrating to realize that a problem might be caused by bad cache, and to
  make things worse, checking if that was the problem requires doing a slow
  clean build.
* Slow build times means slow iteration times, especially when running tests. A
  great programming experience is one where you feel free to tinker with any
  part of the code to see what happens.

Programming is fun when tools get out of the way. They should be fast, they
should be reliable, and they should be simple (e.g. no configuration needed). I
want all tools to be like that, and hopefully Sucrase is a step in that
direction.

## Sucrase is an experiment

The secondary reason I started Sucrase was to learn and to try new things. I had
an idea on how to improve build times, but I *didn't know* if it was going to
work, and I still don't know the best way to implement it. Sucrase's development
ideally should consist largely of trying new ideas and keeping the ones that
work well.

For example, WebAssembly support is an important future goal of Sucrase, and it
may involve reworking a fair amount of code just to try it out, and it may end
up as a failed experiment, which is ok. There may also be breaking changes in
Sucrase (which will be properly released as semver-major updates). At least for
now, there needs to be some flexibility to play around with ideas without
worrying about staying backcompat forever.

## Sucrase is not meant to replace Babel

A worry of mine in releasing Sucrase is that it might someday become popular
enough to detract from the great efforts that have been put into Babel. Babel
isn't just a build tool, it's a mechanism for language exploration and
prototyping, and it enables new programming possibilities. Sucrase takes the
best of those and rewrites them to be fast, but Sucrase isn't a great mechanism
for exploration and will never reach as far forward in syntax or as far backward
in compatibility as Babel does.

## Sucrase should push tooling forward

Sucrase won't support Node 6 or Internet Explorer, and only reluctantly supports
CommonJS and legacy TypeScript and Babel 5 module interop (and may drop support
in the future). In various other build system decisions, there's often "the old
way of doing things" and "the modern way of doing things", and Sucrase prefers
to only support the modern way. This lets Sucrase stay simple and helps motivate
people to modernize their build system and codebase. The longer we hold onto old
technologies, the more intimidating it will be for people trying to learn and
understand the JS ecosystem, so Sucrase tries to push for consistency and
simplicity.

## Sucrase is small, and thus is allowed to be complicated

Large software systems can stay maintainable by using well-chosen abstractions
and code organization, sometimes at the expense of performance. Sucrase takes a
different approach: it biases toward performance (even if it makes the code
harder to work with) and stays maintainable by keeping the scope small.

As one example, the Babel parser does a significant amount of work validating
the input code and building an AST, and Sucrase intentionally skips all
validation and AST generation, which reduces the parser code by about 50%. As
another example, Sucrase code transformations are not composable and
independent, and plugins are not supported, since the flexibility of such a
system would ultimately come at the expense of performance.

## Sucrase favors pragmatism over strict spec compliance

The JS language has various obscure edge cases that make implementation more
difficult, and in some cases, Sucrase may decide to go against the spec because
the issue is so obscure. For example, variable names are allowed to have unicode
escapes in them, so `const \u0061 = 1; console.log(a);` prints 1. Other details
may require significant extra information from the parser, slowing down even the
common case. Sucrase's goal is to work on all realistic code, and it goes to
great effort to ensure that, but some code is so unrealistic that it's not worth
supporting.

In unsupported cases, ideally Sucrase will either give an error or provide an
ESLint rule that detects and warns against the case.
