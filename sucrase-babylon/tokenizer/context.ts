// The algorithm used to determine whether a regexp can appear at a
// given point in the program is loosely based on sweet.js' approach.
// See https://github.com/mozilla/sweet.js/wiki/design

import {lineBreak} from "../util/whitespace";
import {TokenType, types as tt} from "./types";

export class TokContext {
  constructor(
    token: string,
    isExpr?: boolean,
    preserveSpace?: boolean,
    override: Function | null = null, // Takes a Tokenizer as a this-parameter, and returns void.
  ) {
    this.token = token;
    this.isExpr = !!isExpr;
    this.preserveSpace = !!preserveSpace;
  }

  token: string;
  isExpr: boolean;
  preserveSpace: boolean;
  override: Function | null;
}

export const types: {
  [key: string]: TokContext;
} = {
  braceStatement: new TokContext("{", false),
  braceExpression: new TokContext("{", true),
  templateQuasi: new TokContext("${", true),
  parenStatement: new TokContext("(", false),
  parenExpression: new TokContext("(", true),
  template: new TokContext("`", true, true),
  functionExpression: new TokContext("function", true),
};

// Token-specific context update code

const updateEnd = function(): void {
  if (this.state.context.length === 1) {
    this.state.exprAllowed = true;
    return;
  }

  const out = this.state.context.pop();
  if (out === types.braceStatement && this.curContext() === types.functionExpression) {
    this.state.context.pop();
    this.state.exprAllowed = false;
  } else if (out === types.templateQuasi) {
    this.state.exprAllowed = true;
  } else {
    this.state.exprAllowed = !out.isExpr;
  }
};
tt.parenR.updateContext = updateEnd;
tt.braceR.updateContext = updateEnd;

tt.name.updateContext = function(prevType: TokenType): void {
  if (this.state.value === "of" && this.curContext() === types.parenStatement) {
    this.state.exprAllowed = !prevType.beforeExpr;
    return;
  }

  this.state.exprAllowed = false;

  if (prevType === tt._let || prevType === tt._const || prevType === tt._var) {
    if (lineBreak.test(this.input.slice(this.state.end))) {
      this.state.exprAllowed = true;
    }
  }
};

tt.braceL.updateContext = function(prevType: TokenType): void {
  this.state.context.push(
    this.braceIsBlock(prevType) ? types.braceStatement : types.braceExpression,
  );
  this.state.exprAllowed = true;
};

tt.dollarBraceL.updateContext = function(): void {
  this.state.context.push(types.templateQuasi);
  this.state.exprAllowed = true;
};

tt.parenL.updateContext = function(prevType: TokenType): void {
  const statementParens =
    prevType === tt._if || prevType === tt._for || prevType === tt._with || prevType === tt._while;
  this.state.context.push(statementParens ? types.parenStatement : types.parenExpression);
  this.state.exprAllowed = true;
};

tt.incDec.updateContext = function(): void {
  // tokExprAllowed stays unchanged
};

tt._function.updateContext = function(): void {
  if (this.curContext() !== types.braceStatement) {
    this.state.context.push(types.functionExpression);
  }

  this.state.exprAllowed = false;
};

tt.backQuote.updateContext = function(): void {
  if (this.curContext() === types.template) {
    this.state.context.pop();
  } else {
    this.state.context.push(types.template);
  }
  this.state.exprAllowed = false;
};
