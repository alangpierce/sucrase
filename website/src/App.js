import React, { Component } from 'react';
import './App.css';
import * as Sucrase from 'sucrase';
import * as babylon from 'babylon';

import Editor from './Editor';
import formatTokens from './formatTokens';
import OptionBox from './OptionBox';

const INITIAL_CODE = `\
// Try typing or pasting some code into the left editor!
import React, { Component } from 'react';

class App extends Component {
  render() {
    return <span>Hello, world!</span>;
  }
}

const OtherComponent = React.createClass({
  render() {
    return null;
  }
});

export default App;
`;

const TRANSFORMS = [
  {name: 'jsx', babelName: 'transform-react-jsx'},
  {name: 'imports', babelName: 'transform-es2015-modules-commonjs'},
  {name: 'react-display-name', babelName: 'transform-react-display-name'},
  {name: 'add-module-exports', babelName: 'add-module-exports'},
];

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      code: INITIAL_CODE,
      compareWithBabel: false,
      showTokens: false,
      // Object with a true value for any selected transform keys.
      selectedTransforms: {
        jsx: true,
        imports: true,
      },
    };
    this.editors = {};
    this._handleCodeChange = this._handleCodeChange.bind(this);
    this._toggleCompareWithBabel = this._toggleCompareWithBabel.bind(this);
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

  _getCodeAndTimings() {
    let sucraseCode = '';
    let sucraseTimeMs = null;
    let babelCode = '';
    let babelTimeMs = null;
    try {
      const sucraseTransforms = TRANSFORMS
        .map(({name}) => name)
        .filter(name => this.state.selectedTransforms[name]);
      const start = performance.now();
      sucraseCode = Sucrase.transform(this.state.code, {transforms: sucraseTransforms});
      sucraseTimeMs = performance.now() - start;
    } catch (e) {
      sucraseCode = e.message;
    }
    if (this.state.compareWithBabel) {
      try {
        let babelPlugins = TRANSFORMS
          .filter(({name}) => this.state.selectedTransforms[name])
          .map(({babelName}) => babelName);
        if (babelPlugins.includes('add-module-exports')) {
          babelPlugins = [
            'add-module-exports',
            ...babelPlugins.filter(p => p !== 'add-module-exports')
          ];
        }
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
        <span className="App-title">Sucrase</span>
        <span className="App-subtitle">
          <span>Super-fast Babel alternative</span>
          {' | '}
          <a className="App-link" href='https://github.com/alangpierce/sucrase'>GitHub</a>
        </span>
        <div className="App-options">
          <OptionBox
            title="Transforms"
            options={TRANSFORMS.map(({name}) => ({
              text: name,
              checked: Boolean(this.state.selectedTransforms[name]),
              onToggle: () => {
                this.setState({
                  selectedTransforms: {
                    ...this.state.selectedTransforms,
                    [name]: !this.state.selectedTransforms[name],
                  }
                })
              }
            }))}
          />
          <OptionBox
            title="Settings"
            options={[
              {
                text: 'Compare with babel',
                checked: this.state.compareWithBabel,
                onToggle: this._toggleCompareWithBabel
              },
              {
                text: 'Show tokens',
                checked: this.state.showTokens,
                onToggle: this._toggleShowTokens
              },
            ]}
          />
        </div>

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
