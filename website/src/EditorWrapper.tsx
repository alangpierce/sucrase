import {css, StyleSheet} from "aphrodite";
import {editor} from "monaco-editor";
import React, {Component} from "react";
import {AutoSizer} from "react-virtualized/dist/es/AutoSizer";

import Editor from "./Editor";
import FallbackEditor from "./FallbackEditor";

interface EditorWrapperProps {
  label: string;
  timeMs?: number | "LOADING" | null;
  code: string;
  onChange?: (code: string) => void;
  isReadOnly?: boolean;
  isPlaintext?: boolean;
  options?: editor.IEditorConstructionOptions;
  babelLoaded: boolean;
}

interface State {
  MonacoEditor: typeof import("react-monaco-editor").default | null;
}

export default class EditorWrapper extends Component<EditorWrapperProps, State> {
  state: State = {
    MonacoEditor: null,
  };

  editor: Editor | null = null;

  async componentDidUpdate(prevProps: EditorWrapperProps): Promise<void> {
    if (this.props.babelLoaded && !this.state.MonacoEditor) {
      this.setState({MonacoEditor: (await import("react-monaco-editor")).default});
    }
  }

  invalidate = () => {
    if (this.editor) {
      this.editor.invalidate();
    }
  };

  _formatTime(): string {
    const {timeMs} = this.props;
    if (timeMs == null) {
      return "";
    } else if (timeMs === "LOADING") {
      return " (...)";
    } else {
      return ` (${Math.round(timeMs * 100) / 100}ms)`;
    }
  }

  render(): JSX.Element {
    const {MonacoEditor} = this.state;
    const {label, code, onChange, isReadOnly, isPlaintext, options} = this.props;
    return (
      <div className={css(styles.editor)}>
        <span className={css(styles.label)}>
          {label}
          {this._formatTime()}
        </span>
        <span className={css(styles.container)}>
          <AutoSizer onResize={this.invalidate} defaultWidth={300} defaultHeight={300}>
            {({width, height}) =>
              MonacoEditor ? (
                <Editor
                  ref={(e) => {
                    this.editor = e;
                  }}
                  MonacoEditor={MonacoEditor}
                  width={width}
                  height={height - 30}
                  code={code}
                  onChange={onChange}
                  isPlaintext={isPlaintext}
                  isReadOnly={isReadOnly}
                  options={options}
                />
              ) : (
                <FallbackEditor
                  width={width}
                  height={height - 30}
                  code={code}
                  onChange={onChange}
                  isReadOnly={isReadOnly}
                />
              )
            }
          </AutoSizer>
        </span>
      </div>
    );
  }
}

const styles = StyleSheet.create({
  editor: {
    display: "flex",
    flexDirection: "column",
    minWidth: 300,
    height: "100%",
    flex: 1,
    // When adding a third editor, we need the container size to shrink so that
    // the Monaco layout code will adjust to the container size.
    overflowX: "hidden",
    margin: 8,
  },
  label: {
    color: "white",
    lineHeight: "30px",
    padding: 8,
  },
  container: {
    height: "100%",
  },
});
