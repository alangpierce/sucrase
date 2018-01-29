// ## Token types

// The assignment of fine-grained, information-carrying type objects
// allows the tokenizer to store the information it has about a
// token in a way that is very cheap for the parser to look up.

// All token type variables start with an underscore, to make them
// easy to recognize.

export const enum TokenType {
  // Flags and bitmasks.
  PRECEDENCE_MASK = 0xf,
  // Precedence 0 means not an operator; otherwise it is a positive number up to 12.
  PRECEDENCE_UNIT = 1,
  IS_KEYWORD = 1 << 4,
  IS_ASSIGN = 1 << 5,
  IS_RIGHT_ASSOCIATIVE = 1 << 6,
  IS_PREFIX = 1 << 7,
  IS_POSTFIX = 1 << 8,
  TOK_TYPE = 1 << 9,

  // Actual token values.
  num = TOK_TYPE * 0,
  bigint = TOK_TYPE * 1,
  regexp = TOK_TYPE * 2,
  string = TOK_TYPE * 3,
  name = TOK_TYPE * 4,
  eof = TOK_TYPE * 5,

  // Punctuation token types.
  bracketL = TOK_TYPE * 6,
  bracketR = TOK_TYPE * 7,
  braceL = TOK_TYPE * 8,
  braceBarL = TOK_TYPE * 9,
  braceR = TOK_TYPE * 10,
  braceBarR = TOK_TYPE * 11,
  parenL = TOK_TYPE * 12,
  parenR = TOK_TYPE * 13,
  comma = TOK_TYPE * 14,
  semi = TOK_TYPE * 15,
  colon = TOK_TYPE * 16,
  doubleColon = TOK_TYPE * 17,
  dot = TOK_TYPE * 18,
  question = TOK_TYPE * 19,
  questionDot = TOK_TYPE * 20,
  arrow = TOK_TYPE * 21,
  template = TOK_TYPE * 22,
  ellipsis = TOK_TYPE * 23,
  backQuote = TOK_TYPE * 24,
  dollarBraceL = TOK_TYPE * 25,
  at = TOK_TYPE * 26,
  hash = TOK_TYPE * 27,

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

  eq = (TOK_TYPE * 28) | IS_ASSIGN,
  assign = (TOK_TYPE * 29) | IS_ASSIGN,
  incDec = (TOK_TYPE * 30) | IS_PREFIX | IS_POSTFIX,
  bang = (TOK_TYPE * 31) | IS_PREFIX,
  tilde = (TOK_TYPE * 32) | IS_PREFIX,
  pipeline = (TOK_TYPE * 33) | (PRECEDENCE_UNIT * 1),
  nullishCoalescing = (TOK_TYPE * 34) | (PRECEDENCE_UNIT * 2),
  logicalOR = (TOK_TYPE * 35) | (PRECEDENCE_UNIT * 2),
  logicalAND = (TOK_TYPE * 36) | (PRECEDENCE_UNIT * 3),
  bitwiseOR = (TOK_TYPE * 37) | (PRECEDENCE_UNIT * 4),
  bitwiseXOR = (TOK_TYPE * 38) | (PRECEDENCE_UNIT * 5),
  bitwiseAND = (TOK_TYPE * 39) | (PRECEDENCE_UNIT * 6),
  equality = (TOK_TYPE * 40) | (PRECEDENCE_UNIT * 7),
  lessThan = (TOK_TYPE * 41) | (PRECEDENCE_UNIT * 8),
  greaterThan = (TOK_TYPE * 42) | (PRECEDENCE_UNIT * 8),
  relationalOrEqual = (TOK_TYPE * 43) | (PRECEDENCE_UNIT * 8),
  bitShift = (TOK_TYPE * 44) | (PRECEDENCE_UNIT * 9),
  plusMin = (TOK_TYPE * 45) | (PRECEDENCE_UNIT * 10) | IS_PREFIX,
  modulo = (TOK_TYPE * 46) | (PRECEDENCE_UNIT * 11),
  star = (TOK_TYPE * 47) | (PRECEDENCE_UNIT * 11),
  slash = (TOK_TYPE * 48) | (PRECEDENCE_UNIT * 11),
  exponent = (TOK_TYPE * 49) | (PRECEDENCE_UNIT * 12) | IS_RIGHT_ASSOCIATIVE,

  jsxName = TOK_TYPE * 50,
  jsxText = TOK_TYPE * 51,
  jsxTagStart = TOK_TYPE * 52,
  jsxTagEnd = TOK_TYPE * 53,
  typeParameterStart = TOK_TYPE * 54,
  nonNullAssertion = TOK_TYPE * 55,

  // keywords
  _break = (TOK_TYPE * 56) | IS_KEYWORD,
  _case = (TOK_TYPE * 57) | IS_KEYWORD,
  _catch = (TOK_TYPE * 58) | IS_KEYWORD,
  _continue = (TOK_TYPE * 59) | IS_KEYWORD,
  _debugger = (TOK_TYPE * 60) | IS_KEYWORD,
  _default = (TOK_TYPE * 61) | IS_KEYWORD,
  _do = (TOK_TYPE * 62) | IS_KEYWORD,
  _else = (TOK_TYPE * 63) | IS_KEYWORD,
  _finally = (TOK_TYPE * 64) | IS_KEYWORD,
  _for = (TOK_TYPE * 65) | IS_KEYWORD,
  _function = (TOK_TYPE * 66) | IS_KEYWORD,
  _if = (TOK_TYPE * 67) | IS_KEYWORD,
  _return = (TOK_TYPE * 68) | IS_KEYWORD,
  _switch = (TOK_TYPE * 69) | IS_KEYWORD,
  _throw = (TOK_TYPE * 70) | IS_KEYWORD | IS_PREFIX,
  _try = (TOK_TYPE * 71) | IS_KEYWORD,
  _var = (TOK_TYPE * 72) | IS_KEYWORD,
  _let = (TOK_TYPE * 73) | IS_KEYWORD,
  _const = (TOK_TYPE * 74) | IS_KEYWORD,
  _while = (TOK_TYPE * 75) | IS_KEYWORD,
  _with = (TOK_TYPE * 76) | IS_KEYWORD,
  _new = (TOK_TYPE * 77) | IS_KEYWORD,
  _this = (TOK_TYPE * 78) | IS_KEYWORD,
  _super = (TOK_TYPE * 79) | IS_KEYWORD,
  _class = (TOK_TYPE * 80) | IS_KEYWORD,
  _extends = (TOK_TYPE * 81) | IS_KEYWORD,
  _export = (TOK_TYPE * 82) | IS_KEYWORD,
  _import = (TOK_TYPE * 83) | IS_KEYWORD,
  _yield = (TOK_TYPE * 84) | IS_KEYWORD,
  _null = (TOK_TYPE * 85) | IS_KEYWORD,
  _true = (TOK_TYPE * 86) | IS_KEYWORD,
  _false = (TOK_TYPE * 87) | IS_KEYWORD,
  _in = (TOK_TYPE * 88) | (PRECEDENCE_UNIT * 8) | IS_KEYWORD,
  _instanceof = (TOK_TYPE * 89) | (PRECEDENCE_UNIT * 8) | IS_KEYWORD,
  _typeof = (TOK_TYPE * 90) | IS_KEYWORD | IS_PREFIX,
  _void = (TOK_TYPE * 91) | IS_KEYWORD | IS_PREFIX,
  _delete = (TOK_TYPE * 92) | IS_KEYWORD | IS_PREFIX,

  // Other keywords
  _async = TOK_TYPE * 93,
  _get = TOK_TYPE * 94,
  _set = TOK_TYPE * 95,

  // TypeScript keywords
  _declare = TOK_TYPE * 96,
  _readonly = TOK_TYPE * 97,
  _abstract = TOK_TYPE * 98,
  _static = TOK_TYPE * 99,
  _public = TOK_TYPE * 100,
  _private = TOK_TYPE * 101,
  _protected = TOK_TYPE * 102,
  _as = TOK_TYPE * 103,
  _enum = TOK_TYPE * 104,
  _type = TOK_TYPE * 105,
  _implements = TOK_TYPE * 106,
}

