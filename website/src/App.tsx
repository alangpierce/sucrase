import {css, StyleSheet} from "aphrodite";
import {Component} from "react";
import {hot} from "react-hot-loader/root";

import CompareOptionsBox from "./CompareOptionsBox";
import {
  type DebugOptions,
  DEFAULT_DEBUG_OPTIONS,
  DEFAULT_COMPARE_OPTIONS,
  DEFAULT_OPTIONS,
  type CompareOptions,
  type HydratedOptions,
  INITIAL_CODE,
} from "./Constants";
import DebugOptionsBox from "./DebugOptionsBox";
import EditorWrapper from "./EditorWrapper";
import SucraseOptionsBox from "./SucraseOptionsBox";
import {loadHashState, saveHashState} from "./URLHashState";
import * as WorkerClient from "./WorkerClient";

interface State {
  code: string;
  sucraseOptions: HydratedOptions;
  compareOptions: CompareOptions;
  debugOptions: DebugOptions;
  sucraseCode: string;
  sucraseTimeMs: number | null | "LOADING";
  babelCode: string;
  babelTimeMs: number | null | "LOADING";
  typeScriptCode: string;
  typeScriptTimeMs: number | null | "LOADING";
  tokensStr: string;
  sourceMapStr: string;
  showMore: boolean;
  babelLoaded: boolean;
  typeScriptLoaded: boolean;
}

class App extends Component<unknown, State> {
  constructor(props: unknown) {
    super(props);
    this.state = {
      code: INITIAL_CODE,
      sucraseOptions: DEFAULT_OPTIONS,
      compareOptions: DEFAULT_COMPARE_OPTIONS,
      debugOptions: DEFAULT_DEBUG_OPTIONS,
      sucraseCode: "",
      sucraseTimeMs: null,
      babelCode: "",
      babelTimeMs: null,
      typeScriptCode: "",
      typeScriptTimeMs: null,
      tokensStr: "",
      sourceMapStr: "",
      showMore: false,
      babelLoaded: false,
      typeScriptLoaded: false,
    };
    const hashState = loadHashState();
    if (hashState) {
      this.state = {...this.state, ...hashState};
    }
  }

  componentDidMount(): void {
    WorkerClient.subscribe({
      updateState: (stateUpdate) => {
        this.setState((state) => ({...state, ...stateUpdate}));
      },
      handleCompressedCode: (compressedCode) => {
        saveHashState({
          code: this.state.code,
          compressedCode,
          sucraseOptions: this.state.sucraseOptions,
          compareOptions: this.state.compareOptions,
          debugOptions: this.state.debugOptions,
        });
      },
    });
    this.postConfigToWorker();
  }

  componentDidUpdate(prevProps: unknown, prevState: State): void {
    if (
      this.state.code !== prevState.code ||
      this.state.sucraseOptions !== prevState.sucraseOptions ||
      this.state.compareOptions !== prevState.compareOptions ||
      this.state.debugOptions !== prevState.debugOptions ||
      this.state.babelLoaded !== prevState.babelLoaded ||
      this.state.typeScriptLoaded !== prevState.typeScriptLoaded
    ) {
      this.postConfigToWorker();
    }
  }

  postConfigToWorker(): void {
    this.setState({sucraseTimeMs: "LOADING", babelTimeMs: "LOADING", typeScriptTimeMs: "LOADING"});
    WorkerClient.updateConfig({
      code: this.state.code,
      sucraseOptions: this.state.sucraseOptions,
      compareOptions: this.state.compareOptions,
      debugOptions: this.state.debugOptions,
    });
  }

  _handleCodeChange = (newCode: string): void => {
    this.setState({
      code: newCode,
    });
  };

  render(): JSX.Element {
    const {
      sucraseCode,
      sucraseTimeMs,
      babelCode,
      babelTimeMs,
      typeScriptCode,
      typeScriptTimeMs,
      tokensStr,
      sourceMapStr,
    } = this.state;
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
            options={this.state.sucraseOptions}
            onUpdateOptions={(sucraseOptions) => {
              this.setState({sucraseOptions});
            }}
          />
          <CompareOptionsBox
            compareOptions={this.state.compareOptions}
            onUpdateCompareOptions={(compareOptions: CompareOptions) => {
              this.setState({compareOptions});
            }}
          />
          <DebugOptionsBox
            debugOptions={this.state.debugOptions}
            onUpdateDebugOptions={(debugOptions: DebugOptions) => {
              this.setState({debugOptions});
            }}
          />
        </div>

        <div className={css(styles.editors)}>
          <EditorWrapper
            label="Your code"
            code={this.state.code}
            onChange={this._handleCodeChange}
            babelLoaded={this.state.babelLoaded}
          />
          <EditorWrapper
            label="Transformed with Sucrase"
            code={sucraseCode}
            timeMs={sucraseTimeMs}
            isReadOnly={true}
            babelLoaded={this.state.babelLoaded}
          />
          {this.state.compareOptions.compareWithBabel && (
            <EditorWrapper
              label="Transformed with Babel"
              code={babelCode}
              timeMs={babelTimeMs}
              isReadOnly={true}
              babelLoaded={this.state.babelLoaded}
            />
          )}
          {this.state.compareOptions.compareWithTypeScript && (
            <EditorWrapper
              label="Transformed with TypeScript"
              code={typeScriptCode}
              timeMs={typeScriptTimeMs}
              isReadOnly={true}
              babelLoaded={this.state.babelLoaded}
            />
          )}
          {this.state.debugOptions.showTokens && (
            <EditorWrapper
              label="Tokens"
              code={tokensStr}
              isReadOnly={true}
              isPlaintext={true}
              options={{
                lineNumbers: (n) => (n > 1 ? String(n - 2) : ""),
              }}
              babelLoaded={this.state.babelLoaded}
            />
          )}
          {this.state.debugOptions.showSourceMap && (
            <EditorWrapper
              label="Source Map"
              code={sourceMapStr}
              isReadOnly={true}
              isPlaintext={true}
              babelLoaded={this.state.babelLoaded}
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
