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

export const types = {
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

  jsxName: new TokenType("jsxName"),
  jsxText: new TokenType("jsxText"),
  jsxTagStart: new TokenType("jsxTagStart"),
  jsxTagEnd: new TokenType("jsxTagEnd"),
  typeParameterStart: new TokenType("typeParameterStart"),
  nonNullAssertion: new TokenType("nonNullAssertion"),

  // keywords
  _break: new KeywordTokenType("break"),
  _case: new KeywordTokenType("case"),
  _catch: new KeywordTokenType("catch"),
  _continue: new KeywordTokenType("continue"),
  _debugger: new KeywordTokenType("debugger"),
  _default: new KeywordTokenType("default"),
  _do: new KeywordTokenType("do"),
  _else: new KeywordTokenType("else"),
  _finally: new KeywordTokenType("finally"),
  _for: new KeywordTokenType("for"),
  _function: new KeywordTokenType("function"),
  _if: new KeywordTokenType("if"),
  _return: new KeywordTokenType("return"),
  _switch: new KeywordTokenType("switch"),
  _throw: new KeywordTokenType("throw", {prefix}),
  _try: new KeywordTokenType("try"),
  _var: new KeywordTokenType("var"),
  _let: new KeywordTokenType("let"),
  _const: new KeywordTokenType("const"),
  _while: new KeywordTokenType("while"),
  _with: new KeywordTokenType("with"),
  _new: new KeywordTokenType("new"),
  _this: new KeywordTokenType("this"),
  _super: new KeywordTokenType("super"),
  _class: new KeywordTokenType("class"),
  _extends: new KeywordTokenType("extends"),
  _export: new KeywordTokenType("export"),
  _import: new KeywordTokenType("import"),
  _yield: new KeywordTokenType("yield"),
  _null: new KeywordTokenType("null"),
  _true: new KeywordTokenType("true"),
  _false: new KeywordTokenType("false"),
  _in: new KeywordTokenType("in", {binop: 7}),
  _instanceof: new KeywordTokenType("instanceof", {binop: 7}),
  _typeof: new KeywordTokenType("typeof", {prefix}),
  _void: new KeywordTokenType("void", {prefix}),
  _delete: new KeywordTokenType("delete", {prefix}),

  // Other keywords
  _async: new KeywordTokenType("async"),
  _get: new KeywordTokenType("get"),
  _set: new KeywordTokenType("set"),

  // TypeScript keywords
  _declare: new KeywordTokenType("declare"),
  _readonly: new KeywordTokenType("readonly"),
  _abstract: new KeywordTokenType("abstract"),
  _static: new KeywordTokenType("static"),
  _public: new KeywordTokenType("public"),
  _private: new KeywordTokenType("private"),
  _protected: new KeywordTokenType("protected"),
  _as: new KeywordTokenType("as"),
  _enum: new KeywordTokenType("enum"),
  _type: new KeywordTokenType("type"),
  _implements: new KeywordTokenType("implements"),
};

export const keywords = {
  break: types._break,
  case: types._case,
  catch: types._catch,
  continue: types._continue,
  debugger: types._debugger,
  default: types._default,
  do: types._do,
  else: types._else,
  finally: types._finally,
  for: types._for,
  function: types._function,
  if: types._if,
  return: types._return,
  switch: types._switch,
  throw: types._throw,
  try: types._try,
  var: types._var,
  let: types._let,
  const: types._const,
  while: types._while,
  with: types._with,
  new: types._new,
  this: types._this,
  super: types._super,
  class: types._class,
  extends: types._extends,
  export: types._export,
  import: types._import,
  yield: types._yield,
  null: types._null,
  true: types._true,
  false: types._false,
  in: types._in,
  instanceof: types._instanceof,
  typeof: types._typeof,
  void: types._void,
  delete: types._delete,

  // Other keywords
  async: types._async,
  get: types._get,
  set: types._set,

  // TypeScript keywords
  declare: types._declare,
  readonly: types._readonly,
  abstract: types._abstract,
  static: types._static,
  public: types._public,
  private: types._private,
  protected: types._protected,
  as: types._as,
  enum: types._enum,
  type: types._type,
  implements: types._implements,
};
