import LinesAndColumns from "lines-and-columns";

import {Token} from "../TokenProcessor";

export default function formatTokens(code: string, tokens: Array<Token>): string {
  const lines = new LinesAndColumns(code);

  function formatRange(start: number, end: number): string {
    return `${formatPos(start)}-${formatPos(end)}`;
  }

  function formatPos(pos: number): string {
    const location = lines.locationForIndex(pos);
    if (!location) {
      return "[Unknown position]";
    } else {
      return `${location.line + 1}:${location.column + 1}`;
    }
  }

  return tokens
    .map((token) => {
      const type = token.type.label;
      const valueStr = token.value ? `: ${token.value}` : "";
      return `${type}${valueStr} (${formatRange(token.start, token.end)})`;
    })
    .join("\n");
}
