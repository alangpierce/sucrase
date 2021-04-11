import {
  ESMODULE_PREFIX,
  IMPORT_DEFAULT_PREFIX,
  JSX_PREFIX,
  NULLISH_COALESCE_PREFIX,
  OPTIONAL_CHAIN_PREFIX,
} from "./prefixes";
import {assertResult} from "./util";

function assertCJSResult(code: string, expectedResult: string): void {
  assertResult(code, expectedResult, {transforms: ["jsx", "jest", "imports"]});
}

function assertESMResult(code: string, expectedResult: string): void {
  assertResult(code, expectedResult, {transforms: ["jsx", "jest"]});
}

function assertImportResult(
  code: string,
  {expectedCJSResult, expectedESMResult}: {expectedCJSResult: string; expectedESMResult: string},
): void {
  assertCJSResult(code, expectedCJSResult);
  assertESMResult(code, expectedESMResult);
}

describe("transform jest", () => {
  it("hoists desired methods", () => {
    assertESMResult(
      `
      import 'moduleName';
      jest.mock('a');
      jest.unmock('b').unknown().enableAutomock();
      jest.disableAutomock()
      jest.mock('c', () => {}).mock('d', () => {});
      jest.doMock('a', () => {});
    `,
      `__jestHoist();__jestHoist2();__jestHoist3();__jestHoist4();__jestHoist5();__jestHoist6();
      import 'moduleName';
function __jestHoist(){jest.mock('a');};
function __jestHoist2(){jest.unmock('b');}jest.unknown()function __jestHoist3(){jest.enableAutomock();};
function __jestHoist4(){jest.disableAutomock();}
function __jestHoist5(){jest.mock('c', () => {});}function __jestHoist6(){jest.mock('d', () => {});};
jest.doMock('a', () => {});
    `,
    );
  });

  it("hoists jest mocks with interleaved imports", () => {
    assertImportResult(
      `
        import {A} from 'a';
        jest.mock('a');
        import {B} from 'b';
        jest.mock('b', () => ({}));
        import C from 'c';
        jest.unmock('c')
      `,
      {
        expectedCJSResult: `"use strict";${IMPORT_DEFAULT_PREFIX}__jestHoist();__jestHoist2();__jestHoist3();
        var _a = require('a');
function __jestHoist(){jest.mock('a');};
        var _b = require('b');
function __jestHoist2(){jest.mock('b', () => ({}));};
        var _c = require('c'); var _c2 = _interopRequireDefault(_c);
function __jestHoist3(){jest.unmock('c');}
      `,
        expectedESMResult: `__jestHoist();__jestHoist2();__jestHoist3();
        import {A} from 'a';
function __jestHoist(){jest.mock('a');};
        import {B} from 'b';
function __jestHoist2(){jest.mock('b', () => ({}));};
        import C from 'c';
function __jestHoist3(){jest.unmock('c');}
      `,
      },
    );
  });

  it("places import helpers properly", () => {
    assertCJSResult(
      `
      import a from './a';
      import {B} from './b';
      jest.mock('a');

      export const x = 1
    `,
      `"use strict";${ESMODULE_PREFIX}${IMPORT_DEFAULT_PREFIX}__jestHoist();
      var _a = require('./a'); var _a2 = _interopRequireDefault(_a);
      var _b = require('./b');
function __jestHoist(){jest.mock('a');};

       const x = 1; exports.x = x
    `,
    );
  });

  it("transforms arguments and includes helpers", () => {
    assertCJSResult(
      `
      import A from './a';
jest.mock('a', () => ({
  f(x) {
    return x?.a ?? 0;
  }
}));
    `,
      `"use strict";${IMPORT_DEFAULT_PREFIX}${NULLISH_COALESCE_PREFIX}${OPTIONAL_CHAIN_PREFIX}__jestHoist();
      var _a = require('./a'); var _a2 = _interopRequireDefault(_a);
function __jestHoist(){jest.mock('a', () => ({
  f(x) {
    return _nullishCoalesce(_optionalChain([x, 'optionalAccess', _ => _.a]), () => ( 0));
  }
}));};
    `,
    );
  });

  it("transforms typescript arguments", () => {
    assertResult(
      `
      import {x, X} from './a';
jest.mock('a'! as number, (arg: unknown) => ({
  f(x?: string): void {
    return x! as X;
  }
}) as any);
      x()
    `,
      `"use strict";__jestHoist();
      var _a = require('./a');
function __jestHoist(){jest.mock('a' , (arg) => ({
  f(x) {
    return x ;
  }
}) );};
      _a.x.call(void 0, )
    `,
      {transforms: ["jsx", "jest", "imports", "typescript"]},
    );
  });

  it("transforms flow arguments", () => {
    assertResult(
      `
      import {x, X} from './a';
jest.mock('a': number, (arg: string) => ({
  f(x: string): void {
    return (x: X);
  }
}): any);
      x()
    `,
      `"use strict";__jestHoist();
      var _a = require('./a');
function __jestHoist(){jest.mock('a', (arg) => ({
  f(x) {
    return (x);
  }
}));};
      _a.x.call(void 0, )
    `,
      {transforms: ["jsx", "jest", "imports", "flow"]},
    );
  });

  it("transforms jsx in parameters", () => {
    assertResult(
      `
      import React from 'react';
      import {x} from './a';
      jest.mock('a', (arg) => ({
        f(x) {
          return <div />;
        }
      }));
      x()
    `,
      `"use strict";${JSX_PREFIX}${IMPORT_DEFAULT_PREFIX}__jestHoist();
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);
      var _a = require('./a');
function __jestHoist(){jest.mock('a', (arg) => ({
        f(x) {
          return _react2.default.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 6}} );
        }
      }));};
      _a.x.call(void 0, )
    `,
      {transforms: ["jsx", "jest", "imports"]},
    );
  });

  it("avoids hoisting if jest is an imported symbol", () => {
    assertImportResult(
      `
      import {jest} from './a';
      jest.mock('x');
    `,
      {
        expectedCJSResult: `"use strict";
      var _a = require('./a');
      _a.jest.mock('x');
    `,
        // Note that this behavior is incorrect, but jest requires imports transform for now.
        expectedESMResult: `__jestHoist();
      import {jest} from './a';
function __jestHoist(){jest.mock('x');};
    `,
      },
    );
  });

  it("avoids hoisting if jest is imported in typescript", () => {
    assertResult(
      `
      import './a'
      import {jest} from './b';
      jest.mock('x');
    `,
      `"use strict";
      require('./a');
      var _b = require('./b');
      _b.jest.mock('x');
    `,
      {transforms: ["jsx", "jest", "imports", "typescript"]},
    );
  });

  it("allows chained unknown methods", () => {
    assertResult(
      `
      import './a';
      console.log(jest.spyOn({foo() {}}, 'foo').getMockName());
    `,
      `"use strict";
      require('./a');
      console.log(jest.spyOn({foo() {}}, 'foo').getMockName());
    `,
      {transforms: ["jest", "imports"]},
    );
  });
});
