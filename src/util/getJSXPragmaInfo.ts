import type {Options} from "../index";

export interface JSXPragmaInfo {
  base: string;
  suffix: string;
  fragmentBase: string;
  fragmentSuffix: string;
}

export default function getJSXPragmaInfo(options: Options): JSXPragmaInfo {
  const [base, suffix] = splitPragma(options.jsxPragma || "React.createElement");
  const [fragmentBase, fragmentSuffix] = splitPragma(options.jsxFragmentPragma || "React.Fragment");
  return {base, suffix, fragmentBase, fragmentSuffix};
}

function splitPragma(pragma: string): [string, string] {
  let dotIndex = pragma.indexOf(".");
  if (dotIndex === -1) {
    dotIndex = pragma.length;
  }
  return [pragma.slice(0, dotIndex), pragma.slice(dotIndex)];
}
