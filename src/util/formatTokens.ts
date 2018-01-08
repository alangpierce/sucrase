import LinesAndColumns from "lines-and-columns";
import {Token} from "../../sucrase-babylon/tokenizer";

export default function formatTokens(code: string, tokens: Array<Token>): string {
  if (tokens.length === 0) {
    return "";
  }

  const typeKeys = Object.keys(tokens[0].type).filter(
    (k) => k !== "updateContext" && k !== "label" && k !== "keyword",
  );

  const headings = ["Location", "Label", "Context", "Value", ...typeKeys];

  const lines = new LinesAndColumns(code);
  const rows = [headings, ...tokens.map(getTokenComponents)];
  const padding = headings.map(() => 0);
  for (const components of rows) {
    for (let i = 0; i < components.length; i++) {
      padding[i] = Math.max(padding[i], components[i].length);
    }
  }
  return rows
    .map((components) => components.map((component, i) => component.padEnd(padding[i])).join(" "))
    .join("\n");

  function getTokenComponents(token: Token): Array<string> {
    return [
      formatRange(token.start, token.end),
      token.type.label,
      `${token.contextName}(${token.contextStartIndex})`,
      token.value != null ? truncate(String(token.value), 14) : "",
      ...typeKeys.map((key) => {
        const value = token.type[key];
        if (value === true) {
          return key;
        } else if (value === false || value === null) {
          return "";
        } else {
          return String(value);
        }
      }),
    ];
  }

  function formatRange(start: number, end: number): string {
    return `${formatPos(start)}-${formatPos(end)}`;
  }

  function formatPos(pos: number): string {
    const location = lines.locationForIndex(pos);
    if (!location) {
      return "Unknown";
    } else {
      return `${location.line + 1}:${location.column + 1}`;
    }
  }
}

function truncate(s: string, length: number): string {
  if (s.length > length) {
    return `${s.slice(0, length - 3)}...`;
  } else {
    return s;
  }
}
