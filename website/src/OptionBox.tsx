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
      <div className="OptionBox">
        <span className="OptionBox-title">{title}</span>
        {options.map(({text, checked, onToggle}) => (
          <label key={text} className="OptionBox-label">
            <input
              className="OptionBox-checkbox"
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
