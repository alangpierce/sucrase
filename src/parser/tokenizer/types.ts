// Generated file, do not edit! Run "yarn generate" to re-generate this file.
/* istanbul ignore file */
/**
 * Enum of all token types, with bit fields to signify meaningful properties.
 */
export enum TokenType {
  // Precedence 0 means not an operator; otherwise it is a positive number up to 12.
  PRECEDENCE_MASK = 0xf,
  IS_KEYWORD = 1 << 4,
  IS_ASSIGN = 1 << 5,
  IS_RIGHT_ASSOCIATIVE = 1 << 6,
  IS_PREFIX = 1 << 7,
  IS_POSTFIX = 1 << 8,
  IS_EXPRESSION_START = 1 << 9,

  num = 512, // num startsExpr
  bigint = 1536, // bigint startsExpr
  decimal = 2560, // decimal startsExpr
  regexp = 3584, // regexp startsExpr
  string = 4608, // string startsExpr
  name = 5632, // name startsExpr
  eof = 6144, // eof
  bracketL = 7680, // [ startsExpr
  bracketR = 8192, // ]
  braceL = 9728, // { startsExpr
  braceBarL = 10752, // {| startsExpr
  braceR = 11264, // }
  braceBarR = 12288, // |}
  parenL = 13824, // ( startsExpr
  parenR = 14336, // )
  comma = 15360, // ,
  semi = 16384, // ;
  colon = 17408, // :
  doubleColon = 18432, // ::
  dot = 19456, // .
  question = 20480, // ?
  questionDot = 21504, // ?.
  arrow = 22528, // =>
  template = 23552, // template
  ellipsis = 24576, // ...
  backQuote = 25600, // `
  dollarBraceL = 27136, // ${ startsExpr
  at = 27648, // @
  hash = 29184, // # startsExpr
  eq = 29728, // = isAssign
  assign = 30752, // _= isAssign
  preIncDec = 32640, // ++/-- prefix postfix startsExpr
  postIncDec = 33664, // ++/-- prefix postfix startsExpr
  bang = 34432, // ! prefix startsExpr
  tilde = 35456, // ~ prefix startsExpr
  pipeline = 35841, // |> prec:1
  nullishCoalescing = 36866, // ?? prec:2
  logicalOR = 37890, // || prec:2
  logicalAND = 38915, // && prec:3
  bitwiseOR = 39940, // | prec:4
  bitwiseXOR = 40965, // ^ prec:5
  bitwiseAND = 41990, // & prec:6
  equality = 43015, // ==/!= prec:7
  lessThan = 44040, // < prec:8
  greaterThan = 45064, // > prec:8
  relationalOrEqual = 46088, // <=/>= prec:8
  bitShiftL = 47113, // << prec:9
  bitShiftR = 48137, // >>/>>> prec:9
  plus = 49802, // + prec:10 prefix startsExpr
  minus = 50826, // - prec:10 prefix startsExpr
  modulo = 51723, // % prec:11 startsExpr
  star = 52235, // * prec:11
  slash = 53259, // / prec:11
  exponent = 54348, // ** prec:12 rightAssociative
  jsxName = 55296, // jsxName
  jsxText = 56320, // jsxText
  jsxTagStart = 57856, // jsxTagStart startsExpr
  jsxTagEnd = 58368, // jsxTagEnd
  typeParameterStart = 59904, // typeParameterStart startsExpr
  nonNullAssertion = 60416, // nonNullAssertion
  _break = 61456, // break keyword
  _case = 62480, // case keyword
  _catch = 63504, // catch keyword
  _continue = 64528, // continue keyword
  _debugger = 65552, // debugger keyword
  _default = 66576, // default keyword
  _do = 67600, // do keyword
  _else = 68624, // else keyword
  _finally = 69648, // finally keyword
  _for = 70672, // for keyword
  _function = 72208, // function keyword startsExpr
  _if = 72720, // if keyword
  _return = 73744, // return keyword
  _switch = 74768, // switch keyword
  _throw = 76432, // throw keyword prefix startsExpr
  _try = 76816, // try keyword
  _var = 77840, // var keyword
  _let = 78864, // let keyword
  _const = 79888, // const keyword
  _while = 80912, // while keyword
  _with = 81936, // with keyword
  _new = 83472, // new keyword startsExpr
  _this = 84496, // this keyword startsExpr
  _super = 85520, // super keyword startsExpr
  _class = 86544, // class keyword startsExpr
  _extends = 87056, // extends keyword
  _export = 88080, // export keyword
  _import = 89616, // import keyword startsExpr
  _yield = 90640, // yield keyword startsExpr
  _null = 91664, // null keyword startsExpr
  _true = 92688, // true keyword startsExpr
  _false = 93712, // false keyword startsExpr
  _in = 94232, // in prec:8 keyword
  _instanceof = 95256, // instanceof prec:8 keyword
  _typeof = 96912, // typeof keyword prefix startsExpr
  _void = 97936, // void keyword prefix startsExpr
  _delete = 98960, // delete keyword prefix startsExpr
  _async = 99856, // async keyword startsExpr
  _get = 100880, // get keyword startsExpr
  _set = 101904, // set keyword startsExpr
  _declare = 102928, // declare keyword startsExpr
  _readonly = 103952, // readonly keyword startsExpr
  _abstract = 104976, // abstract keyword startsExpr
  _static = 106000, // static keyword startsExpr
  _public = 106512, // public keyword
  _private = 107536, // private keyword
  _protected = 108560, // protected keyword
  _override = 109584, // override keyword
  _as = 111120, // as keyword startsExpr
  _enum = 112144, // enum keyword startsExpr
  _type = 113168, // type keyword startsExpr
  _implements = 114192, // implements keyword startsExpr
}
export function formatTokenType(tokenType: TokenType): string {
  switch (tokenType) {
    case TokenType.num:
      return "num";
    case TokenType.bigint:
      return "bigint";
    case TokenType.decimal:
      return "decimal";
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
      return "#";
    case TokenType.eq:
      return "=";
    case TokenType.assign:
      return "_=";
    case TokenType.preIncDec:
      return "++/--";
    case TokenType.postIncDec:
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
    case TokenType.bitShiftL:
      return "<<";
    case TokenType.bitShiftR:
      return ">>/>>>";
    case TokenType.plus:
      return "+";
    case TokenType.minus:
      return "-";
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
    case TokenType._override:
      return "override";
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
