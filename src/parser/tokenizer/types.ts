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
  preIncDec = 15744, // ++/-- prefix postfix
  postIncDec = 16256, // ++/-- prefix postfix
  bang = 16512, // ! prefix
  tilde = 17024, // ~ prefix
  pipeline = 17409, // |> prec:1
  nullishCoalescing = 17922, // ?? prec:2
  logicalOR = 18435, // || prec:3
  logicalAND = 18948, // && prec:4
  bitwiseOR = 19461, // | prec:5
  bitwiseXOR = 19974, // ^ prec:6
  bitwiseAND = 20487, // & prec:7
  equality = 21000, // ==/!= prec:8
  lessThan = 21513, // < prec:9
  greaterThan = 22025, // > prec:9
  relationalOrEqual = 22537, // <=/>= prec:9
  bitShift = 23050, // <</>> prec:10
  plus = 23691, // + prec:11 prefix
  minus = 24203, // - prec:11 prefix
  modulo = 24588, // % prec:12
  star = 25100, // * prec:12
  slash = 25612, // / prec:12
  exponent = 26189, // ** prec:13 rightAssociative
  jsxName = 26624, // jsxName
  jsxText = 27136, // jsxText
  jsxTagStart = 27648, // jsxTagStart
  jsxTagEnd = 28160, // jsxTagEnd
  typeParameterStart = 28672, // typeParameterStart
  nonNullAssertion = 29184, // nonNullAssertion
  _break = 29712, // break keyword
  _case = 30224, // case keyword
  _catch = 30736, // catch keyword
  _continue = 31248, // continue keyword
  _debugger = 31760, // debugger keyword
  _default = 32272, // default keyword
  _do = 32784, // do keyword
  _else = 33296, // else keyword
  _finally = 33808, // finally keyword
  _for = 34320, // for keyword
  _function = 34832, // function keyword
  _if = 35344, // if keyword
  _return = 35856, // return keyword
  _switch = 36368, // switch keyword
  _throw = 37008, // throw keyword prefix
  _try = 37392, // try keyword
  _var = 37904, // var keyword
  _let = 38416, // let keyword
  _const = 38928, // const keyword
  _while = 39440, // while keyword
  _with = 39952, // with keyword
  _new = 40464, // new keyword
  _this = 40976, // this keyword
  _super = 41488, // super keyword
  _class = 42000, // class keyword
  _extends = 42512, // extends keyword
  _export = 43024, // export keyword
  _import = 43536, // import keyword
  _yield = 44048, // yield keyword
  _null = 44560, // null keyword
  _true = 45072, // true keyword
  _false = 45584, // false keyword
  _in = 46105, // in prec:9 keyword
  _instanceof = 46617, // instanceof prec:9 keyword
  _typeof = 47248, // typeof keyword prefix
  _void = 47760, // void keyword prefix
  _delete = 48272, // delete keyword prefix
  _async = 48656, // async keyword
  _get = 49168, // get keyword
  _set = 49680, // set keyword
  _declare = 50192, // declare keyword
  _readonly = 50704, // readonly keyword
  _abstract = 51216, // abstract keyword
  _static = 51728, // static keyword
  _public = 52240, // public keyword
  _private = 52752, // private keyword
  _protected = 53264, // protected keyword
  _as = 53776, // as keyword
  _enum = 54288, // enum keyword
  _type = 54800, // type keyword
  _implements = 55312, // implements keyword
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