export const keywords = {
  break: TokenType._break,
  case: TokenType._case,
  catch: TokenType._catch,
  continue: TokenType._continue,
  debugger: TokenType._debugger,
  default: TokenType._default,
  do: TokenType._do,
  else: TokenType._else,
  finally: TokenType._finally,
  for: TokenType._for,
  function: TokenType._function,
  if: TokenType._if,
  return: TokenType._return,
  switch: TokenType._switch,
  throw: TokenType._throw,
  try: TokenType._try,
  var: TokenType._var,
  let: TokenType._let,
  const: TokenType._const,
  while: TokenType._while,
  with: TokenType._with,
  new: TokenType._new,
  this: TokenType._this,
  super: TokenType._super,
  class: TokenType._class,
  extends: TokenType._extends,
  export: TokenType._export,
  import: TokenType._import,
  yield: TokenType._yield,
  null: TokenType._null,
  true: TokenType._true,
  false: TokenType._false,
  in: TokenType._in,
  instanceof: TokenType._instanceof,
  typeof: TokenType._typeof,
  void: TokenType._void,
  delete: TokenType._delete,

  // Other keywords
  async: TokenType._async,
  get: TokenType._get,
  set: TokenType._set,

  // TypeScript keywords
  declare: TokenType._declare,
  readonly: TokenType._readonly,
  abstract: TokenType._abstract,
  static: TokenType._static,
  public: TokenType._public,
  private: TokenType._private,
  protected: TokenType._protected,
  as: TokenType._as,
  enum: TokenType._enum,
  type: TokenType._type,
  implements: TokenType._implements,
};

/**
 * String form of each token type, only used for things like error messages.
 */
