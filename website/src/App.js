import React, { Component } from 'react';
import './App.css';
import * as Sucrase from 'sucrase';
import * as babylon from 'babylon';

import Editor from './Editor';
import formatTokens from './formatTokens';

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
      showTokens: false,
      jsxTransform: true,
      importTransform: false,
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

  _toggleCompareWithBabel = () => {
    this.setState({compareWithBabel: !this.state.compareWithBabel});
  };

  _toggleShowTokens = () => {
    this.setState({showTokens: !this.state.showTokens});
  };

  _toggleJSXTransform = () => {
    this.setState({jsxTransform: !this.state.jsxTransform});
  };

  _toggleImportTransform = () => {
    this.setState({importTransform: !this.state.importTransform});
  };

  _getCodeAndTimings() {
    let sucraseCode = '';
    let sucraseTimeMs = null;
    let babelCode = '';
    let babelTimeMs = null;
    try {
      const sucraseTransforms = [
        ...this.state.jsxTransform ? ['jsx'] : [],
        ...this.state.importTransform ? ['imports'] : [],
      ];
      const start = performance.now();
      sucraseCode = Sucrase.transform(this.state.code, {transforms: sucraseTransforms});
      sucraseTimeMs = performance.now() - start;
    } catch (e) {
      sucraseCode = e.message;
    }
    if (this.state.compareWithBabel) {
      try {
        const babelPlugins = [
          ...this.state.jsxTransform ? ['transform-react-jsx'] : [],
          ...this.state.importTransform ? ['transform-es2015-modules-commonjs'] : [],
        ];
        const start = performance.now();
        babelCode = window.Babel.transform(this.state.code, {
          plugins: babelPlugins,
        }).code;
        babelTimeMs = performance.now() - start;
      } catch (e) {
        babelCode = e.message;
      }
    }
    return {sucraseCode, sucraseTimeMs, babelCode, babelTimeMs};
  }

  _getTokens() {
    try {
      const ast = babylon.parse(
        this.state.code,
        {tokens: true, sourceType: 'module', plugins: ['jsx', 'objectRestSpread']}
      );
      return formatTokens(ast.tokens);
    } catch (e) {
      return e.message;
    }
  }

  render() {
    const {sucraseCode, sucraseTimeMs, babelCode, babelTimeMs} = this._getCodeAndTimings();
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">Sucrase</h1>
          <label className='App-optionBox'>
            <input
              type='checkbox'
              checked={this.state.compareWithBabel}
              onChange={this._toggleCompareWithBabel}
            />
            Compare with Babel
          </label>
          <label className='App-optionBox'>
            <input
              type='checkbox'
              checked={this.state.showTokens}
              onChange={this._toggleShowTokens}
            />
            Show tokens
          </label>
          <label className='App-optionBox'>
            <input
              type='checkbox'
              checked={this.state.jsxTransform}
              onChange={this._toggleJSXTransform}
            />
            JSX transform
          </label>
          <label className='App-optionBox'>
            <input
              type='checkbox'
              checked={this.state.importTransform}
              onChange={this._toggleImportTransform}
            />
            Import transform
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
          {this.state.showTokens && (
            <Editor
              ref={e => this.editors['tokens'] = e}
              label='Babylon tokens'
              code={this._getTokens()}
              isReadOnly={true}
              options={{
                lineNumbers: (n) => String(n - 1)
              }}
            />
          )}
        </div>
      </div>
    );
  }
}

export default App;
