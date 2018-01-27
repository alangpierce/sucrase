// ## Token types

// The assignment of fine-grained, information-carrying type objects
// allows the tokenizer to store the information it has about a
// token in a way that is very cheap for the parser to look up.

// All token type variables start with an underscore, to make them
// easy to recognize.

const isAssign = true;
const prefix = true;
const postfix = true;

export type TokenOptions = {
  keyword?: string;

  rightAssociative?: boolean;
  isAssign?: boolean;
  prefix?: boolean;
  postfix?: boolean;
  binop?: number;
};

export class TokenType {
  label: string;
  keyword?: string;
  rightAssociative: boolean;
  isAssign: boolean;
  prefix: boolean;
  postfix: boolean;
  binop: number | null;

  constructor(label: string, conf: TokenOptions = {}) {
    this.label = label;
    this.keyword = conf.keyword;
    this.rightAssociative = !!conf.rightAssociative;
    this.isAssign = !!conf.isAssign;
    this.prefix = !!conf.prefix;
    this.postfix = !!conf.postfix;
    this.binop = conf.binop === 0 ? 0 : conf.binop || null;
  }
}

export class KeywordTokenType extends TokenType {
  constructor(name: string, options: TokenOptions = {}) {
    options.keyword = name;

    super(name, options);
  }
}

export class BinopTokenType extends TokenType {
  constructor(name: string, prec: number) {
    super(name, {binop: prec});
  }
}

export const types: {[name: string]: TokenType} = {
  num: new TokenType("num"),
  bigint: new TokenType("bigint"),
  regexp: new TokenType("regexp"),
  string: new TokenType("string"),
  name: new TokenType("name"),
  eof: new TokenType("eof"),

  // Punctuation token types.
  bracketL: new TokenType("["),
  bracketR: new TokenType("]"),
  braceL: new TokenType("{"),
  braceBarL: new TokenType("{|"),
  braceR: new TokenType("}"),
  braceBarR: new TokenType("|}"),
  parenL: new TokenType("("),
  parenR: new TokenType(")"),
  comma: new TokenType(","),
  semi: new TokenType(";"),
  colon: new TokenType(":"),
  doubleColon: new TokenType("::"),
  dot: new TokenType("."),
  question: new TokenType("?"),
  questionDot: new TokenType("?."),
  arrow: new TokenType("=>"),
  template: new TokenType("template"),
  ellipsis: new TokenType("..."),
  backQuote: new TokenType("`"),
  dollarBraceL: new TokenType("${"),
  at: new TokenType("@"),
  hash: new TokenType("#"),

  // Operators. These carry several kinds of properties to help the
  // parser use them properly (the presence of these properties is
  // what categorizes them as operators).
  //
  // `binop`, when present, specifies that this operator is a binary
  // operator, and will refer to its precedence.
  //
  // `prefix` and `postfix` mark the operator as a prefix or postfix
  // unary operator.
  //
  // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
  // binary operators with a very low precedence, that should result
  // in AssignmentExpression nodes.

  eq: new TokenType("=", {isAssign}),
  assign: new TokenType("_=", {isAssign}),
  incDec: new TokenType("++/--", {prefix, postfix}),
  bang: new TokenType("!", {prefix}),
  tilde: new TokenType("~", {prefix}),
  pipeline: new BinopTokenType("|>", 0),
  nullishCoalescing: new BinopTokenType("??", 1),
  logicalOR: new BinopTokenType("||", 1),
  logicalAND: new BinopTokenType("&&", 2),
  bitwiseOR: new BinopTokenType("|", 3),
  bitwiseXOR: new BinopTokenType("^", 4),
  bitwiseAND: new BinopTokenType("&", 5),
  equality: new BinopTokenType("==/!=", 6),
  lessThan: new BinopTokenType("<", 7),
  greaterThan: new BinopTokenType(">", 7),
  relationalOrEqual: new BinopTokenType("<=/>=", 7),
  bitShift: new BinopTokenType("<</>>", 8),
  plusMin: new TokenType("+/-", {binop: 9, prefix}),
  modulo: new BinopTokenType("%", 10),
  star: new BinopTokenType("*", 10),
  slash: new BinopTokenType("/", 10),
  exponent: new TokenType("**", {binop: 11, rightAssociative: true}),

  typeParameterStart: new TokenType("typeParameterStart"),
};

export const keywords = {
  break: new KeywordTokenType("break"),
  case: new KeywordTokenType("case"),
  catch: new KeywordTokenType("catch"),
  continue: new KeywordTokenType("continue"),
  debugger: new KeywordTokenType("debugger"),
  default: new KeywordTokenType("default"),
  do: new KeywordTokenType("do"),
  else: new KeywordTokenType("else"),
  finally: new KeywordTokenType("finally"),
  for: new KeywordTokenType("for"),
  function: new KeywordTokenType("function"),
  if: new KeywordTokenType("if"),
  return: new KeywordTokenType("return"),
  switch: new KeywordTokenType("switch"),
  throw: new KeywordTokenType("throw", {prefix}),
  try: new KeywordTokenType("try"),
  var: new KeywordTokenType("var"),
  let: new KeywordTokenType("let"),
  const: new KeywordTokenType("const"),
  while: new KeywordTokenType("while"),
  with: new KeywordTokenType("with"),
  new: new KeywordTokenType("new"),
  this: new KeywordTokenType("this"),
  super: new KeywordTokenType("super"),
  class: new KeywordTokenType("class"),
  extends: new KeywordTokenType("extends"),
  export: new KeywordTokenType("export"),
  import: new KeywordTokenType("import"),
  yield: new KeywordTokenType("yield"),
  null: new KeywordTokenType("null"),
  true: new KeywordTokenType("true"),
  false: new KeywordTokenType("false"),
  in: new KeywordTokenType("in", {binop: 7}),
  instanceof: new KeywordTokenType("instanceof", {binop: 7}),
  typeof: new KeywordTokenType("typeof", {prefix}),
  void: new KeywordTokenType("void", {prefix}),
  delete: new KeywordTokenType("delete", {prefix}),

  // Other keywords
  async: new KeywordTokenType("async"),
  get: new KeywordTokenType("get"),
  set: new KeywordTokenType("set"),

  // TypeScript keywords
  declare: new KeywordTokenType("declare"),
  readonly: new KeywordTokenType("readonly"),
  abstract: new KeywordTokenType("abstract"),
  static: new KeywordTokenType("static"),
  public: new KeywordTokenType("public"),
  private: new KeywordTokenType("private"),
  protected: new KeywordTokenType("protected"),
  as: new KeywordTokenType("as"),
  enum: new KeywordTokenType("enum"),
  type: new KeywordTokenType("type"),
  implements: new KeywordTokenType("implements"),
};

// Map keyword names to token types.
Object.keys(keywords).forEach((name) => {
  types[`_${name}`] = keywords[name];
});
