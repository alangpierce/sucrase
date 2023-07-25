import type {editor} from "monaco-editor";
import {useCallback, useEffect, useRef} from "react";
import type MonacoEditor from "react-monaco-editor";

interface EditorProps {
  MonacoEditor: typeof MonacoEditor;
  code: string;
  onChange?: (code: string) => void;
  isReadOnly?: boolean;
  isPlaintext?: boolean;
  options?: editor.IEditorConstructionOptions;
  width: number;
  height: number;
  onMount: (editor: editor.IStandaloneCodeEditor) => void;
}

export default function Editor({
  MonacoEditor,
  code,
  onChange,
  isReadOnly,
  isPlaintext,
  options,
  width,
  height,
}: EditorProps): JSX.Element {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const editorDidMount = useCallback((monacoEditor, monaco) => {
    editorRef.current = monacoEditor;
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      noSuggestionDiagnostics: true,
    });
    monacoEditor.layout();
  }, []);

  useEffect(() => {
    setTimeout(() => {
      editorRef.current?.layout();
    }, 0);
  }, []);

  return (
    <MonacoEditor
      editorDidMount={editorDidMount}
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
