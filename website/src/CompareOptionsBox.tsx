import {css, StyleSheet} from "aphrodite";

import CheckBox from "./CheckBox";
import type {CompareOptions} from "./Constants";
import OptionsBox from "./OptionsBox";

interface CompareOptionsBoxProps {
  compareOptions: CompareOptions;
  onUpdateCompareOptions: (compareOptions: CompareOptions) => void;
}

export default function CompareOptionsBox({
  compareOptions,
  onUpdateCompareOptions,
}: CompareOptionsBoxProps): JSX.Element {
  return (
    <OptionsBox>
      <div className={css(styles.optionBox)}>
        <span className={css(styles.title)}>Compare</span>
        <CheckBox
          label="Babel"
          checked={compareOptions.compareWithBabel}
          onChange={(checked) => {
            onUpdateCompareOptions({...compareOptions, compareWithBabel: checked});
          }}
        />
        <CheckBox
          label="TypeScript"
          checked={compareOptions.compareWithTypeScript}
          onChange={(checked) => {
            onUpdateCompareOptions({...compareOptions, compareWithTypeScript: checked});
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
