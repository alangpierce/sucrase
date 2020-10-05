const isAssign = true;
const prefix = true;
const postfix = true;

interface TokenOptions {
  keyword?: string;
  rightAssociative?: boolean;
  isAssign?: boolean;
  prefix?: boolean;
  postfix?: boolean;
  binop?: number;
}

class TokenType {
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

class KeywordTokenType extends TokenType {
  constructor(name: string, options: TokenOptions = {}) {
    options.keyword = name;

    super(name, options);
  }
}

class BinopTokenType extends TokenType {
  constructor(name: string, prec: number) {
    super(name, {binop: prec});
  }
}

const types = {
  num: new TokenType("num"),
  bigint: new TokenType("bigint"),
  decimal: new TokenType("decimal"),
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

  eq: new TokenType("=", {isAssign}),
  assign: new TokenType("_=", {isAssign}),
  // Mark the token as either prefix or postfix for the parser; we later assign
  // based on what we find.
  preIncDec: new TokenType("++/--", {prefix, postfix}),
  postIncDec: new TokenType("++/--", {prefix, postfix}),
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
  plus: new TokenType("+", {binop: 9, prefix}),
  minus: new TokenType("-", {binop: 9, prefix}),
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

export default function generateTokenTypes(): string {
  let code = '// Generated file, do not edit! Run "yarn generate" to re-generate this file.\n';
  code += generateTokenTypeEnum();
  code += generateFormatTokenType();
  return code;
}

function generateTokenTypeEnum(): string {
  let code = `\
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

`;
  // Precedence 0 means not an operator; otherwise it is a positive number up to 12.
  const PRECEDENCE_UNIT = 1;
  const IS_KEYWORD = 1 << 4;
  const IS_ASSIGN = 1 << 5;
  const IS_RIGHT_ASSOCIATIVE = 1 << 6;
  const IS_PREFIX = 1 << 7;
  const IS_POSTFIX = 1 << 8;
  const TOKEN_INDEX = 1 << 9;

  let count = 0;
  for (const [name, tokenType] of Object.entries(types)) {
    let value = 0;
    const descriptions = [tokenType.label];
    value += count * TOKEN_INDEX;
    if (tokenType.binop !== null) {
      // Unspecified precedence is 0, so we need to start from 1.
      value |= PRECEDENCE_UNIT * (tokenType.binop + 1);
      descriptions.push(`prec:${tokenType.binop + 1}`);
    }
    if (tokenType.keyword) {
      value |= IS_KEYWORD;
      descriptions.push("keyword");
    }
    if (tokenType.isAssign) {
      value |= IS_ASSIGN;
      descriptions.push("isAssign");
    }
    if (tokenType.rightAssociative) {
      value |= IS_RIGHT_ASSOCIATIVE;
      descriptions.push("rightAssociative");
    }
    if (tokenType.prefix) {
      value |= IS_PREFIX;
      descriptions.push("prefix");
    }
    if (tokenType.postfix) {
      value |= IS_POSTFIX;
      descriptions.push("postfix");
    }
    code += `  ${name} = ${value}, // ${descriptions.join(" ")}\n`;
    count++;
  }
  code += "}\n";
  return code;
}

function generateFormatTokenType(): string {
  let code = `\
export function formatTokenType(tokenType: TokenType): string {
  switch (tokenType) {
`;
  for (const [name, tokenType] of Object.entries(types)) {
    code += `\
    case TokenType.${name}:
      return "${tokenType.label}";
`;
  }
  code += `\
    default:
      return "";
  }
}
`;
  return code;
}
