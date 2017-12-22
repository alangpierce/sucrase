import * as babylon from 'babylon';

export default function getTokens(code) {
  try {
    const ast = babylon.parse(
      code,
      {tokens: true, sourceType: 'module', plugins: ['jsx', 'objectRestSpread']}
    );
    return formatTokens(ast.tokens);
  } catch (e) {
    return e.message;
  }
}

function formatTokens(tokens) {
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
