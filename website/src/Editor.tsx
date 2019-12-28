import {editor} from "monaco-editor";
import React, {Component} from "react";
import {EditorDidMount} from "react-monaco-editor";

interface EditorProps {
  MonacoEditor: typeof import("react-monaco-editor").default;
  code: string;
  onChange?: (code: string) => void;
  isReadOnly?: boolean;
  isPlaintext?: boolean;
  options?: editor.IEditorConstructionOptions;
  width: number;
  height: number;
}

export default class Editor extends Component<EditorProps> {
  editor: editor.IStandaloneCodeEditor | null = null;

  async componentDidMount(): Promise<void> {
    setTimeout(this.invalidate, 0);
  }

  _editorDidMount: EditorDidMount = (monacoEditor, monaco) => {
    this.editor = monacoEditor;
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      noSuggestionDiagnostics: true,
    });
    this.invalidate();
  };

  invalidate = () => {
    if (this.editor) {
      this.editor.layout();
    }
  };

  render(): JSX.Element {
    const {
      MonacoEditor,
      code,
      onChange,
      isReadOnly,
      isPlaintext,
      options,
      width,
      height,
    } = this.props;
    return (
      <MonacoEditor
        editorDidMount={this._editorDidMount}
        width={width}
        height={height}
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
    );
  }
}
