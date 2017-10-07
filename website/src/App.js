import React, { Component } from 'react';
import './App.css';
import * as Sucrase from 'sucrase';

import Editor from './Editor';

const INITIAL_CODE = `\
// Try typing or pasting some code into the left editor!
import React, { Component } from 'react';

class App extends Component {
  render() {
    return <span>Hello, world!</span>;
  }
}

export default App;
`;

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      code: INITIAL_CODE,
      compareWithBabel: false,
    };
    this.editors = {};
    this._handleCodeChange = this._handleCodeChange.bind(this);
    this._toggleCompareWithBabel = this._toggleCompareWithBabel.bind(this);
  }

  componentDidUpdate() {
    Object.values(this.editors).filter(e => e).forEach(e => e.invalidate());
  }

  _handleCodeChange(newCode) {
    this.setState({
      code: newCode,
    });
  }

  _getCodeAndTimings() {
    let sucraseCode = '';
    let sucraseTimeMs = null;
    let babelCode = '';
    let babelTimeMs = null;
    try {
      const start = performance.now();
      sucraseCode = Sucrase.transform(this.state.code);
      sucraseTimeMs = performance.now() - start;
    } catch (e) {
      sucraseCode = e.message;
    }
    if (this.state.compareWithBabel) {
      try {
        const start = performance.now();
        babelCode = window.Babel.transform(this.state.code, {
          plugins: ['transform-react-jsx']
        }).code;
        babelTimeMs = performance.now() - start;
      } catch (e) {
        babelCode = e.message;
      }
    }
    return {sucraseCode, sucraseTimeMs, babelCode, babelTimeMs};
  }

  _toggleCompareWithBabel() {
    this.setState({compareWithBabel: !this.state.compareWithBabel});
  }

  render() {
    const {sucraseCode, sucraseTimeMs, babelCode, babelTimeMs} = this._getCodeAndTimings();
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">Sucrase</h1>
          <label>
            <input
              type='checkbox'
              checked={this.state.compareWithBabel}
              onChange={this._toggleCompareWithBabel}
            />
            Compare with Babel
          </label>
        </header>
        <div className='Editors'>
          <Editor
            ref={e => this.editors['input'] = e}
            label='Your code'
            code={this.state.code}
            onChange={this._handleCodeChange}
          />
          <Editor
            ref={e => this.editors['sucrase'] = e}
            label='Transformed with Sucrase'
            code={sucraseCode}
            timeMs={sucraseTimeMs}
            isReadOnly={true}
          />
          {this.state.compareWithBabel && (
            <Editor
              ref={e => this.editors['babel'] = e}
              label='Transformed with Babel'
              code={babelCode}
              timeMs={babelTimeMs}
              isReadOnly={true}
            />
          )}
        </div>
      </div>
    );
  }
}

export default App;
