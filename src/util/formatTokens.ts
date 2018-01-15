import LinesAndColumns from "lines-and-columns";
import {Token} from "../../sucrase-babylon/tokenizer";

export default function formatTokens(code: string, tokens: Array<Token>): string {
  if (tokens.length === 0) {
    return "";
  }

  const tokenKeys = Object.keys(tokens[0]).filter(
    (k) => k !== "type" && k !== "value" && k !== "start" && k !== "end" && k !== "loc",
  );
  const typeKeys = Object.keys(tokens[0].type).filter(
    (k) => k !== "updateContext" && k !== "label" && k !== "keyword",
  );

  const headings = ["Location", "Label", "Value", ...tokenKeys, ...typeKeys];

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
      token.value != null ? truncate(String(token.value), 14) : "",
      ...tokenKeys.map((key) => formatValue(token[key], key)),
      ...typeKeys.map((key) => formatValue(token.type[key], key)),
    ];
  }

  // tslint:disable-next-line no-any
  function formatValue(value: any, key: string): string {
    if (value === true) {
      return key;
    } else if (value === false || value === null) {
      return "";
    } else {
      return String(value);
    }
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
