import {css, StyleSheet} from "aphrodite";
import type {ReactNode} from "react";

interface CheckBoxProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function CheckBox({label, checked, onChange}: CheckBoxProps): JSX.Element {
  return (
    <label className={css(styles.label)}>
      <input
        type="checkbox"
        className={css(styles.checkbox)}
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
      />
      {label}
    </label>
  );
}

const styles = StyleSheet.create({
  label: {
    display: "flex",
    alignItems: "center",
    marginLeft: 6,
    marginRight: 6,
  },
  checkbox: {
    marginRight: 4,
  },
});
