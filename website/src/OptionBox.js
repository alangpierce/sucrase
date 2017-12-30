import PropTypes from "prop-types";
import React, {Component} from "react";

export default class OptionBox extends Component {
  static propTypes = {
    options: PropTypes.arrayOf(
      PropTypes.shape({
        text: PropTypes.string.isRequired,
        checked: PropTypes.bool.isRequired,
        onToggle: PropTypes.func.isRequired,
      }),
    ).isRequired,
    title: PropTypes.string.isRequired,
  };

  render() {
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
