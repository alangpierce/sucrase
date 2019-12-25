import {charCodes} from "../src/parser/util/charcodes";

const KEYWORDS = [
  "break",
  "case",
  "catch",
  "continue",
  "debugger",
  "default",
  "do",
  "else",
  "finally",
  "for",
  "function",
  "if",
  "return",
  "switch",
  "throw",
  "try",
  "var",
  "while",
  "with",
  "null",
  "true",
  "false",
  "instanceof",
  "typeof",
  "void",
  "delete",
  "new",
  "in",
  "this",
  "let",
  "const",
  "class",
  "extends",
  "export",
  "import",
  "yield",
  "super",
];

const CONTEXTUAL_KEYWORDS = [
  "abstract",
  "as",
  "asserts",
  "async",
  "await",
  "checks",
  "constructor",
  "declare",
  "enum",
  "exports",
  "from",
  "get",
  "global",
  "implements",
  "infer",
  "interface",
  "is",
  "keyof",
  "mixins",
  "module",
  "namespace",
  "of",
  "opaque",
  "private",
  "protected",
  "proto",
  "public",
  "readonly",
  "require",
  "set",
  "static",
  "type",
  "unique",
];

const CODE = `\
// Generated file, do not edit! Run "yarn generate" to re-generate this file.
import {ContextualKeyword} from "./keywords";
import {TokenType as tt} from "./types";

// prettier-ignore
export const READ_WORD_TREE = new Int32Array([
$CONTENTS
]);
`;

interface Keyword {
  name: string;
  isContextual: boolean;
}

interface Node {
  prefix: string;
  data: Array<number | string>;
  start: number;
}

const ALL_KEYWORDS: Array<Keyword> = [
  ...KEYWORDS.map((name) => ({name, isContextual: false})),
  ...CONTEXTUAL_KEYWORDS.map((name) => ({name, isContextual: true})),
];

export default function generateReadWordTree(): string {
  const prefixes = new Set<string>();
  for (const {name} of ALL_KEYWORDS) {
    for (let i = 0; i < name.length + 1; i++) {
      prefixes.add(name.slice(0, i));
    }
  }

  const nodesByPrefix: {[prefix: string]: Node} = {};
  const nodes = [...prefixes].sort().map((prefix, i) => {
    const data = [];
    for (let j = 0; j < 27; j++) {
      data.push(-1);
    }
    const node = {prefix, data, start: i * 27};
    nodesByPrefix[prefix] = node;
    return node;
  });

  for (const {name, isContextual} of ALL_KEYWORDS) {
    // Fill in first index.
    const keywordNode = nodesByPrefix[name];
    if (isContextual) {
      keywordNode.data[0] = `ContextualKeyword._${name} << 1`;
    } else {
      keywordNode.data[0] = `(tt._${name} << 1) + 1`;
    }

    // The later indices are transitions by lowercase letter.
    for (let i = 0; i < name.length; i++) {
      const node = nodesByPrefix[name.slice(0, i)];
      const nextNode = nodesByPrefix[name.slice(0, i + 1)];
      node.data[name.charCodeAt(i) - charCodes.lowercaseA + 1] = nextNode.start;
    }
  }

  return CODE.replace(
    "$CONTENTS",
    nodes
      .map(
        ({prefix, data}) => `\
  // "${prefix}"
  ${data.map((datum) => `${datum},`).join(" ")}`,
      )
      .join("\n"),
  );
}
