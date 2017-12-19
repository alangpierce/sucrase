import PropTypes from 'prop-types';
import React, {Component} from 'react';
import MonacoEditor from 'react-monaco-editor';
import {AutoSizer} from 'react-virtualized';

export default class Editor extends Component {
  static propTypes = {
    label: PropTypes.string.isRequired,
    code: PropTypes.string.isRequired,
    timeMs: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf(['LOADING'])]),
    onChange: PropTypes.func,
    isReadOnly: PropTypes.bool,
    options: PropTypes.object,
  };

  componentDidMount() {
    setTimeout(this.invalidate, 0);
  }

  invalidate = () => {
    if (this.monacoEditor && this.monacoEditor.editor) {
      this.monacoEditor.editor.layout();
    }
  };

  _formatTime() {
    const {timeMs} = this.props;
    if (timeMs == null) {
      return '';
    } else if (timeMs === 'LOADING') {
      return ' (...)'
    } else {
      return ` (${Math.round(timeMs * 100) / 100}ms)`;
    }
  }

  render() {
    const {label, code, onChange, isReadOnly, options} = this.props;
    return (
      <div className='Editor'>
        <span className='Editor-label'>
          {label}
          {this._formatTime()}
        </span>
        <span className='Editor-container'>
          <AutoSizer
            onResize={this.invalidate}
            defaultWidth={300}
            defaultHeight={300}
          >
            {({width, height}) =>
              <MonacoEditor
                ref={e => this.monacoEditor = e}
                width={width}
                height={height - 30}
                language="javascript"
                theme="vs-dark"
                value={code}
                onChange={onChange}
                options={{
                  minimap: {enabled: false},
                  readOnly: isReadOnly,
                  ...options,
                }}
              />
            }
          </AutoSizer>
        </span>
      </div>
    );
  }
}
