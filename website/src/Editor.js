import PropTypes from 'prop-types';
import React, {Component} from 'react';
import MonacoEditor from 'react-monaco-editor';
import {AutoSizer} from 'react-virtualized';

export default class Editor extends Component {
  static propTypes = {
    label: PropTypes.string.isRequired,
    code: PropTypes.string.isRequired,
    timeMs: PropTypes.number,
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

  render() {
    const {label, code, timeMs, onChange, isReadOnly, options} = this.props;
    return (
      <div className='Editor'>
        <span className='Editor-label'>
          {label}
          {timeMs != null && ` (${Math.round(timeMs * 100) / 100}ms)`}
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
