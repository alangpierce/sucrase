// Generated file, do not edit! Run "yarn generate" to re-generate this file.
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

  num = 0, // num
  bigint = 512, // bigint
  regexp = 1024, // regexp
  string = 1536, // string
  name = 2048, // name
  eof = 2560, // eof
  bracketL = 3072, // [
  bracketR = 3584, // ]
  braceL = 4096, // {
  braceBarL = 4608, // {|
  braceR = 5120, // }
  braceBarR = 5632, // |}
  parenL = 6144, // (
  parenR = 6656, // )
  comma = 7168, // ,
  semi = 7680, // ;
  colon = 8192, // :
  doubleColon = 8704, // ::
  dot = 9216, // .
  question = 9728, // ?
  questionDot = 10240, // ?.
  arrow = 10752, // =>
  template = 11264, // template
  ellipsis = 11776, // ...
  backQuote = 12288, // `
  dollarBraceL = 12800, // ${
  at = 13312, // @
  hash = 13824, // #
  eq = 14368, // = isAssign
  assign = 14880, // _= isAssign
  incDec = 15744, // ++/-- prefix postfix
  bang = 16000, // ! prefix
  tilde = 16512, // ~ prefix
  pipeline = 16897, // |> prec:1
  nullishCoalescing = 17410, // ?? prec:2
  logicalOR = 17922, // || prec:2
  logicalAND = 18435, // && prec:3
  bitwiseOR = 18948, // | prec:4
  bitwiseXOR = 19461, // ^ prec:5
  bitwiseAND = 19974, // & prec:6
  equality = 20487, // ==/!= prec:7
  lessThan = 21000, // < prec:8
  greaterThan = 21512, // > prec:8
  relationalOrEqual = 22024, // <=/>= prec:8
  bitShift = 22537, // <</>> prec:9
  plus = 23178, // + prec:10 prefix
  minus = 23690, // - prec:10 prefix
  modulo = 24075, // % prec:11
  star = 24587, // * prec:11
  slash = 25099, // / prec:11
  exponent = 25676, // ** prec:12 rightAssociative
  jsxName = 26112, // jsxName
  jsxText = 26624, // jsxText
  jsxTagStart = 27136, // jsxTagStart
  jsxTagEnd = 27648, // jsxTagEnd
  typeParameterStart = 28160, // typeParameterStart
  nonNullAssertion = 28672, // nonNullAssertion
  _break = 29200, // break keyword
  _case = 29712, // case keyword
  _catch = 30224, // catch keyword
  _continue = 30736, // continue keyword
  _debugger = 31248, // debugger keyword
  _default = 31760, // default keyword
  _do = 32272, // do keyword
  _else = 32784, // else keyword
  _finally = 33296, // finally keyword
  _for = 33808, // for keyword
  _function = 34320, // function keyword
  _if = 34832, // if keyword
  _return = 35344, // return keyword
  _switch = 35856, // switch keyword
  _throw = 36496, // throw keyword prefix
  _try = 36880, // try keyword
  _var = 37392, // var keyword
  _let = 37904, // let keyword
  _const = 38416, // const keyword
  _while = 38928, // while keyword
  _with = 39440, // with keyword
  _new = 39952, // new keyword
  _this = 40464, // this keyword
  _super = 40976, // super keyword
  _class = 41488, // class keyword
  _extends = 42000, // extends keyword
  _export = 42512, // export keyword
  _import = 43024, // import keyword
  _yield = 43536, // yield keyword
  _null = 44048, // null keyword
  _true = 44560, // true keyword
  _false = 45072, // false keyword
  _in = 45592, // in prec:8 keyword
  _instanceof = 46104, // instanceof prec:8 keyword
  _typeof = 46736, // typeof keyword prefix
  _void = 47248, // void keyword prefix
  _delete = 47760, // delete keyword prefix
  _async = 48144, // async keyword
  _get = 48656, // get keyword
  _set = 49168, // set keyword
  _declare = 49680, // declare keyword
  _readonly = 50192, // readonly keyword
  _abstract = 50704, // abstract keyword
  _static = 51216, // static keyword
  _public = 51728, // public keyword
  _private = 52240, // private keyword
  _protected = 52752, // protected keyword
  _as = 53264, // as keyword
  _enum = 53776, // enum keyword
  _type = 54288, // type keyword
  _implements = 54800, // implements keyword
}
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
      return "#";
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
