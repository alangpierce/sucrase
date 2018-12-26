import {editor, Uri} from "monaco-editor";
import React, {Component} from "react";
import MonacoEditor, {EditorDidMount} from "react-monaco-editor";
import {AutoSizer} from "react-virtualized";

interface EditorProps {
  label: string;
  code: string;
  timeMs?: number | "LOADING" | null;
  onChange?: (code: string) => void;
  isReadOnly?: boolean;
  isPlaintext?: boolean;
  options?: editor.IEditorConstructionOptions;
}

let nextModelNum = 0;

export default class Editor extends Component<EditorProps> {
  editor: editor.IStandaloneCodeEditor | null = null;

  componentDidMount(): void {
    setTimeout(this.invalidate, 0);
  }

  _editorDidMount: EditorDidMount = (editor, monaco) => {
    this.editor = editor;
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
    this.invalidate();
  };

  invalidate = () => {
    if (this.editor) {
      this.editor.layout();
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
    const {label, code, onChange, isReadOnly, isPlaintext, options} = this.props;
    return (
      <div className="Editor">
        <span className="Editor-label">
          {label}
          {this._formatTime()}
        </span>
        <span className="Editor-container">
          <AutoSizer onResize={this.invalidate} defaultWidth={300} defaultHeight={300}>
            {({width, height}) => (
              <MonacoEditor
                editorDidMount={this._editorDidMount}
                width={width}
                height={height - 30}
                language={isPlaintext ? undefined : "typescript"}
                theme="vs-dark"
                value={code}
                onChange={onChange}
                options={{
                  minimap: {enabled: false},
                  readOnly: isReadOnly,
                  ...options,
                }}
              />
            )}
          </AutoSizer>
        </span>
      </div>
    );
  }
}