export function formatTokenType(tokenType: TokenType): string {
  switch (tokenType) {
    case TokenType.num:
      return "num";
    case TokenType.bigint:
      return "bigint";
    case TokenType.regexp:
      return "regexp";
    case TokenType.string:
      return "string";
    case TokenType.name:
      return "name";
    case TokenType.eof:
      return "eof";
    case TokenType.bracketL:
      return "[";
    case TokenType.bracketR:
      return "]";
    case TokenType.braceL:
      return "{";
    case TokenType.braceBarL:
      return "{|";
    case TokenType.braceR:
      return "}";
    case TokenType.braceBarR:
      return "|}";
    case TokenType.parenL:
      return "(";
    case TokenType.parenR:
      return ")";
    case TokenType.comma:
      return ",";
    case TokenType.semi:
      return ";";
    case TokenType.colon:
      return ":";
    case TokenType.doubleColon:
      return "::";
    case TokenType.dot:
      return ".";
    case TokenType.question:
      return "?";
    case TokenType.questionDot:
      return "?.";
    case TokenType.arrow:
      return "=>";
    case TokenType.template:
      return "template";
    case TokenType.ellipsis:
      return "...";
    case TokenType.backQuote:
      return "`";
    case TokenType.dollarBraceL:
      return "${";
    case TokenType.at:
      return "@";
    case TokenType.hash:
      return "$";
    case TokenType.eq:
      return "=";
    case TokenType.assign:
      return "_=";
    case TokenType.incDec:
      return "++/--";
    case TokenType.bang:
      return "!";
    case TokenType.tilde:
      return "~";
    case TokenType.pipeline:
      return "|>";
    case TokenType.nullishCoalescing:
      return "??";
    case TokenType.logicalOR:
      return "||";
    case TokenType.logicalAND:
      return "&&";
    case TokenType.bitwiseOR:
      return "|";
    case TokenType.bitwiseXOR:
      return "^";
    case TokenType.bitwiseAND:
      return "&";
    case TokenType.equality:
      return "==/!=";
    case TokenType.lessThan:
      return "<";
    case TokenType.greaterThan:
      return ">";
    case TokenType.relationalOrEqual:
      return "<=/>=";
    case TokenType.bitShift:
      return "<</>>";
    case TokenType.plusMin:
      return "+/-";
    case TokenType.modulo:
      return "%";
    case TokenType.star:
      return "*";
    case TokenType.slash:
      return "/";
    case TokenType.exponent:
      return "**";
    case TokenType.jsxName:
      return "jsxName";
    case TokenType.jsxText:
      return "jsxText";
    case TokenType.jsxTagStart:
      return "jsxTagStart";
    case TokenType.jsxTagEnd:
      return "jsxTagEnd";
    case TokenType.typeParameterStart:
      return "typeParameterStart";
    case TokenType.nonNullAssertion:
      return "nonNullAssertion";
    case TokenType._break:
      return "break";
    case TokenType._case:
      return "case";
    case TokenType._catch:
      return "catch";
    case TokenType._continue:
      return "continue";
    case TokenType._debugger:
      return "debugger";
    case TokenType._default:
      return "default";
    case TokenType._do:
      return "do";
    case TokenType._else:
      return "else";
    case TokenType._finally:
      return "finally";
    case TokenType._for:
      return "for";
    case TokenType._function:
      return "function";
    case TokenType._if:
      return "if";
    case TokenType._return:
      return "return";
    case TokenType._switch:
      return "switch";
    case TokenType._throw:
      return "throw";
    case TokenType._try:
      return "try";
    case TokenType._var:
      return "var";
    case TokenType._let:
      return "let";
    case TokenType._const:
      return "const";
    case TokenType._while:
      return "while";
    case TokenType._with:
      return "with";
    case TokenType._new:
      return "new";
    case TokenType._this:
      return "this";
    case TokenType._super:
      return "super";
    case TokenType._class:
      return "class";
    case TokenType._extends:
      return "extends";
    case TokenType._export:
      return "export";
    case TokenType._import:
      return "import";
    case TokenType._yield:
      return "yield";
    case TokenType._null:
      return "null";
    case TokenType._true:
      return "true";
    case TokenType._false:
      return "false";
    case TokenType._in:
      return "in";
    case TokenType._instanceof:
      return "instanceof";
    case TokenType._typeof:
      return "typeof";
    case TokenType._void:
      return "void";
    case TokenType._delete:
      return "delete";
    case TokenType._async:
      return "async";
    case TokenType._get:
      return "get";
    case TokenType._set:
      return "set";
    case TokenType._declare:
      return "declare";
    case TokenType._readonly:
      return "readonly";
    case TokenType._abstract:
      return "abstract";
    case TokenType._static:
      return "static";
    case TokenType._public:
      return "public";
    case TokenType._private:
      return "private";
    case TokenType._protected:
      return "protected";
    case TokenType._as:
      return "as";
    case TokenType._enum:
      return "enum";
    case TokenType._type:
      return "type";
    case TokenType._implements:
      return "implements";
    default:
      return "";
  }
}
