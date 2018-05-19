import {JSX_PREFIX} from "./prefixes";
import * as util from "./util";

const {devProps} = util;

function assertResult(code: string, expectedResult: string): void {
  util.assertResult(code, expectedResult, {transforms: ["jsx"]});
  util.assertResult(code, expectedResult, {transforms: ["jsx", "flow"]});
}

describe("transform JSX", () => {
  it("transforms a self-closing JSX element", () => {
    assertResult(
      `
      <Foo />
    `,
      `${JSX_PREFIX}
      React.createElement(Foo, {${devProps(2)}} )
    `,
    );
  });

  it("transforms nested JSX elements", () => {
    assertResult(
      `
      <div><span></span></div>
    `,
      `${JSX_PREFIX}
      React.createElement('div', {${devProps(2)}}, React.createElement('span', {${devProps(2)}}))
    `,
    );
  });

  it("transforms interpolated children", () => {
    assertResult(
      `
      <div>{x}</div>
    `,
      `${JSX_PREFIX}
      React.createElement('div', {${devProps(2)}}, x)
    `,
    );
  });

  it("handles string property values", () => {
    assertResult(
      `
      <A foo='bar' />
    `,
      `${JSX_PREFIX}
      React.createElement(A, { foo: "bar", ${devProps(2)}} )
    `,
    );
  });

  it("handles inline comments", () => {
    assertResult(
      `
      <A
        b='c' // A comment
        d='e' /* Another comment */
      />
    `,
      `${JSX_PREFIX}
      React.createElement(A, {
        b: "c", // A comment
        d: "e", ${devProps(2)}} /* Another comment */
      )
    `,
    );
  });

  it("handles multiline strings", () => {
    assertResult(
      `
      const x = (
        <div>
          foo  bar
          baz
        </div>
      );
    `,
      `${JSX_PREFIX}
      const x = (
        React.createElement('div', {${devProps(3)}}, "foo  bar baz"


        )
      );
    `,
    );
  });

  it("handles nested JSX tags", () => {
    assertResult(
      `
      const x = (
        <div>
          <Span />
        </div>
      );
    `,
      `${JSX_PREFIX}
      const x = (
        React.createElement('div', {${devProps(3)}}
          , React.createElement(Span, {${devProps(4)}} )
        )
      );
    `,
    );
  });

  it("handles complex lower-case tag values", () => {
    assertResult(
      `
      <a.b c='d' />
    `,
      `${JSX_PREFIX}
      React.createElement(a.b, { c: "d", ${devProps(2)}} )
    `,
    );
  });

  it("handles prop spread operators", () => {
    assertResult(
      `
      <a {...b} c='d' />
    `,
      `${JSX_PREFIX}
      React.createElement('a', { ...b, c: "d", ${devProps(2)}} )
    `,
    );
  });

  it("handles HTML entities", () => {
    assertResult(
      `
      <span>a&gt;b</span>
    `,
      `${JSX_PREFIX}
      React.createElement('span', {${devProps(2)}}, "a>b")
    `,
    );
  });

  it("handles non-breaking spaces in JSX text", () => {
    /* eslint-disable no-irregular-whitespace */
    assertResult(
      `
      <span>
        a&nbsp;
      </span>
    `,
      `${JSX_PREFIX}
      React.createElement('span', {${devProps(2)}}, "a "

      )
    `,
    );
    /* eslint-enable no-irregular-whitespace */
  });

  it("handles comment-only JSX interpolations", () => {
    assertResult(
      `
      <div>
        <span />
        { /* foo */ }
        <span />
      </div>;
    `,
      `${JSX_PREFIX}
      React.createElement('div', {${devProps(2)}}
        , React.createElement('span', {${devProps(3)}} )
         /* foo */ 
        , React.createElement('span', {${devProps(5)}} )
      );
    `,
    );
  });

  it("handles parsing object rest/spread", () => {
    assertResult(
      `
      const foo = {
        ...bar,
        baz: <Baz />,
      };
    `,
      `${JSX_PREFIX}
      const foo = {
        ...bar,
        baz: React.createElement(Baz, {${devProps(4)}} ),
      };
    `,
    );
  });

  it("handles non-identifier prop names", () => {
    assertResult(
      `
      <div
        a={1}
        data-id={2}
      />
    `,
      `${JSX_PREFIX}
      React.createElement('div', {
        a: 1,
        'data-id': 2, ${devProps(2)}}
      )
    `,
    );
  });

  it("handles multi-line prop strings", () => {
    assertResult(
      `
      <div
        value='This is a
               multi-line string.'
      />
    `,
      `${JSX_PREFIX}
      React.createElement('div', {
        value: "This is a multi-line string."
                , ${devProps(2)}}
      )
    `,
    );
  });

  it("handles leading and trailing spaces in multi-line prop strings", () => {
    assertResult(
      `
      <div
        value='   
               This is a longer
               multi-line string.
                  '
      />
    `,
      `${JSX_PREFIX}
      React.createElement('div', {
        value: "    This is a longer multi-line string. "


                  , ${devProps(2)}}
      )
    `,
    );
  });

  it("handles prop string values with entities", () => {
    assertResult(
      `
      <div
        value='a&gt;b'
      />
    `,
      `${JSX_PREFIX}
      React.createElement('div', {
        value: "a>b", ${devProps(2)}}
      )
    `,
    );
  });

  it("handles handles boolean prop values", () => {
    assertResult(
      `
      const e = <div a />;
    `,
      `${JSX_PREFIX}
      const e = React.createElement('div', { a: true, ${devProps(2)}} );
    `,
    );
  });

  it("preserves/allows windows newlines in string literals but not tag bodies", () => {
    assertResult(
      `
      const e = <div a="foo\r\nbar">a\r\nb</div>;
    `,
      `${JSX_PREFIX}
      const e = React.createElement('div', { a: "foo\\r\\nbar"
, __self: this, __source: {fileName: _jsxFileName, lineNumber: 2}}, "a b"
);
    `,
    );
  });

  it("allows JSX fragment syntax", () => {
    assertResult(
      `
      const f = (
        <>
          <div />
          <span />
        </>
      );
    `,
      `${JSX_PREFIX}
      const f = (
        React.createElement(React.Fragment, null, 
          , React.createElement('div', {${devProps(4)}} )
          , React.createElement('span', {${devProps(5)}} )
        )
      );
    `,
    );
  });
});
