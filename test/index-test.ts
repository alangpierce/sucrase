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
Location  Label  Context   Value        beforeExpr startsExpr rightAssociative isLoop isAssign prefix postfix binop
1:1-1:3   if     block(0)  if                                                                                      
1:4-1:5   (      parens(1)              beforeExpr startsExpr                                                      
1:5-1:8   name   parens(1) foo                     startsExpr                                                      
1:8-1:9   )      parens(1)                                                                                         
1:10-1:11 {      block(4)               beforeExpr startsExpr                                                      
2:3-2:10  name   block(4)  console                 startsExpr                                                      
2:10-2:11 .      block(4)                                                                                          
2:11-2:14 name   block(4)  log                     startsExpr                                                      
2:14-2:15 (      parens(8)              beforeExpr startsExpr                                                      
2:15-2:29 string parens(8) Hello world!            startsExpr                                                      
2:29-2:30 )      parens(8)                                                                                         
2:30-2:31 ;      block(4)               beforeExpr                                                                 
3:1-3:2   }      block(4)                                                                                          
3:2-3:2   eof    block(0)                                                                                          `,
    );
  });
});
