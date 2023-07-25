import {css, StyleSheet} from "aphrodite";
import type {editor} from "monaco-editor";
import {useEffect, useRef, useState} from "react";
import type * as MonacoEditorModule from "react-monaco-editor";
import AutoSizer from "react-virtualized-auto-sizer";

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

export default function EditorWrapper({
  label,
  code,
  onChange,
  isReadOnly,
  isPlaintext,
  options,
  timeMs,
  babelLoaded,
}: EditorWrapperProps): JSX.Element {
  const innerEditor = useRef<editor.IStandaloneCodeEditor | null>(null);

  const [monacoEditorModule, setMonacoEditorModule] = useState<typeof MonacoEditorModule | null>(
    null,
  );

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      if (babelLoaded && !monacoEditorModule) {
        setMonacoEditorModule(await import("react-monaco-editor"));
      }
    })();
  }, [babelLoaded, monacoEditorModule]);

  function formatTime(): string {
    if (timeMs == null) {
      return "";
    } else if (timeMs === "LOADING") {
      return " (...)";
    } else {
      return ` (${Math.round(timeMs * 100) / 100}ms)`;
    }
  }

  function invalidate(): void {
    innerEditor.current?.layout();
  }

  return (
    <div className={css(styles.editor)}>
      <span className={css(styles.label)}>
        {label}
        {formatTime()}
      </span>
      <span className={css(styles.container)}>
        <AutoSizer onResize={invalidate} defaultWidth={300} defaultHeight={300}>
          {
            // TODO: The explicit type params can be removed once we're on TS 5.1
            //  https://github.com/bvaughn/react-virtualized-auto-sizer/issues/63
            ({width, height}: {width: number; height: number}) =>
              monacoEditorModule ? (
                <Editor
                  onMount={(editor) => {
                    innerEditor.current = editor;
                  }}
                  MonacoEditor={monacoEditorModule.default}
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
