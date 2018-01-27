import * as assert from "assert";

import {getFormattedTokens} from "../src";

describe("getFormattedTokens", () => {
  it("formats a simple program", () => {
    assert.equal(
      getFormattedTokens(
        `\
if (foo) {
  console.log('Hello world!');
}`,
        {transforms: ["jsx", "imports"]},
      ),
      `\
Location  Label  Value        isType identifierRole shadowsGlobal contextId rhsEndIndex isExpression rightAssociative isAssign prefix postfix binop
1:1-1:3   if     if                                                                                                                                
1:4-1:5   (                                                                                                                                        
1:5-1:8   name   foo                 0                                                                                                             
1:8-1:9   )                                                                                                                                        
1:10-1:11 {                                                                                                                                        
2:3-2:10  name   console             0                                                                                                             
2:10-2:11 .                                                                                                                                        
2:11-2:14 name   log                                                                                                                               
2:14-2:15 (                                                       1                                                                                
2:15-2:29 string Hello world!                                                                                                                      
2:29-2:30 )                                                       1                                                                                
2:30-2:31 ;                                                                                                                                        
3:1-3:2   }                                                                                                                                        
3:2-3:2   eof                                                                                                                                      `,
    );
  });
});
