import {tokenize} from 'babylon';

export default function transform(code: string): string {
  let result = '';
  const tokens = tokenize(code, {sourceType: 'module', plugins: ['jsx']});

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    result += code.slice(i > 0 ? tokens[i - 1].end : 0, token.start);
    if (token.type.label === 'jsxTagStart' && tokens[i + 1].type.label === '/') {
      // Closing tag.
      result += ')';
      while (tokens[i].type.label !== 'jsxTagEnd') {
        i++;
      }
    } else if (token.type.label === 'jsxTagStart') {
      result += 'React.createElement(';
      if (tokens[i + 1].type.label === 'jsxName' && startsWithLowerCase(tokens[i + 1].value)) {
        i++;
        result += `'${tokens[i].value}'`;
      }
    } else if (token.type.label === 'jsxTagEnd') {
      result += ', ';
    } else if (token.type.label === '/' && tokens[i + 1].type.label === 'jsxTagEnd') {
      result += ')';
      i++;
    } else {
      result += code.slice(token.start, token.end);
    }
  }
  console.log(result);
  return result;
}

function startsWithLowerCase(s: string): boolean {
  return s[0] == s[0].toLowerCase();
}
