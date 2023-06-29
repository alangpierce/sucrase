import {throws} from "assert";

import {transform, type Options} from "../src";
import {IMPORT_DEFAULT_PREFIX, JSX_PREFIX} from "./prefixes";
import * as util from "./util";
import {assertResult, jsxDevArgs} from "./util";

const {devProps} = util;

interface JSXExpectations {
  expectedClassicDevESMResult?: string;
  expectedClassicProdESMResult?: string;
  expectedClassicDevCJSResult?: string;
  expectedClassicProdCJSResult?: string;
  expectedAutomaticDevESMResult?: string;
  expectedAutomaticProdESMResult?: string;
  expectedAutomaticDevCJSResult?: string;
  expectedAutomaticProdCJSResult?: string;
}

const optionsForMode: {[k in keyof JSXExpectations]-?: Options} = {
  expectedClassicDevESMResult: {transforms: ["jsx"], jsxRuntime: "classic", production: false},
  expectedClassicProdESMResult: {transforms: ["jsx"], jsxRuntime: "classic", production: true},
  expectedClassicDevCJSResult: {
    transforms: ["jsx", "imports"],
    jsxRuntime: "classic",
    production: false,
  },
  expectedClassicProdCJSResult: {
    transforms: ["jsx", "imports"],
    jsxRuntime: "classic",
    production: true,
  },
  expectedAutomaticDevESMResult: {transforms: ["jsx"], jsxRuntime: "automatic", production: false},
  expectedAutomaticProdESMResult: {transforms: ["jsx"], jsxRuntime: "automatic", production: true},
  expectedAutomaticDevCJSResult: {
    transforms: ["jsx", "imports"],
    jsxRuntime: "automatic",
    production: false,
  },
  expectedAutomaticProdCJSResult: {
    transforms: ["jsx", "imports"],
    jsxRuntime: "automatic",
    production: true,
  },
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
        expectedAutomaticDevESMResult: `${JSX_PREFIX}import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime";
      _jsxDEV(Foo, {}, void 0, false, ${jsxDevArgs(2)} )
    `,
        expectedAutomaticProdESMResult: `import {jsx as _jsx} from "react/jsx-runtime";
      _jsx(Foo, {} )
    `,
        expectedAutomaticDevCJSResult: `"use strict";${JSX_PREFIX}var _jsxdevruntime = require("react/jsx-dev-runtime");
      _jsxdevruntime.jsxDEV.call(void 0, Foo, {}, void 0, false, ${jsxDevArgs(2)} )
    `,
        expectedAutomaticProdCJSResult: `"use strict";var _jsxruntime = require("react/jsx-runtime");
      _jsxruntime.jsx.call(void 0, Foo, {} )
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
        expectedAutomaticDevESMResult: `${JSX_PREFIX}import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime";
      _jsxDEV('div', { a: "foo", c: "test", children: ["Hello world"

        , _jsxDEV('span', { className: "some-class", children: "!"}, void 0, false, ${jsxDevArgs(
          4,
        )})
      ]}, "some-key", true, ${jsxDevArgs(2)})
    `,
        expectedAutomaticProdESMResult: `import {jsxs as _jsxs, jsx as _jsx} from "react/jsx-runtime";
      _jsxs('div', { a: "foo", c: "test", children: ["Hello world"

        , _jsx('span', { className: "some-class", children: "!"})
      ]}, "some-key")
    `,
        expectedAutomaticDevCJSResult: `"use strict";${JSX_PREFIX}var _jsxdevruntime = require("react/jsx-dev-runtime");
      _jsxdevruntime.jsxDEV.call(void 0, 'div', { a: "foo", c: "test", children: ["Hello world"

        , _jsxdevruntime.jsxDEV.call(void 0, 'span', { className: "some-class", children: "!"}, void 0, false, ${jsxDevArgs(
          4,
        )})
      ]}, "some-key", true, ${jsxDevArgs(2)})
    `,
        expectedAutomaticProdCJSResult: `"use strict";var _jsxruntime = require("react/jsx-runtime");
      _jsxruntime.jsxs.call(void 0, 'div', { a: "foo", c: "test", children: ["Hello world"

        , _jsxruntime.jsx.call(void 0, 'span', { className: "some-class", children: "!"})
      ]}, "some-key")
    `,
      },
    );
  });

  it("recognizes two or more children or spread children as static children in the automatic transform", () => {
    assertJSXResult(
      `
      <div />;
      <div></div>;
      <div>Some text</div>;
      <div>{...spreadChildrenIntentionallyMarkedStatic}</div>;
      <div>{expressionChild}</div>;
      <div>{}Still just one child{}</div>;
      <div>Two{}children</div>;
      <div><Child1 /><Child2 /></div>;
      <div>Child 1<Child2 />{child3}</div>;
      <div>One child{}
        
      </div>;
    `,
      {
        expectedAutomaticDevESMResult: `${JSX_PREFIX}import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime";
      _jsxDEV('div', {}, void 0, false, {fileName: _jsxFileName, lineNumber: 2}, this );
      _jsxDEV('div', {}, void 0, false, {fileName: _jsxFileName, lineNumber: 3}, this);
      _jsxDEV('div', { children: "Some text" }, void 0, false, {fileName: _jsxFileName, lineNumber: 4}, this);
      _jsxDEV('div', { children: [...spreadChildrenIntentionallyMarkedStatic]}, void 0, true, {fileName: _jsxFileName, lineNumber: 5}, this);
      _jsxDEV('div', { children: expressionChild}, void 0, false, {fileName: _jsxFileName, lineNumber: 6}, this);
      _jsxDEV('div', { children: "Still just one child"   }, void 0, false, {fileName: _jsxFileName, lineNumber: 7}, this);
      _jsxDEV('div', { children: ["Two", "children"]}, void 0, true, {fileName: _jsxFileName, lineNumber: 8}, this);
      _jsxDEV('div', { children: [_jsxDEV(Child1, {}, void 0, false, {fileName: _jsxFileName, lineNumber: 9}, this ), _jsxDEV(Child2, {}, void 0, false, {fileName: _jsxFileName, lineNumber: 9}, this )]}, void 0, true, {fileName: _jsxFileName, lineNumber: 9}, this);
      _jsxDEV('div', { children: ["Child 1" , _jsxDEV(Child2, {}, void 0, false, {fileName: _jsxFileName, lineNumber: 10}, this ), child3]}, void 0, true, {fileName: _jsxFileName, lineNumber: 10}, this);
      _jsxDEV('div', { children: "One child" 

      }, void 0, false, {fileName: _jsxFileName, lineNumber: 11}, this);
    `,
        expectedAutomaticProdESMResult: `import {jsx as _jsx, jsxs as _jsxs} from "react/jsx-runtime";
      _jsx('div', {} );
      _jsx('div', {});
      _jsx('div', { children: "Some text" });
      _jsxs('div', { children: [...spreadChildrenIntentionallyMarkedStatic]});
      _jsx('div', { children: expressionChild});
      _jsx('div', { children: "Still just one child"   });
      _jsxs('div', { children: ["Two", "children"]});
      _jsxs('div', { children: [_jsx(Child1, {} ), _jsx(Child2, {} )]});
      _jsxs('div', { children: ["Child 1" , _jsx(Child2, {} ), child3]});
      _jsx('div', { children: "One child" 

      });
    `,
      },
    );
  });

  it("properly handles elements with no children", () => {
    assertJSXResult(
      `
      <div />;
      <div></div>;
      <div>{/* This is a comment */}</div>;
      <div>
        
        {}
        
      </div>;
      <div>
        
        {}   {}
        
      </div>;
    `,
      {
        expectedAutomaticDevESMResult: `${JSX_PREFIX}import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime";
      _jsxDEV('div', {}, void 0, false, {fileName: _jsxFileName, lineNumber: 2}, this );
      _jsxDEV('div', {}, void 0, false, {fileName: _jsxFileName, lineNumber: 3}, this);
      _jsxDEV('div', {/* This is a comment */}, void 0, false, {fileName: _jsxFileName, lineNumber: 4}, this);
      _jsxDEV('div', {

        

      }, void 0, false, {fileName: _jsxFileName, lineNumber: 5}, this);
      _jsxDEV('div', { children: 

        "   "   

      }, void 0, false, {fileName: _jsxFileName, lineNumber: 10}, this);
    `,
        expectedAutomaticProdESMResult: `import {jsx as _jsx} from "react/jsx-runtime";
      _jsx('div', {} );
      _jsx('div', {});
      _jsx('div', {/* This is a comment */});
      _jsx('div', {

        

      });
      _jsx('div', { children: 

        "   "   

      });
    `,
      },
    );
  });

  it("falls back to createElement in the automatic transform when a key is after a prop spread", () => {
    assertJSXResult(
      `
      <div {...props} key="a">
        <span key="b" />
      </div>;
      <div {...props} key="a">
        Static children{}aren't treated differently in this case
      </div>;
      <div key="c" {...props} />;
    `,
      {
        expectedAutomaticDevESMResult: `${JSX_PREFIX}import {createElement as _createElement} from "react";import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime";
      _createElement('div', { ...props, key: "a", __self: this, __source: {fileName: _jsxFileName, lineNumber: 2}}
        , _jsxDEV('span', {}, "b", false, {fileName: _jsxFileName, lineNumber: 3}, this )
      );
      _createElement('div', { ...props, key: "a", __self: this, __source: {fileName: _jsxFileName, lineNumber: 5}}, "Static children"
         , "aren't treated differently in this case"
      );
      _jsxDEV('div', { ...props,}, "c", false, {fileName: _jsxFileName, lineNumber: 8}, this );
    `,
        expectedAutomaticProdESMResult: `import {createElement as _createElement} from "react";import {jsx as _jsx} from "react/jsx-runtime";
      _createElement('div', { ...props, key: "a",}
        , _jsx('span', {}, "b" )
      );
      _createElement('div', { ...props, key: "a",}, "Static children"
         , "aren't treated differently in this case"
      );
      _jsx('div', { ...props,}, "c" );
    `,
      },
    );
  });

  it("repositions multiline keys in the automatic transform", () => {
    // In all automatic runtime cases, the multiline key is moved to after the
    // child span, moving 3 newline characters in the process. The total number
    // of input and output lines should be the same, but the span is shifted up
    // as a result, which isn't ideal. For more details on the problem and
    // potential future solutions, see
    // https://github.com/alangpierce/sucrase/wiki/JSX-Automatic-Runtime-Transform-Technical-Plan#handling-multi-line-keys
    assertJSXResult(
      `
      <div
        someProp="Hello"
        key={
          // We need to call computeKey here.
          computeKey()
        }
        someOtherProp={foo}
      >
        <span key={computeOtherKey()} className="bar" />
      </div>
      console.log("10 lines after the start of the div");
    `,
      {
        expectedAutomaticDevESMResult: `${JSX_PREFIX}import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime";
      _jsxDEV('div', {
        someProp: "Hello",

        someOtherProp: foo,
 children: 
        _jsxDEV('span', { className: "bar",}, computeOtherKey(), false, {fileName: _jsxFileName, lineNumber: 10}, this )
      }, 
          // We need to call computeKey here.
          computeKey()
        , false, {fileName: _jsxFileName, lineNumber: 2}, this)
      console.log("10 lines after the start of the div");
    `,
        expectedAutomaticProdESMResult: `import {jsx as _jsx} from "react/jsx-runtime";
      _jsx('div', {
        someProp: "Hello",

        someOtherProp: foo,
 children: 
        _jsx('span', { className: "bar",}, computeOtherKey() )
      }, 
          // We need to call computeKey here.
          computeKey()
        )
      console.log("10 lines after the start of the div");
    `,
      },
    );
  });

  it("preserves total lines before and after with multiple multiline keys", () => {
    assertJSXResult(
      `
      <div
        key={
          a
        }
        key={
          b
        }
      />
      console.log("8 lines after the start of the div");
    `,
      {
        expectedAutomaticDevESMResult: `${JSX_PREFIX}import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime";
      _jsxDEV('div', {



}, 
          b
        , false, {fileName: _jsxFileName, lineNumber: 2}, this
      )
      console.log("8 lines after the start of the div");
    `,
      },
    );
  });

  it("claims free names when autogenerating imports", () => {
    assertJSXResult(
      `
      let _jsx, _jsxs, _jsxDEV, _Fragment, _createElement, _jsxFileName, _jsxruntime, _jsxdevruntime, _react;
      <>
        <span />
        <span {...props} key="a" />
      </>;
    `,
      {
        expectedAutomaticDevESMResult: `const _jsxFileName2 = "";import {createElement as _createElement2} from "react";import {jsxDEV as _jsxDEV2, Fragment as _Fragment2} from "react/jsx-dev-runtime";
      let _jsx, _jsxs, _jsxDEV, _Fragment, _createElement, _jsxFileName, _jsxruntime, _jsxdevruntime, _react;
      _jsxDEV2(_Fragment2, { children: [
        _jsxDEV2('span', {}, void 0, false, {fileName: _jsxFileName2, lineNumber: 4}, this )
        , _createElement2('span', { ...props, key: "a", __self: this, __source: {fileName: _jsxFileName2, lineNumber: 5}} )
      ]}, void 0, true, {fileName: _jsxFileName2, lineNumber: 3}, this);
    `,
        expectedAutomaticProdESMResult: `import {createElement as _createElement2} from "react";import {jsxs as _jsxs2, Fragment as _Fragment2, jsx as _jsx2} from "react/jsx-runtime";
      let _jsx, _jsxs, _jsxDEV, _Fragment, _createElement, _jsxFileName, _jsxruntime, _jsxdevruntime, _react;
      _jsxs2(_Fragment2, { children: [
        _jsx2('span', {} )
        , _createElement2('span', { ...props, key: "a",} )
      ]});
    `,
        expectedAutomaticDevCJSResult: `"use strict";const _jsxFileName2 = "";var _jsxdevruntime2 = require("react/jsx-dev-runtime");var _react2 = require("react");
      let _jsx, _jsxs, _jsxDEV, _Fragment, _createElement, _jsxFileName, _jsxruntime, _jsxdevruntime, _react;
      _jsxdevruntime2.jsxDEV.call(void 0, _jsxdevruntime2.Fragment, { children: [
        _jsxdevruntime2.jsxDEV.call(void 0, 'span', {}, void 0, false, {fileName: _jsxFileName2, lineNumber: 4}, this )
        , _react2.createElement.call(void 0, 'span', { ...props, key: "a", __self: this, __source: {fileName: _jsxFileName2, lineNumber: 5}} )
      ]}, void 0, true, {fileName: _jsxFileName2, lineNumber: 3}, this);
    `,
        expectedAutomaticProdCJSResult: `"use strict";var _jsxruntime2 = require("react/jsx-runtime");var _react2 = require("react");
      let _jsx, _jsxs, _jsxDEV, _Fragment, _createElement, _jsxFileName, _jsxruntime, _jsxdevruntime, _react;
      _jsxruntime2.jsxs.call(void 0, _jsxruntime2.Fragment, { children: [
        _jsxruntime2.jsx.call(void 0, 'span', {} )
        , _react2.createElement.call(void 0, 'span', { ...props, key: "a",} )
      ]});
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
        expectedAutomaticProdESMResult: `import {jsx as _jsx} from "react/jsx-runtime";
      _jsx('div', { children: _jsx('span', {})})
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
        expectedAutomaticProdESMResult: `import {jsx as _jsx} from "react/jsx-runtime";
      _jsx('div', { children: x})
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
        expectedAutomaticProdESMResult: `import {jsx as _jsx, Fragment as _Fragment} from "react/jsx-runtime";
      _jsx(A, { foo: _jsx(_Fragment, { children: "Hi"}),} )
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
        expectedAutomaticProdESMResult: `import {jsx as _jsx} from "react/jsx-runtime";
      _jsx(a.b, { c: "d",} )
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
        expectedAutomaticDevESMResult: `${JSX_PREFIX}import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime";
      _jsxDEV('a', { ...b, c: "d",}, void 0, false, ${jsxDevArgs(2)} )
    `,
        expectedAutomaticProdESMResult: `import {jsx as _jsx} from "react/jsx-runtime";
      _jsx('a', { ...b, c: "d",} )
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
        expectedAutomaticProdESMResult: `import {jsx as _jsx} from "react/jsx-runtime";
      _jsx('div', {
        value: "This is a multi-line string."
                ,}
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
        expectedAutomaticDevESMResult: `${JSX_PREFIX}import {jsxDEV as _jsxDEV} from "react/jsx-dev-runtime";
      const e = _jsxDEV('div', { a: true,}, void 0, false, ${jsxDevArgs(2)} );
    `,
        expectedAutomaticProdESMResult: `import {jsx as _jsx} from "react/jsx-runtime";
      const e = _jsx('div', { a: true,} );
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
        expectedAutomaticDevESMResult: `${JSX_PREFIX}import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime";
      const f = (
        _jsxDEV(_Fragment, { children: [
          _jsxDEV('div', {}, void 0, false, {fileName: _jsxFileName, lineNumber: 4}, this )
          , _jsxDEV('span', {}, void 0, false, {fileName: _jsxFileName, lineNumber: 5}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 3}, this)
      );
    `,
        expectedAutomaticDevCJSResult: `"use strict";${JSX_PREFIX}var _jsxdevruntime = require("react/jsx-dev-runtime");
      const f = (
        _jsxdevruntime.jsxDEV.call(void 0, _jsxdevruntime.Fragment, { children: [
          _jsxdevruntime.jsxDEV.call(void 0, 'div', {}, void 0, false, {fileName: _jsxFileName, lineNumber: 4}, this )
          , _jsxdevruntime.jsxDEV.call(void 0, 'span', {}, void 0, false, {fileName: _jsxFileName, lineNumber: 5}, this )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 3}, this)
      );
    `,
        expectedAutomaticProdESMResult: `import {jsxs as _jsxs, Fragment as _Fragment, jsx as _jsx} from "react/jsx-runtime";
      const f = (
        _jsxs(_Fragment, { children: [
          _jsx('div', {} )
          , _jsx('span', {} )
        ]})
      );
    `,
        expectedAutomaticProdCJSResult: `"use strict";var _jsxruntime = require("react/jsx-runtime");
      const f = (
        _jsxruntime.jsxs.call(void 0, _jsxruntime.Fragment, { children: [
          _jsxruntime.jsx.call(void 0, 'div', {} )
          , _jsxruntime.jsx.call(void 0, 'span', {} )
        ]})
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

  it("allows custom JSX import source for automatic transform", () => {
    assertJSXResult(
      `
      const f = (
        <>
          <div />
          <span {...props} key="a" />
        </>
      );
    `,
      {
        expectedAutomaticDevESMResult: `${JSX_PREFIX}import {createElement as _createElement} from "my-lib";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "my-lib/jsx-dev-runtime";
      const f = (
        _jsxDEV(_Fragment, { children: [
          _jsxDEV('div', {}, void 0, false, {fileName: _jsxFileName, lineNumber: 4}, this )
          , _createElement('span', { ...props, key: "a", __self: this, __source: {fileName: _jsxFileName, lineNumber: 5}} )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 3}, this)
      );
    `,
        expectedAutomaticDevCJSResult: `"use strict";${JSX_PREFIX}var _jsxdevruntime = require("my-lib/jsx-dev-runtime");var _mylib = require("my-lib");
      const f = (
        _jsxdevruntime.jsxDEV.call(void 0, _jsxdevruntime.Fragment, { children: [
          _jsxdevruntime.jsxDEV.call(void 0, 'div', {}, void 0, false, {fileName: _jsxFileName, lineNumber: 4}, this )
          , _mylib.createElement.call(void 0, 'span', { ...props, key: "a", __self: this, __source: {fileName: _jsxFileName, lineNumber: 5}} )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 3}, this)
      );
    `,
        expectedAutomaticProdESMResult: `import {createElement as _createElement} from "my-lib";import {jsxs as _jsxs, Fragment as _Fragment, jsx as _jsx} from "my-lib/jsx-runtime";
      const f = (
        _jsxs(_Fragment, { children: [
          _jsx('div', {} )
          , _createElement('span', { ...props, key: "a",} )
        ]})
      );
    `,
        expectedAutomaticProdCJSResult: `"use strict";var _jsxruntime = require("my-lib/jsx-runtime");var _mylib = require("my-lib");
      const f = (
        _jsxruntime.jsxs.call(void 0, _jsxruntime.Fragment, { children: [
          _jsxruntime.jsx.call(void 0, 'div', {} )
          , _mylib.createElement.call(void 0, 'span', { ...props, key: "a",} )
        ]})
      );
    `,
      },
      {jsxImportSource: "my-lib"},
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
        expectedAutomaticProdESMResult: `import {jsx as _jsx, Fragment as _Fragment} from "react/jsx-runtime";
      const c = _jsx(_Fragment, {});
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

  it("allows preserving JSX", () => {
    assertResult(
      `
      <div />
    `,
      `
      <div />
    `,
      {transforms: ["jsx"], jsxRuntime: "preserve"},
    );
  });

  it("transforms valid JSX names with imports transform when preserving JSX", () => {
    assertResult(
      `
      import {foo, Bar, baz, abc, test, def, ghi} from "./utils";
      function render() {
        return (
          <>
            <foo />
            <Bar />
            <baz.abc />
            <div test={def}>{ghi}</div>
          </>
        );
      }
    `,
      `"use strict";
      var _utils = require('./utils');
      function render() {
        return (
          <>
            <foo />
            <_utils.Bar />
            <_utils.baz.abc />
            <div test={_utils.def}>{_utils.ghi}</div>
          </>
        );
      }
    `,
      {transforms: ["jsx", "imports"], jsxRuntime: "preserve"},
    );
  });

  it("removes JSX TS type arguments when preserving JSX", () => {
    assertResult(
      `
      <Foo<number> />
    `,
      `
      <Foo />
    `,
      {transforms: ["jsx", "typescript"], jsxRuntime: "preserve"},
    );
  });
});
