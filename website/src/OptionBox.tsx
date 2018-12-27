import {css, StyleSheet} from "aphrodite";
import React, {Component} from "react";

interface OptionBoxProps {
  options: Array<{
    text: string;
    checked: boolean;
    onToggle: () => void;
  }>;
  title: string;
}

export default class OptionBox extends Component<OptionBoxProps> {
  render(): JSX.Element {
    const {options, title} = this.props;
    return (
      <div className={css(styles.optionBox)}>
        <span className={css(styles.title)}>{title}</span>
        {options.map(({text, checked, onToggle}) => (
          <label key={text} className={css(styles.label)}>
            <input
              className={css(styles.checkbox)}
              type="checkbox"
              checked={checked}
              onChange={onToggle}
            />
            {text}
          </label>
        ))}
      </div>
    );
  }
}

const styles = StyleSheet.create({
  optionBox: {
    display: "inline-flex",
    flexWrap: "wrap",
    alignItems: "center",
    border: "1px solid white",
    borderRadius: 6,
    margin: 10,
    padding: 4,
    backgroundColor: "#333333",
  },
  title: {
    fontSize: "1.2em",
    padding: 6,
  },
  label: {
    display: "flex",
    alignItems: "center",
    marginLeft: 8,
    marginRight: 8,
  },
  checkbox: {
    marginRight: 4,
  },
});
