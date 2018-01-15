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
Location  Label  Value        beforeExpr startsExpr rightAssociative isLoop isAssign prefix postfix binop
1:1-1:3   if     if                                                                                      
1:4-1:5   (                   beforeExpr startsExpr                                                      
1:5-1:8   name   foo                     startsExpr                                                      
1:8-1:9   )                                                                                              
1:10-1:11 {                   beforeExpr startsExpr                                                      
2:3-2:10  name   console                 startsExpr                                                      
2:10-2:11 .                                                                                              
2:11-2:14 name   log                     startsExpr                                                      
2:14-2:15 (                   beforeExpr startsExpr                                                      
2:15-2:29 string Hello world!            startsExpr                                                      
2:29-2:30 )                                                                                              
2:30-2:31 ;                   beforeExpr                                                                 
3:1-3:2   }                                                                                              
3:2-3:2   eof                                                                                            `,
    );
  });
});
