import {getOptions} from "loader-utils";
import {Options, transform} from "sucrase";

function loader(code: string): string {
  const options: Options = getOptions(this) as Options;
  return transform(code, options);
}

export = loader;
