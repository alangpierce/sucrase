import {getOptions, getRemainingRequest} from "loader-utils";
import {Options, transform} from "sucrase";

function loader(code: string): string {
  const webpackRemainingChain = getRemainingRequest(this).split("!");
  const filePath = webpackRemainingChain[webpackRemainingChain.length - 1];
  const options: Options = getOptions(this) as Options;
  return transform(code, {filePath, ...options}).code;
}

export = loader;
