import {css, StyleSheet} from "aphrodite";

interface SelectProps<T extends string> {
  options: Array<T>;
  value: T;
  onChange: (value: T) => void;
}

/**
 * Select component where items are identified directly by their value.
 */
export default function SimpleSelect<T extends string>({
  options,
  value,
  onChange,
}: SelectProps<T>): JSX.Element {
  return (
    <select
      className={css(styles.select)}
      value={value}
      onChange={(e) => {
        onChange(e.target.value as T);
      }}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

const styles = StyleSheet.create({
  select: {
    backgroundColor: "#222222",
    color: "white",
    border: 0,
    fontFamily: "monospace",
  },
});
