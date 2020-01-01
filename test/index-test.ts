import * as assert from "assert";

import {getFormattedTokens} from "../src";

describe("getFormattedTokens", () => {
  it("formats a simple program", () => {
    assert.strictEqual(
      getFormattedTokens(
        `\
if (foo) {
  console.log('Hello world!');
}`,
        {transforms: ["jsx", "imports"]},
      ),
      `\
Location  Label  Raw            contextualKeyword scopeDepth isType identifierRole shadowsGlobal contextId rhsEndIndex isExpression numNullishCoalesceStarts numNullishCoalesceEnds isOptionalChainStart isOptionalChainEnd subscriptStartIndex nullishStartIndex
1:1-1:3   if     if             0                 0                                                                                 0                        0                                                                                                   
1:4-1:5   (      (              0                 0                                                                                 0                        0                                                                                                   
1:5-1:8   name   foo            0                 0                 0                                                               0                        0                                                                                                   
1:8-1:9   )      )              0                 0                                                                                 0                        0                                                                                                   
1:10-1:11 {      {              0                 1                                                                                 0                        0                                                                                                   
2:3-2:10  name   console        0                 1                 0                                                               0                        0                                                                                                   
2:10-2:11 .      .              0                 1                                                                                 0                        0                                                              5                                    
2:11-2:14 name   log            0                 1                                                                                 0                        0                                                                                                   
2:14-2:15 (      (              0                 1                                              1                                  0                        0                                                              5                                    
2:15-2:29 string 'Hello world!' 0                 1                                                                                 0                        0                                                                                                   
2:29-2:30 )      )              0                 1                                              1                                  0                        0                                                                                                   
2:30-2:31 ;      ;              0                 1                                                                                 0                        0                                                                                                   
3:1-3:2   }      }              0                 1                                                                                 0                        0                                                                                                   
3:2-3:2   eof                   0                 0                                                                                 0                        0                                                                                                   `,
    );
  });
});
