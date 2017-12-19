import React, { Component } from 'react';
import './App.css';
import * as babylon from 'babylon';

import {TRANSFORMS, INITIAL_CODE} from './Constants';
import Editor from './Editor';
import formatTokens from './formatTokens';
import OptionBox from './OptionBox';
import * as WorkerClient from './WorkerClient';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      code: INITIAL_CODE,
      compareWithBabel: true,
      showTokens: false,
      // Object with a true value for any selected transform keys.
      selectedTransforms: {
        jsx: true,
        imports: true,
      },
      sucraseCode: '',
      sucraseTimeMs: null,
      babelCode: '',
      babelTimeMs: null,
    };
    this.editors = {};
    this._handleCodeChange = this._handleCodeChange.bind(this);
    this._toggleCompareWithBabel = this._toggleCompareWithBabel.bind(this);
  }

  componentDidMount() {
    WorkerClient.subscribe(stateUpdate => this.setState(stateUpdate));
    this.postConfigToWorker();
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      this.state.compareWithBabel !== prevState.compareWithBabel ||
      this.state.code !== prevState.code ||
      this.state.selectedTransforms !== prevState.selectedTransforms
    ) {
      this.postConfigToWorker();
    }
  }

  postConfigToWorker() {
    this.setState({sucraseTimeMs: 'LOADING', babelTimeMs: 'LOADING'});
    WorkerClient.updateConfig({
      compareWithBabel: this.state.compareWithBabel,
      code: this.state.code,
      selectedTransforms: this.state.selectedTransforms,
    });
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
    const {sucraseCode, sucraseTimeMs, babelCode, babelTimeMs} = this.state;
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
