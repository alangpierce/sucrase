import PropTypes from 'prop-types';
import React, {Component} from 'react';
import MonacoEditor from 'react-monaco-editor';

export default class Editor extends Component {
  static propTypes = {
    label: PropTypes.string.isRequired,
    code: PropTypes.string.isRequired,
    timeMs: PropTypes.number,
    onChange: PropTypes.func,
    isReadOnly: PropTypes.bool,
  };

  invalidate() {
    if (this.monacoEditor && this.monacoEditor.editor) {
      this.monacoEditor.editor.layout();
    }
  }

  render() {
    const {label, code, timeMs, onChange, isReadOnly} = this.props;
    return (
      <div className='Editor'>
        <span className='Editor-label'>
          {label}
          {timeMs != null && ` (${Math.round(timeMs * 100) / 100}ms)`}
        </span>
        <span className='Editor-container'>
          <MonacoEditor
            ref={e => this.monacoEditor = e}
            width="100%"
            height="calc(100% - 30px)"
            language="javascript"
            theme="vs-dark"
            value={code}
            onChange={onChange}
            options={{
              minimap: {enabled: false},
              readOnly: isReadOnly,
            }}
          />
        </span>
      </div>
    );
  }
}
