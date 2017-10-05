import React, { Component } from 'react';
import MonacoEditor from 'react-monaco-editor';
import './App.css';
import {transform} from 'sucrase';

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
    };
    this._handleCodeChange = this._handleCodeChange.bind(this);
  }

  _handleCodeChange(newCode) {
    this.setState({code: newCode});
  }

  _getTransformedCode() {
    try {
      return transform(this.state.code);
    } catch (e) {
      return e.message;
    }
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">Sucrase</h1>
        </header>
        <div className='Editors'>
          <div className='Editor-left'>
            <MonacoEditor
              width="100%"
              height="600"
              language="javascript"
              theme="vs-dark"
              value={this.state.code}
              onChange={this._handleCodeChange}
              options={{

              }}
            />
          </div>
          <div className='Editor-right'>
            <MonacoEditor
              width="100%"
              height="600"
              language="javascript"
              theme="vs-dark"
              value={this._getTransformedCode()}
              options={{
                readOnly: true,
              }}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default App;
