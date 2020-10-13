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
  decimal = 1024, // decimal
  regexp = 1536, // regexp
  string = 2048, // string
  name = 2560, // name
  eof = 3072, // eof
  bracketL = 3584, // [
  bracketR = 4096, // ]
  braceL = 4608, // {
  braceBarL = 5120, // {|
  braceR = 5632, // }
  braceBarR = 6144, // |}
  parenL = 6656, // (
  parenR = 7168, // )
  comma = 7680, // ,
  semi = 8192, // ;
  colon = 8704, // :
  doubleColon = 9216, // ::
  dot = 9728, // .
  question = 10240, // ?
  questionDot = 10752, // ?.
  arrow = 11264, // =>
  template = 11776, // template
  ellipsis = 12288, // ...
  backQuote = 12800, // `
  dollarBraceL = 13312, // ${
  at = 13824, // @
  hash = 14336, // #
  eq = 14880, // = isAssign
  assign = 15392, // _= isAssign
  preIncDec = 16256, // ++/-- prefix postfix
  postIncDec = 16768, // ++/-- prefix postfix
  bang = 17024, // ! prefix
  tilde = 17536, // ~ prefix
  pipeline = 17921, // |> prec:1
  nullishCoalescing = 18434, // ?? prec:2
  logicalOR = 18946, // || prec:2
  logicalAND = 19459, // && prec:3
  bitwiseOR = 19972, // | prec:4
  bitwiseXOR = 20485, // ^ prec:5
  bitwiseAND = 20998, // & prec:6
  equality = 21511, // ==/!= prec:7
  lessThan = 22024, // < prec:8
  greaterThan = 22536, // > prec:8
  relationalOrEqual = 23048, // <=/>= prec:8
  bitShift = 23561, // <</>> prec:9
  plus = 24202, // + prec:10 prefix
  minus = 24714, // - prec:10 prefix
  modulo = 25099, // % prec:11
  star = 25611, // * prec:11
  slash = 26123, // / prec:11
  exponent = 26700, // ** prec:12 rightAssociative
  jsxName = 27136, // jsxName
  jsxText = 27648, // jsxText
  jsxTagStart = 28160, // jsxTagStart
  jsxTagEnd = 28672, // jsxTagEnd
  typeParameterStart = 29184, // typeParameterStart
  nonNullAssertion = 29696, // nonNullAssertion
  _break = 30224, // break keyword
  _case = 30736, // case keyword
  _catch = 31248, // catch keyword
  _continue = 31760, // continue keyword
  _debugger = 32272, // debugger keyword
  _default = 32784, // default keyword
  _do = 33296, // do keyword
  _else = 33808, // else keyword
  _finally = 34320, // finally keyword
  _for = 34832, // for keyword
  _function = 35344, // function keyword
  _if = 35856, // if keyword
  _return = 36368, // return keyword
  _switch = 36880, // switch keyword
  _throw = 37520, // throw keyword prefix
  _try = 37904, // try keyword
  _var = 38416, // var keyword
  _let = 38928, // let keyword
  _const = 39440, // const keyword
  _while = 39952, // while keyword
  _with = 40464, // with keyword
  _new = 40976, // new keyword
  _this = 41488, // this keyword
  _super = 42000, // super keyword
  _class = 42512, // class keyword
  _extends = 43024, // extends keyword
  _export = 43536, // export keyword
  _import = 44048, // import keyword
  _yield = 44560, // yield keyword
  _null = 45072, // null keyword
  _true = 45584, // true keyword
  _false = 46096, // false keyword
  _in = 46616, // in prec:8 keyword
  _instanceof = 47128, // instanceof prec:8 keyword
  _typeof = 47760, // typeof keyword prefix
  _void = 48272, // void keyword prefix
  _delete = 48784, // delete keyword prefix
  _async = 49168, // async keyword
  _get = 49680, // get keyword
  _set = 50192, // set keyword
  _declare = 50704, // declare keyword
  _readonly = 51216, // readonly keyword
  _abstract = 51728, // abstract keyword
  _static = 52240, // static keyword
  _public = 52752, // public keyword
  _private = 53264, // private keyword
  _protected = 53776, // protected keyword
  _as = 54288, // as keyword
  _enum = 54800, // enum keyword
  _type = 55312, // type keyword
  _implements = 55824, // implements keyword
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
