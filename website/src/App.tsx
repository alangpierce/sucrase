import {css, StyleSheet} from "aphrodite";
import React, {Component} from "react";
import {hot} from "react-hot-loader/root";

import {
  DEFAULT_DISPLAY_OPTIONS,
  DEFAULT_OPTIONS,
  DisplayOptions,
  HydratedOptions,
  INITIAL_CODE,
} from "./Constants";
import DisplayOptionsBox from "./DisplayOptionsBox";
import EditorWrapper from "./EditorWrapper";
import SucraseOptionsBox from "./SucraseOptionsBox";
import {loadHashState, saveHashState} from "./URLHashState";
import * as WorkerClient from "./WorkerClient";

interface State {
  code: string;
  displayOptions: DisplayOptions;
  sucraseOptions: HydratedOptions;
  sucraseCode: string;
  sucraseTimeMs: number | null | "LOADING";
  babelCode: string;
  babelTimeMs: number | null | "LOADING";
  typeScriptCode: string;
  typeScriptTimeMs: number | null | "LOADING";
  tokensStr: string;
  showMore: boolean;
  babelLoaded: boolean;
  typeScriptLoaded: boolean;
}

class App extends Component<unknown, State> {
  constructor(props: unknown) {
    super(props);
    this.state = {
      code: INITIAL_CODE,
      displayOptions: DEFAULT_DISPLAY_OPTIONS,
      sucraseOptions: DEFAULT_OPTIONS,
      sucraseCode: "",
      sucraseTimeMs: null,
      babelCode: "",
      babelTimeMs: null,
      typeScriptCode: "",
      typeScriptTimeMs: null,
      tokensStr: "",
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
          displayOptions: this.state.displayOptions,
        });
      },
    });
    this.postConfigToWorker();
  }

  componentDidUpdate(prevProps: unknown, prevState: State): void {
    if (
      this.state.code !== prevState.code ||
      this.state.sucraseOptions !== prevState.sucraseOptions ||
      this.state.displayOptions !== prevState.displayOptions ||
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
      displayOptions: this.state.displayOptions,
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
          <DisplayOptionsBox
            displayOptions={this.state.displayOptions}
            onUpdateDisplayOptions={(displayOptions: DisplayOptions) => {
              this.setState({displayOptions});
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
          {this.state.displayOptions.compareWithBabel && (
            <EditorWrapper
              label="Transformed with Babel"
              code={babelCode}
              timeMs={babelTimeMs}
              isReadOnly={true}
              babelLoaded={this.state.babelLoaded}
            />
          )}
          {this.state.displayOptions.compareWithTypeScript && (
            <EditorWrapper
              label="Transformed with TypeScript"
              code={typeScriptCode}
              timeMs={typeScriptTimeMs}
              isReadOnly={true}
              babelLoaded={this.state.babelLoaded}
            />
          )}
          {this.state.displayOptions.showTokens && (
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
