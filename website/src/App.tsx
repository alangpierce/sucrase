import {css, StyleSheet} from "aphrodite";
import React, {Component} from "react";
import {hot} from "react-hot-loader/root";

import {
  DEFAULT_COMPARE_WITH_BABEL,
  DEFAULT_COMPARE_WITH_TYPESCRIPT,
  DEFAULT_SHOW_TOKENS,
  DEFAULT_TRANSFORMS,
  INITIAL_CODE,
  TRANSFORMS,
} from "./Constants";
import EditorWrapper from "./EditorWrapper";
import OptionBox from "./OptionBox";
import {loadHashState, saveHashState} from "./URLHashState";
import * as WorkerClient from "./WorkerClient";

interface State {
  code: string;
  compareWithBabel: boolean;
  compareWithTypeScript: boolean;
  showTokens: boolean;
  selectedTransforms: {[transformName: string]: boolean};
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

class App extends Component<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = {
      code: INITIAL_CODE,
      compareWithBabel: DEFAULT_COMPARE_WITH_BABEL,
      compareWithTypeScript: DEFAULT_COMPARE_WITH_TYPESCRIPT,
      showTokens: DEFAULT_SHOW_TOKENS,
      // Object with a true value for any selected transform keys.
      selectedTransforms: DEFAULT_TRANSFORMS.reduce((o, name) => ({...o, [name]: true}), {}),
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
    // Auto-expand if any of the hidden-by-default options are explicitly
    // specified.
    if (
      hashState &&
      (hashState.compareWithBabel != null ||
        hashState.compareWithTypeScript ||
        hashState.showTokens != null)
    ) {
      this.state = {...this.state, showMore: true};
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
          selectedTransforms: this.state.selectedTransforms,
          compareWithBabel: this.state.compareWithBabel,
          compareWithTypeScript: this.state.compareWithTypeScript,
          showTokens: this.state.showTokens,
        });
      },
    });
    this.postConfigToWorker();
  }

  componentDidUpdate(prevProps: {}, prevState: State): void {
    if (
      this.state.code !== prevState.code ||
      this.state.selectedTransforms !== prevState.selectedTransforms ||
      this.state.compareWithBabel !== prevState.compareWithBabel ||
      this.state.compareWithTypeScript !== prevState.compareWithTypeScript ||
      this.state.showTokens !== prevState.showTokens ||
      this.state.babelLoaded !== prevState.babelLoaded ||
      this.state.typeScriptLoaded !== prevState.typeScriptLoaded
    ) {
      this.postConfigToWorker();
    }
  }

  postConfigToWorker(): void {
    this.setState({sucraseTimeMs: "LOADING", babelTimeMs: "LOADING", typeScriptTimeMs: "LOADING"});
    WorkerClient.updateConfig({
      compareWithBabel: this.state.compareWithBabel,
      compareWithTypeScript: this.state.compareWithTypeScript,
      code: this.state.code,
      selectedTransforms: this.state.selectedTransforms,
      showTokens: this.state.showTokens,
    });
  }

  _handleCodeChange = (newCode: string) => {
    this.setState({
      code: newCode,
    });
  };

  _toggleCompareWithBabel = () => {
    this.setState({compareWithBabel: !this.state.compareWithBabel});
  };

  _toggleCompareWithTypeScript = () => {
    this.setState({compareWithTypeScript: !this.state.compareWithTypeScript});
  };

  _toggleShowTokens = () => {
    this.setState({showTokens: !this.state.showTokens});
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
          <OptionBox
            title="Transforms"
            options={TRANSFORMS.map(({name}) => ({
              text: name,
              checked: Boolean(this.state.selectedTransforms[name]),
              onToggle: () => {
                let newTransforms = this.state.selectedTransforms;
                newTransforms = {...newTransforms, [name]: !newTransforms[name]};
                // Don't allow typescript and flow at the same time.
                if (newTransforms.typescript && newTransforms.flow) {
                  if (name === "typescript") {
                    newTransforms = {...newTransforms, flow: false};
                  } else if (name === "flow") {
                    newTransforms = {...newTransforms, typescript: false};
                  }
                }
                this.setState({selectedTransforms: newTransforms});
              },
            }))}
          />
          {this.state.showMore && (
            <OptionBox
              title="Settings"
              options={[
                {
                  text: "Compare with Babel",
                  checked: this.state.compareWithBabel,
                  onToggle: this._toggleCompareWithBabel,
                },
                {
                  text: "Compare with TypeScript",
                  checked: this.state.compareWithTypeScript,
                  onToggle: this._toggleCompareWithTypeScript,
                },
                {
                  text: "Show tokens",
                  checked: this.state.showTokens,
                  onToggle: this._toggleShowTokens,
                },
              ]}
            />
          )}
          {!this.state.showMore && (
            <a
              className={css(styles.link)}
              onClick={(e) => {
                this.setState({showMore: true});
                e.preventDefault();
              }}
              href="#more"
            >
              More...
            </a>
          )}
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
          {this.state.compareWithBabel && (
            <EditorWrapper
              label="Transformed with Babel"
              code={babelCode}
              timeMs={babelTimeMs}
              isReadOnly={true}
              babelLoaded={this.state.babelLoaded}
            />
          )}
          {this.state.compareWithTypeScript && (
            <EditorWrapper
              label="Transformed with TypeScript"
              code={typeScriptCode}
              timeMs={typeScriptTimeMs}
              isReadOnly={true}
              babelLoaded={this.state.babelLoaded}
            />
          )}
          {this.state.showTokens && (
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
