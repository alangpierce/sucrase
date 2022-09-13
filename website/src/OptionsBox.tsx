import {css, StyleSheet} from "aphrodite";
import type {ReactNode} from "react";

interface OptionsBoxProps {
  children: ReactNode;
}

export default function OptionsBox({children}: OptionsBoxProps): JSX.Element {
  return <div className={css(styles.optionsBox)}>{children}</div>;
}

const styles = StyleSheet.create({
  optionsBox: {
    display: "inline-flex",
    border: "1px solid white",
    borderRadius: 6,
    margin: 10,
    padding: 4,
    backgroundColor: "#333333",
  },
});
