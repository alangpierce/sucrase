import {getOptions, getRemainingRequest, parseQuery} from "loader-utils";
import {Options, transform} from "sucrase";
import {Loader, NewLoader} from "webpack";

const isNewLoader = (ld: Loader): ld is NewLoader => typeof ld === "object";

const normalizeLoader = (ld: Loader) => {
  let ldName = "";
  let opts: Record<string, any> = {};
  if (isNewLoader(ld)) {
    ldName = ld.loader;
    opts = ld.options || {};
  }

  const index = ldName.indexOf("?");

  if (index >= 0) {
    ldName = ldName.substr(0, index);
    opts = parseQuery(ldName.substr(index));
  }

  opts = {...opts};

  return {loader: ldName, options: opts};
};

interface FallbackOptions {
  /**
   * test if code should be transpiles by fallback loader
   * @example
   * ```js
   * `(code) => code.trim().split("\\n").map(x => x.trim()).find(x => x.startsWith("@"))` // test if code has decorator
   * ```
   * thread-loader cannot read function options from wbepack config
   * so it should be a string
   */
  test: string;
  /**
   * fallback webpack loader options, maybe babel-loader
   */
  loader: Loader;
}

interface OptionsWithFallback extends Options {
  /**
   * fallback options
   */
  fallback?: FallbackOptions;
}

function loader(code: string): string {
  const webpackRemainingChain = getRemainingRequest(this).split("!");
  const filePath = webpackRemainingChain[webpackRemainingChain.length - 1];
  const {fallback = {} as FallbackOptions, ...options}: OptionsWithFallback = getOptions(
    this,
  ) as OptionsWithFallback;

  // eslint-disable-next-line
  const fallbackFunction = !fallback ? () => false : eval(`(${fallback.test}`);

  if (fallbackFunction(code)) return transform(code, {filePath, ...options}).code;

  const {loader: ldName, options: fallbackOptions} = normalizeLoader(fallback.loader);
  // eslint-disable-next-line
  const fallbackLoader = require(ldName);
  const fallbackLoaderContext = {...this, query: fallbackOptions};

  return fallbackLoader.call(fallbackLoaderContext, code);
}

export = loader;
