import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import registerServiceWorker from './registerServiceWorker';

window.Babel.registerPlugin('add-module-exports', require('babel-plugin-add-module-exports'));
ReactDOM.render(<App />, document.getElementById('root'));
registerServiceWorker();
