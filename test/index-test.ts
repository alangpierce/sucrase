import * as assert from "assert";

import {getFormattedTokens} from "../src";

describe("getFormattedTokens", () => {
  it("formats a simple program", () => {
    assert.equal(
      getFormattedTokens(`\
if (foo) {
  console.log('Hello world!');
}`),
      `\
if: if (1:1-1:3)
( (1:4-1:5)
name: foo (1:5-1:8)
) (1:8-1:9)
{ (1:10-1:11)
name: console (2:3-2:10)
. (2:10-2:11)
name: log (2:11-2:14)
( (2:14-2:15)
string: Hello world! (2:15-2:29)
) (2:29-2:30)
; (2:30-2:31)
} (3:1-3:2)
eof (3:2-3:2)`,
    );
  });
});
