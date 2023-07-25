import {css, StyleSheet} from "aphrodite";
import {useEffect, useRef, useState} from "react";
import {hot} from "react-hot-loader/root";

import CompareOptionsBox from "./CompareOptionsBox";
import {
  type DebugOptions,
  DEFAULT_DEBUG_OPTIONS,
  DEFAULT_COMPARE_OPTIONS,
  DEFAULT_OPTIONS,
  type CompareOptions,
  INITIAL_CODE,
} from "./Constants";
import DebugOptionsBox from "./DebugOptionsBox";
import EditorWrapper from "./EditorWrapper";
import SucraseOptionsBox from "./SucraseOptionsBox";
import {type BaseHashState, loadHashState, saveHashState} from "./URLHashState";
import * as WorkerClient from "./WorkerClient";
import {type StateUpdate} from "./WorkerClient";

function App(): JSX.Element {
  const cachedHashState = useRef<BaseHashState | null | "NOT_LOADED">("NOT_LOADED");
  function hashState(): BaseHashState | null {
    if (cachedHashState.current === "NOT_LOADED") {
      cachedHashState.current = loadHashState();
    }
    return cachedHashState.current;
  }

  const [code, setCode] = useState(hashState()?.code ?? INITIAL_CODE);
  const [sucraseOptions, setSucraseOptions] = useState(
    hashState()?.sucraseOptions ?? DEFAULT_OPTIONS,
  );
  const [compareOptions, setCompareOptions] = useState(
    hashState()?.compareOptions ?? DEFAULT_COMPARE_OPTIONS,
  );
  const [debugOptions, setDebugOptions] = useState(
    hashState()?.debugOptions ?? DEFAULT_DEBUG_OPTIONS,
  );
  const [sucraseCode, setSucraseCode] = useState("");
  const [sucraseTimeMs, setSucraseTimeMs] = useState<number | null | "LOADING">(null);
  const [babelCode, setBabelCode] = useState("");
  const [babelTimeMs, setBabelTimeMs] = useState<number | null | "LOADING">(null);
  const [typeScriptCode, setTypeScriptCode] = useState("");
  const [typeScriptTimeMs, setTypeScriptTimeMs] = useState<number | null | "LOADING">(null);
  const [tokensStr, setTokensStr] = useState("");
  const [sourceMapStr, setSourceMapStr] = useState("");
  const [babelLoaded, setBabelLoaded] = useState(false);
  const [typeScriptLoaded, setTypeScriptLoaded] = useState(false);

  useEffect(() => {
    WorkerClient.updateHandlers({
      updateState: (stateUpdate) => {
        const setters: {
          [k in keyof StateUpdate]-?: (newValue: Exclude<StateUpdate[k], undefined>) => void;
        } = {
          sucraseCode: setSucraseCode,
          babelCode: setBabelCode,
          typeScriptCode: setTypeScriptCode,
          tokensStr: setTokensStr,
          sourceMapStr: setSourceMapStr,
          sucraseTimeMs: setSucraseTimeMs,
          babelTimeMs: setBabelTimeMs,
          typeScriptTimeMs: setTypeScriptTimeMs,
          babelLoaded: setBabelLoaded,
          typeScriptLoaded: setTypeScriptLoaded,
        };
        // The above mapping ensures we list all properties in StateUpdate with the right types.
        // Use escape hatches for actually setting the properties.
        for (const [key, setter] of Object.entries(setters)) {
          if (stateUpdate[key as keyof StateUpdate] !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (setter as any)(stateUpdate[key as keyof StateUpdate]);
          }
        }
      },
      handleCompressedCode: (compressedCode) => {
        saveHashState({
          code,
          compressedCode,
          sucraseOptions,
          compareOptions,
          debugOptions,
        });
      },
    });
  }, [code, sucraseOptions, compareOptions, debugOptions]);

  // On any change to code, config, or loading state, kick off a worker task to re-calculate.
  useEffect(() => {
    setSucraseTimeMs("LOADING");
    setBabelTimeMs("LOADING");
    setTypeScriptTimeMs("LOADING");
    WorkerClient.updateConfig({code, sucraseOptions, compareOptions, debugOptions});
  }, [code, sucraseOptions, compareOptions, debugOptions, babelLoaded, typeScriptLoaded]);

  return (
    <div className={css(styles.app)}>
      <span className={css(styles.title)}>Sucrase</span>
      <span className={css(styles.subtitle)}>
        <span>Super-fast Babel alternative</span>
        {" | "}
        <a className={css(styles.link)} href="https://github.com/alangpierce/sucrase">
          GitHub
        </a>
      </span>
      <div className={css(styles.options)}>
        <SucraseOptionsBox
          options={sucraseOptions}
          onUpdateOptions={(newSucraseOptions) => {
            setSucraseOptions(newSucraseOptions);
          }}
        />
        <CompareOptionsBox
          compareOptions={compareOptions}
          onUpdateCompareOptions={(newCompareOptions: CompareOptions) => {
            setCompareOptions(newCompareOptions);
          }}
        />
        <DebugOptionsBox
          debugOptions={debugOptions}
          onUpdateDebugOptions={(newDebugOptions: DebugOptions) => {
            setDebugOptions(newDebugOptions);
          }}
        />
      </div>

      <div className={css(styles.editors)}>
        <EditorWrapper label="Your code" code={code} onChange={setCode} babelLoaded={babelLoaded} />
        <EditorWrapper
          label="Transformed with Sucrase"
          code={sucraseCode}
          timeMs={sucraseTimeMs}
          isReadOnly={true}
          babelLoaded={babelLoaded}
        />
        {compareOptions.compareWithBabel && (
          <EditorWrapper
            label="Transformed with Babel"
            code={babelCode}
            timeMs={babelTimeMs}
            isReadOnly={true}
            babelLoaded={babelLoaded}
          />
        )}
        {compareOptions.compareWithTypeScript && (
          <EditorWrapper
            label="Transformed with TypeScript"
            code={typeScriptCode}
            timeMs={typeScriptTimeMs}
            isReadOnly={true}
            babelLoaded={babelLoaded}
          />
        )}
        {debugOptions.showTokens && (
          <EditorWrapper
            label="Tokens"
            code={tokensStr}
            isReadOnly={true}
            isPlaintext={true}
            options={{
              lineNumbers: (n) => (n > 1 ? String(n - 2) : ""),
            }}
            babelLoaded={babelLoaded}
          />
        )}
        {debugOptions.showSourceMap && (
          <EditorWrapper
            label="Source Map"
            code={sourceMapStr}
            isReadOnly={true}
            isPlaintext={true}
            babelLoaded={babelLoaded}
          />
        )}
      </div>
      <span className={css(styles.footer)}>
        <a className={css(styles.link)} href="https://www.npmjs.com/package/sucrase">
          sucrase
        </a>{" "}
        {process.env.SUCRASE_VERSION}
      </span>
    </div>
  );
}

export default hot(App);

const styles = StyleSheet.create({
  app: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "#222",
  },
  title: {
    fontSize: "2em",
    color: "white",
    fontWeight: "bold",
    padding: 8,
  },
  subtitle: {
    fontSize: "1.2em",
    color: "white",
  },
  link: {
    color: "#CCCCCC",
  },
  options: {
    textAlign: "center",
    color: "white",
  },
  footer: {
    fontSize: "large",
    color: "white",
    marginBottom: 8,
  },
  editors: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
});
