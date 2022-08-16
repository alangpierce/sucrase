import {throws} from "assert";

import {transform, Options} from "../src";
import {IMPORT_DEFAULT_PREFIX, JSX_PREFIX} from "./prefixes";
import * as util from "./util";

const {devProps} = util;

interface JSXExpectations {
  expectedClassicDevESMResult?: string;
  expectedClassicProdESMResult?: string;
  expectedClassicDevCJSResult?: string;
  expectedClassicProdCJSResult?: string;
}

const optionsForMode: {[k in keyof JSXExpectations]-?: Options} = {
  expectedClassicDevESMResult: {transforms: ["jsx"], production: false},
  expectedClassicProdESMResult: {transforms: ["jsx"], production: true},
  expectedClassicDevCJSResult: {transforms: ["jsx", "imports"], production: false},
  expectedClassicProdCJSResult: {transforms: ["jsx", "imports"], production: true},
};

function assertJSXResult(
  code: string,
  jsxExpectations: JSXExpectations,
  options: Partial<Options> = {},
): void {
  for (const [expectationName, expectedResult] of Object.entries(jsxExpectations)) {
    util.assertResult(
      code,
      expectedResult,
      {...optionsForMode[expectationName as keyof JSXExpectations], ...options},
      `${expectationName} did not match`,
    );
  }
}

