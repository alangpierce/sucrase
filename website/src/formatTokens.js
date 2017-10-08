export default function formatTokens(tokens) {
  return tokens.map(token => {
    let type = token.type;
    if (type.label) {
      type = type.label;
    }
    const valueStr = token.value ? `: ${token.value}` : '';
    return `${type}${valueStr} (${formatRange(token.loc)})`;
  }).join('\n');
}

function formatRange({start, end}) {
  return `${formatPos(start)}-${formatPos(end)}`;
}

function formatPos({line, column}) {
  return `${line}:${column}`;
}
