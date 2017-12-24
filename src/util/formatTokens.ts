import LinesAndColumns from "lines-and-columns";

import {Token} from "../TokenProcessor";

export default function formatTokens(code: string, tokens: Array<Token>): string {
  if (tokens.length === 0) {
    return "";
  }

  const lines = new LinesAndColumns(code);
  const allTokenComponents = tokens.map(getTokenComponents);
  const padding = allTokenComponents[0].map((t) => 0);
  for (const components of allTokenComponents) {
    for (let i = 0; i < components.length; i++) {
      padding[i] = Math.max(padding[i], components[i].length);
    }
  }
  return allTokenComponents
    .map((components) => components.map((component, i) => component.padEnd(padding[i])).join(" "))
    .join("\n");

  function getTokenComponents(token: Token): Array<string> {
    return [
      formatRange(token.start, token.end),
      token.type.label,
      `${token.contextName}(${token.contextStartIndex})`,
      token.value != null ? String(token.value) : "",
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
