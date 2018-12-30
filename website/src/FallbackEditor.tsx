import {css, StyleSheet} from "aphrodite";
import React from "react";

interface FallbackEditorProps {
  width: number;
  height: number;
  code: string;
  onChange?: (code: string) => void;
  isReadOnly?: boolean;
}

/**
 * Clone of the default styles in the Monaco editor to get something as close as possible
 * while the real editor is loading. Ideally, all text is positioned exactly the same when
 * the editor loads, and line numbers, syntax highlighting, etc appear to enhance the
 * existing text rather than replacing it.
 */
export default function FallbackEditor({
  width,
  height,
  code,
  onChange,
  isReadOnly,
}: FallbackEditorProps): JSX.Element {
  return (
    <textarea
      className={css(styles.editor)}
      style={{width, height}}
      value={code}
      onChange={
        onChange &&
        ((e) => {
          onChange(e.target.value);
        })
      }
      spellCheck={false}
      readOnly={isReadOnly}
      wrap="off"
    />
  );
}

const styles = StyleSheet.create({
  editor: {
    border: 0,
    color: "#d4d4d4",
    backgroundColor: "#1e1e1e",
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: 12,
    resize: "none",
    outline: 0,
    padding: 0,
    paddingLeft: 62,
    lineHeight: "18px",
  },
});
