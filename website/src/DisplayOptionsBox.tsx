import {css, StyleSheet} from "aphrodite";

import CheckBox from "./CheckBox";
import type {DisplayOptions} from "./Constants";
import OptionsBox from "./OptionsBox";

interface DisplayOptionsBoxProps {
  displayOptions: DisplayOptions;
  onUpdateDisplayOptions: (displayOptions: DisplayOptions) => void;
}

export default function DisplayOptionsBox({
  displayOptions,
  onUpdateDisplayOptions,
}: DisplayOptionsBoxProps): JSX.Element {
  return (
    <OptionsBox>
      <div className={css(styles.optionBox)}>
        <span className={css(styles.title)}>Compare</span>
        <CheckBox
          label="Babel"
          checked={displayOptions.compareWithBabel}
          onChange={(checked) => {
            onUpdateDisplayOptions({...displayOptions, compareWithBabel: checked});
          }}
        />
        <CheckBox
          label="TypeScript"
          checked={displayOptions.compareWithTypeScript}
          onChange={(checked) => {
            onUpdateDisplayOptions({...displayOptions, compareWithTypeScript: checked});
          }}
        />
        <CheckBox
          label="Tokens"
          checked={displayOptions.showTokens}
          onChange={(checked) => {
            onUpdateDisplayOptions({...displayOptions, showTokens: checked});
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
  title: {
    fontSize: "1.2em",
    padding: 6,
  },
});
