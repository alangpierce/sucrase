// ## Token types

// The assignment of fine-grained, information-carrying type objects
// allows the tokenizer to store the information it has about a
// token in a way that is very cheap for the parser to look up.

// All token type variables start with an underscore, to make them
// easy to recognize.

// The `beforeExpr` property is used to disambiguate between regular
// expressions and divisions. It is set on all token types that can
// be followed by an expression (thus, a slash after them would be a
// regular expression).
//
// `isLoop` marks a keyword as starting a loop, which is important
// to know when parsing a label, in order to allow or disallow
// continue jumps to that label.

const beforeExpr = true;
const startsExpr = true;
const isLoop = true;
const isAssign = true;
const prefix = true;
const postfix = true;

export type TokenOptions = {
  keyword?: string;

  beforeExpr?: boolean;
  startsExpr?: boolean;
  rightAssociative?: boolean;
  isLoop?: boolean;
  isAssign?: boolean;
  prefix?: boolean;
  postfix?: boolean;
  binop?: number;
};

export class TokenType {
  label: string;
  keyword?: string;
  beforeExpr: boolean;
  startsExpr: boolean;
  rightAssociative: boolean;
  isLoop: boolean;
  isAssign: boolean;
  prefix: boolean;
  postfix: boolean;
  binop: number | null;
  updateContext?: ((prevType: TokenType) => void) | null;

  constructor(label: string, conf: TokenOptions = {}) {
    this.label = label;
    this.keyword = conf.keyword;
    this.beforeExpr = !!conf.beforeExpr;
    this.startsExpr = !!conf.startsExpr;
    this.rightAssociative = !!conf.rightAssociative;
    this.isLoop = !!conf.isLoop;
    this.isAssign = !!conf.isAssign;
    this.prefix = !!conf.prefix;
    this.postfix = !!conf.postfix;
    this.binop = conf.binop === 0 ? 0 : conf.binop || null;
    this.updateContext = null;
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
    super(name, {beforeExpr, binop: prec});
  }
}

export const types: {[name: string]: TokenType} = {
  num: new TokenType("num", {startsExpr}),
  bigint: new TokenType("bigint", {startsExpr}),
  regexp: new TokenType("regexp", {startsExpr}),
  string: new TokenType("string", {startsExpr}),
  name: new TokenType("name", {startsExpr}),
  eof: new TokenType("eof"),

  // Punctuation token types.
  bracketL: new TokenType("[", {beforeExpr, startsExpr}),
  bracketR: new TokenType("]"),
  braceL: new TokenType("{", {beforeExpr, startsExpr}),
  braceBarL: new TokenType("{|", {beforeExpr, startsExpr}),
  braceR: new TokenType("}"),
  braceBarR: new TokenType("|}"),
  parenL: new TokenType("(", {beforeExpr, startsExpr}),
  parenR: new TokenType(")"),
  comma: new TokenType(",", {beforeExpr}),
  semi: new TokenType(";", {beforeExpr}),
  colon: new TokenType(":", {beforeExpr}),
  doubleColon: new TokenType("::", {beforeExpr}),
  dot: new TokenType("."),
  question: new TokenType("?", {beforeExpr}),
  questionDot: new TokenType("?."),
  arrow: new TokenType("=>", {beforeExpr}),
  template: new TokenType("template"),
  ellipsis: new TokenType("...", {beforeExpr}),
  backQuote: new TokenType("`", {startsExpr}),
  dollarBraceL: new TokenType("${", {beforeExpr, startsExpr}),
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

  eq: new TokenType("=", {beforeExpr, isAssign}),
  assign: new TokenType("_=", {beforeExpr, isAssign}),
  incDec: new TokenType("++/--", {prefix, postfix, startsExpr}),
  bang: new TokenType("!", {beforeExpr, prefix, startsExpr}),
  tilde: new TokenType("~", {beforeExpr, prefix, startsExpr}),
  pipeline: new BinopTokenType("|>", 0),
  nullishCoalescing: new BinopTokenType("??", 1),
  logicalOR: new BinopTokenType("||", 1),
  logicalAND: new BinopTokenType("&&", 2),
  bitwiseOR: new BinopTokenType("|", 3),
  bitwiseXOR: new BinopTokenType("^", 4),
  bitwiseAND: new BinopTokenType("&", 5),
  equality: new BinopTokenType("==/!=", 6),
  relational: new BinopTokenType("</>", 7),
  bitShift: new BinopTokenType("<</>>", 8),
  plusMin: new TokenType("+/-", {beforeExpr, binop: 9, prefix, startsExpr}),
  modulo: new BinopTokenType("%", 10),
  star: new BinopTokenType("*", 10),
  slash: new BinopTokenType("/", 10),
  exponent: new TokenType("**", {
    beforeExpr,
    binop: 11,
    rightAssociative: true,
  }),

  typeParameterStart: new TokenType("typeParameterStart"),
};

export const keywords = {
  break: new KeywordTokenType("break"),
  case: new KeywordTokenType("case", {beforeExpr}),
  catch: new KeywordTokenType("catch"),
  continue: new KeywordTokenType("continue"),
  debugger: new KeywordTokenType("debugger"),
  default: new KeywordTokenType("default", {beforeExpr}),
  do: new KeywordTokenType("do", {isLoop, beforeExpr}),
  else: new KeywordTokenType("else", {beforeExpr}),
  finally: new KeywordTokenType("finally"),
  for: new KeywordTokenType("for", {isLoop}),
  function: new KeywordTokenType("function", {startsExpr}),
  if: new KeywordTokenType("if"),
  return: new KeywordTokenType("return", {beforeExpr}),
  switch: new KeywordTokenType("switch"),
  throw: new KeywordTokenType("throw", {beforeExpr, prefix, startsExpr}),
  try: new KeywordTokenType("try"),
  var: new KeywordTokenType("var"),
  let: new KeywordTokenType("let"),
  const: new KeywordTokenType("const"),
  while: new KeywordTokenType("while", {isLoop}),
  with: new KeywordTokenType("with"),
  new: new KeywordTokenType("new", {beforeExpr, startsExpr}),
  this: new KeywordTokenType("this", {startsExpr}),
  super: new KeywordTokenType("super", {startsExpr}),
  class: new KeywordTokenType("class"),
  extends: new KeywordTokenType("extends", {beforeExpr}),
  export: new KeywordTokenType("export"),
  import: new KeywordTokenType("import", {startsExpr}),
  yield: new KeywordTokenType("yield", {beforeExpr, startsExpr}),
  null: new KeywordTokenType("null", {startsExpr}),
  true: new KeywordTokenType("true", {startsExpr}),
  false: new KeywordTokenType("false", {startsExpr}),
  in: new KeywordTokenType("in", {beforeExpr, binop: 7}),
  instanceof: new KeywordTokenType("instanceof", {beforeExpr, binop: 7}),
  typeof: new KeywordTokenType("typeof", {beforeExpr, prefix, startsExpr}),
  void: new KeywordTokenType("void", {beforeExpr, prefix, startsExpr}),
  delete: new KeywordTokenType("delete", {beforeExpr, prefix, startsExpr}),
  declare: new KeywordTokenType("declare"),
  readonly: new KeywordTokenType("readonly"),
  abstract: new KeywordTokenType("abstract"),
  static: new KeywordTokenType("static"),
  public: new KeywordTokenType("public"),
  private: new KeywordTokenType("private"),
  protected: new KeywordTokenType("protected"),
};

// Map keyword names to token types.
Object.keys(keywords).forEach((name) => {
  types[`_${name}`] = keywords[name];
});
