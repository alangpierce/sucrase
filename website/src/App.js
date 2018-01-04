import React, {Component} from "react";
import "./App.css";

import {getVersion} from "sucrase";

import {
  TRANSFORMS,
  INITIAL_CODE,
  DEFAULT_COMPARE_WITH_BABEL,
  DEFAULT_SHOW_TOKENS,
  DEFAULT_TRANSFORMS,
  DEFAULT_COMPARE_WITH_TYPESCRIPT,
} from "./Constants";
import Editor from "./Editor";
import OptionBox from "./OptionBox";
import {loadHashState, saveHashState} from "./URLHashState";
import * as WorkerClient from "./WorkerClient";

class App extends Component {
  constructor(props) {
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
        hashState.showTokens != null ||
        (hashState.selectedTransforms &&
          TRANSFORMS.some(
            ({name, hideByDefault}) => hideByDefault && hashState.selectedTransforms[name],
          )))
    ) {
      this.state = {...this.state, showMore: true};
    }

    this.editors = {};
  }

  componentDidMount() {
    WorkerClient.subscribe({
      updateState: (stateUpdate) => {
        this.setState(stateUpdate);
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

  componentDidUpdate(prevProps, prevState) {
    if (
      this.state.code !== prevState.code ||
      this.state.selectedTransforms !== prevState.selectedTransforms ||
      this.state.compareWithBabel !== prevState.compareWithBabel ||
      this.state.showTokens !== prevState.showTokens
    ) {
      this.postConfigToWorker();
    }
  }

  postConfigToWorker() {
    this.setState({sucraseTimeMs: "LOADING", babelTimeMs: "LOADING", typeScriptTimeMs: "LOADING"});
    WorkerClient.updateConfig({
      compareWithBabel: this.state.compareWithBabel,
      compareWithTypeScript: this.state.compareWithTypeScript,
      code: this.state.code,
      selectedTransforms: this.state.selectedTransforms,
      showTokens: this.state.showTokens,
    });
  }

  _handleCodeChange = (newCode) => {
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

  render() {
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
      <div className="App">
        <span className="App-title">Sucrase</span>
        <span className="App-subtitle">
          <span>Super-fast Babel alternative</span>
          {" | "}
          <a className="App-link" href="https://github.com/alangpierce/sucrase">
            GitHub
          </a>
        </span>
        <div className="App-options">
          <OptionBox
            title="Transforms"
            options={TRANSFORMS.filter(
              ({hideByDefault}) => !hideByDefault || this.state.showMore,
            ).map(({name, isExperimental}) => ({
              text: name + (isExperimental ? " (experimental)" : ""),
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
              className="App-link"
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

        <div className="Editors">
          <Editor
            ref={(e) => (this.editors["input"] = e)}
            label="Your code"
            code={this.state.code}
            onChange={this._handleCodeChange}
          />
          <Editor
            ref={(e) => (this.editors["sucrase"] = e)}
            label="Transformed with Sucrase"
            code={sucraseCode}
            timeMs={sucraseTimeMs}
            isReadOnly={true}
          />
          {this.state.compareWithBabel && (
            <Editor
              ref={(e) => (this.editors["babel"] = e)}
              label="Transformed with Babel"
              code={babelCode}
              timeMs={babelTimeMs}
              isReadOnly={true}
            />
          )}
          {this.state.compareWithTypeScript && (
            <Editor
              ref={(e) => (this.editors["typescript"] = e)}
              label="Transformed with TypeScript"
              code={typeScriptCode}
              timeMs={typeScriptTimeMs}
              isReadOnly={true}
            />
          )}
          {this.state.showTokens && (
            <Editor
              ref={(e) => (this.editors["tokens"] = e)}
              label="Tokens"
              code={tokensStr}
              isReadOnly={true}
              isPlaintext={true}
              options={{
                lineNumbers: (n) => (n > 1 ? String(n - 2) : null),
              }}
            />
          )}
        </div>
        <span className="App-footer">
          <a className="App-link" href="https://www.npmjs.com/package/sucrase">
            sucrase
          </a>{" "}
          {getVersion()}
        </span>
      </div>
    );
  }
}

export default App;
