import {css, StyleSheet} from "aphrodite";
import {useState} from "react";

import CheckBox from "./CheckBox";
import type {DebugOptions} from "./Constants";
import OptionsBox from "./OptionsBox";

interface DebugOptionsBoxProps {
  debugOptions: DebugOptions;
  onUpdateDebugOptions: (debugOptions: DebugOptions) => void;
}

export default function DebugOptionsBox({
  debugOptions,
  onUpdateDebugOptions,
}: DebugOptionsBoxProps): JSX.Element {
  const [enabled, setEnabled] = useState(false);
  if (!enabled) {
    return (
      <a
        href="#debug"
        className={css(styles.link)}
        onClick={(e) => {
          setEnabled(true);
          e.preventDefault();
        }}
      >
        Debug...
      </a>
    );
  }
  return (
    <OptionsBox>
      <div className={css(styles.optionBox)}>
        <span className={css(styles.title)}>Debug</span>
        <CheckBox
          label="Tokens"
          checked={debugOptions.showTokens}
          onChange={(checked) => {
            onUpdateDebugOptions({...debugOptions, showTokens: checked});
          }}
        />
        <CheckBox
          label="Source Map"
          checked={debugOptions.showSourceMap}
          onChange={(checked) => {
            onUpdateDebugOptions({...debugOptions, showSourceMap: checked});
          }}
        />
      </div>
    </OptionsBox>
  );
}

const styles = StyleSheet.create({
  optionBox: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
  },
  link: {
    color: "#CCCCCC",
    marginLeft: 6,
    marginRight: 6,
  },
  title: {
    fontSize: "1.2em",
    padding: 6,
  },
});
