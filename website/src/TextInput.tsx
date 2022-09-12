import {css, StyleSheet} from "aphrodite";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  width?: number;
}

export default function TextInput({value, onChange, width}: TextInputProps): JSX.Element {
  return (
    <input
      type="text"
      className={css(styles.input)}
      style={{width}}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#222222",
    color: "white",
    border: 0,
    fontFamily: "monospace",
  },
});