describe("transform JSX", () => {
  it("transforms a self-closing JSX element", () => {
    assertJSXResult(
      `
      <Foo />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement(Foo, {${devProps(2)}} )
    `,
        expectedClassicProdESMResult: `
      React.createElement(Foo, null )
    `,
      },
    );
  });

  it("handles a JSX element with a key, multiple props, and multiple children", () => {
    assertJSXResult(
      `
      <div a="foo" key="some-key" c="test">
        Hello world
        <span className="some-class">!</span>
      </div>
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('div', { a: "foo", key: "some-key", c: "test", ${devProps(
        2,
      )}}, "Hello world"

        , React.createElement('span', { className: "some-class", ${devProps(4)}}, "!")
      )
    `,
        expectedClassicProdESMResult: `
      React.createElement('div', { a: "foo", key: "some-key", c: "test",}, "Hello world"

        , React.createElement('span', { className: "some-class",}, "!")
      )
    `,
      },
    );
  });

  it("handles more esoteric component names", () => {
    assertJSXResult(
      `
      <_Foo />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement(_Foo, {${devProps(2)}} )
    `,
      },
    );
    assertJSXResult(
      `
      <$ />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement($, {${devProps(2)}} )
    `,
      },
    );
    assertJSXResult(
      `
      <é />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement(é, {${devProps(2)}} )
    `,
      },
    );
  });

  it("transforms nested JSX elements", () => {
    assertJSXResult(
      `
      <div><span></span></div>
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('div', {${devProps(2)}}, React.createElement('span', {${devProps(2)}}))
    `,
      },
    );
  });

  it("transforms interpolated children", () => {
    assertJSXResult(
      `
      <div>{x}</div>
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('div', {${devProps(2)}}, x)
    `,
      },
    );
  });

  it("handles string property values", () => {
    assertJSXResult(
      `
      <A foo='bar' />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement(A, { foo: "bar", ${devProps(2)}} )
    `,
      },
    );
  });

  it("handles element property values", () => {
    assertJSXResult(
      `
      <A foo=<B /> />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement(A, { foo: React.createElement(B, {${devProps(2)}} ), ${devProps(2)}} )
    `,
      },
    );
  });

  it("handles fragment property values", () => {
    assertJSXResult(
      `
      <A foo=<>Hi</> />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement(A, { foo: React.createElement(React.Fragment, null, "Hi"), ${devProps(
        2,
      )}} )
    `,
      },
    );
  });

  it("handles property keys that require quoting", () => {
    assertJSXResult(
      `
      <A foo-bar={true} />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement(A, { 'foo-bar': true, ${devProps(2)}} )
    `,
      },
    );
  });

  it("handles shorthand property keys that require quoting", () => {
    assertJSXResult(
      `
      <A foo-bar />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement(A, { 'foo-bar': true, ${devProps(2)}} )
    `,
      },
    );
  });

  it("handles inline comments", () => {
    assertJSXResult(
      `
      <A
        b='c' // A comment
        d='e' /* Another comment */
      />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement(A, {
        b: "c", // A comment
        d: "e", ${devProps(2)}} /* Another comment */
      )
    `,
      },
    );
  });

  it("handles multiline strings", () => {
    assertJSXResult(
      `
      const x = (
        <div>
          foo  bar
          baz
        </div>
      );
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      const x = (
        React.createElement('div', {${devProps(3)}}, "foo  bar baz"


        )
      );
    `,
      },
    );
  });

  it("handles nested JSX tags", () => {
    assertJSXResult(
      `
      const x = (
        <div>
          <Span />
        </div>
      );
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      const x = (
        React.createElement('div', {${devProps(3)}}
          , React.createElement(Span, {${devProps(4)}} )
        )
      );
    `,
      },
    );
  });

  it("handles complex lower-case tag values", () => {
    assertJSXResult(
      `
      <a.b c='d' />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement(a.b, { c: "d", ${devProps(2)}} )
    `,
      },
    );
  });

  it("handles prop spread operators", () => {
    assertJSXResult(
      `
      <a {...b} c='d' />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('a', { ...b, c: "d", ${devProps(2)}} )
    `,
        expectedClassicProdESMResult: `
      React.createElement('a', { ...b, c: "d",} )
    `,
      },
    );
  });

  it("handles HTML entities", () => {
    assertJSXResult(
      `
      <span>a&gt;b</span>
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('span', {${devProps(2)}}, "a>b")
    `,
      },
    );
  });

  it("handles hex unicode HTML entities", () => {
    assertJSXResult(
      `
      <span>a&#x3E;b</span>
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('span', {${devProps(2)}}, "a>b")
    `,
      },
    );
  });

  it("handles decimal unicode HTML entities", () => {
    assertJSXResult(
      `
      <span>a&#62;b</span>
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('span', {${devProps(2)}}, "a>b")
    `,
      },
    );
  });

  it("does not transform empty number HTML entities", () => {
    assertJSXResult(
      `
      <span>a&#;b</span>
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('span', {${devProps(2)}}, "a&#;b")
    `,
      },
    );
  });

  it("allows adjacent HTML entities", () => {
    assertJSXResult(
      `
      <span>a&#100;&#100;b</span>
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('span', {${devProps(2)}}, "addb")
    `,
      },
    );
  });

  it("allows HTML entity right after near-entity with semicolon missing", () => {
    assertJSXResult(
      `
      <span>a&#100&#100;b</span>
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('span', {${devProps(2)}}, "a&#100db")
    `,
      },
    );
  });

  it("handles ampersand in HTML", () => {
    assertJSXResult(
      `
      <span>Rock & Roll</span>
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('span', {${devProps(2)}}, "Rock & Roll"  )
    `,
      },
    );
  });

  it("handles non-breaking spaces in JSX text", () => {
    /* eslint-disable no-irregular-whitespace */
    assertJSXResult(
      `
      <span>
        a&nbsp;
      </span>
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('span', {${devProps(2)}}, "a "

      )
    `,
      },
    );
    /* eslint-enable no-irregular-whitespace */
  });

  it("handles comment-only JSX interpolations", () => {
    assertJSXResult(
      `
      <div>
        <span />
        { /* foo */ }
        <span />
      </div>;
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('div', {${devProps(2)}}
        , React.createElement('span', {${devProps(3)}} )
         /* foo */ 
        , React.createElement('span', {${devProps(5)}} )
      );
    `,
      },
    );
  });

  it("handles parsing object rest/spread", () => {
    assertJSXResult(
      `
      const foo = {
        ...bar,
        baz: <Baz />,
      };
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      const foo = {
        ...bar,
        baz: React.createElement(Baz, {${devProps(4)}} ),
      };
    `,
      },
    );
  });

  it("handles non-identifier prop names", () => {
    assertJSXResult(
      `
      <div
        a={1}
        data-id={2}
      />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('div', {
        a: 1,
        'data-id': 2, ${devProps(2)}}
      )
    `,
      },
    );
  });

  it("handles multi-line prop strings", () => {
    assertJSXResult(
      `
      <div
        value='This is a
               multi-line string.'
      />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('div', {
        value: "This is a multi-line string."
                , ${devProps(2)}}
      )
    `,
      },
    );
  });

  it("handles leading and trailing spaces in multi-line prop strings", () => {
    assertJSXResult(
      `
      <div
        value='   
               This is a longer
               multi-line string.
                  '
      />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('div', {
        value: "    This is a longer multi-line string. "


                  , ${devProps(2)}}
      )
    `,
      },
    );
  });

  it("handles prop string values with entities", () => {
    assertJSXResult(
      `
      <div
        value='a&gt;b'
      />
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('div', {
        value: "a>b", ${devProps(2)}}
      )
    `,
      },
    );
  });

  it("handles handles boolean prop values", () => {
    assertJSXResult(
      `
      const e = <div a />;
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      const e = React.createElement('div', { a: true, ${devProps(2)}} );
    `,
        expectedClassicProdESMResult: `
      const e = React.createElement('div', { a: true,} );
    `,
      },
    );
  });

  it("preserves/allows windows newlines in string literals but not tag bodies", () => {
    assertJSXResult(
      `
      const e = <div a="foo\r\nbar">a\r\nb</div>;
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      const e = React.createElement('div', { a: "foo\\r\\nbar"
, __self: this, __source: {fileName: _jsxFileName, lineNumber: 2}}, "a b"
);
    `,
      },
    );
  });

  it("allows JSX fragment syntax", () => {
    assertJSXResult(
      `
      const f = (
        <>
          <div />
          <span />
        </>
      );
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      const f = (
        React.createElement(React.Fragment, null
          , React.createElement('div', {${devProps(4)}} )
          , React.createElement('span', {${devProps(5)}} )
        )
      );
    `,
        expectedClassicProdESMResult: `
      const f = (
        React.createElement(React.Fragment, null
          , React.createElement('div', null )
          , React.createElement('span', null )
        )
      );
    `,
      },
    );
  });

  it("handles transformed react name in createElement and Fragment", () => {
    assertJSXResult(
      `
      import React from 'react';
      const f = (
        <>
          <div />
          <span />
        </>
      );
    `,
      {
        expectedClassicDevCJSResult: `"use strict";${JSX_PREFIX}${IMPORT_DEFAULT_PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);
      const f = (
        _react2.default.createElement(_react2.default.Fragment, null
          , _react2.default.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 5}} )
          , _react2.default.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6}} )
        )
      );
    `,
      },
    );
  });

  it("allows custom JSX pragmas for classic transform", () => {
    assertJSXResult(
      `
      const f = (
        <>
          <div />
          <span />
        </>
      );
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      const f = (
        h(Fragment, null
          , h('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 4}} )
          , h('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 5}} )
        )
      );
    `,
      },
      {jsxPragma: "h", jsxFragmentPragma: "Fragment"},
    );
  });

  it("properly transforms imports for JSX pragmas in the classic transform", () => {
    assertJSXResult(
      `
      import {h, Fragment} from 'preact';
      const f = (
        <>
          <div />
          <span />
        </>
      );
    `,
      {
        expectedClassicDevCJSResult: `"use strict";${JSX_PREFIX}
      var _preact = require('preact');
      const f = (
        _preact.h(_preact.Fragment, null
          , _preact.h('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 5}} )
          , _preact.h('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6}} )
        )
      );
    `,
      },
      {jsxPragma: "h", jsxFragmentPragma: "Fragment"},
    );
  });

  it("allows empty fragments", () => {
    assertJSXResult(
      `
      const c = <></>;
    `,
      {
        expectedClassicDevESMResult: `
      const c = React.createElement(React.Fragment, null);
    `,
      },
    );
  });

  it("allows fragments without whitespace", () => {
    assertJSXResult(
      `
      const c = <><a/></>;
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      const c = React.createElement(React.Fragment, null, React.createElement('a', {${devProps(
        2,
      )}}));
    `,
      },
    );
  });

  it("does not infinite loop on incomplete JSX", () => {
    throws(() => transform("const x = <", {transforms: ["jsx"]}));
  });

  it("handles spread children", () => {
    assertJSXResult(
      `
      const e = <A>{...b}</A>;
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      const e = React.createElement(A, {${devProps(2)}}, ...b);
    `,
      },
    );
  });

  it("handles long HTML entities with many leading 0s", () => {
    // https://github.com/babel/babel/issues/14316
    assertJSXResult(
      `
      <div> &#00000000000000000020; </div>
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('div', {${devProps(2)}}, " \\u0014 "  )
    `,
      },
    );
  });

  it("does not allow prototype access in JSX entity handling", () => {
    assertJSXResult(
      `
      <a>&valueOf;</a>
    `,
      {
        expectedClassicDevESMResult: `${JSX_PREFIX}
      React.createElement('a', {${devProps(2)}}, "&valueOf;")
    `,
      },
    );
  });
});
