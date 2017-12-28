/* eslint-disable no-restricted-globals */
import * as Babel from '@babel/standalone';
import * as Sucrase from 'sucrase';

import {TRANSFORMS} from './Constants';
import {compressCode} from './URLHashState';
import getTokens from './getTokens';
Babel.registerPlugin('add-module-exports', require('babel-plugin-add-module-exports'));


let config = null;

/**
 * The worker architecture intentionally bypasses the browser event loop in
 * favor of.
 */
self.addEventListener('message', ({data}) => {
  self.postMessage(processEvent(data));
});

function processEvent(data) {
  if (data.type === 'SET_CONFIG') {
    config = data.config;
    return null;
  } else if (data.type === 'RUN_SUCRASE') {
    return runSucrase().code;
  } else if (data.type === 'RUN_BABEL') {
    return runBabel().code;
  } else if (data.type === 'COMPRESS_CODE') {
    return compressCode(config.code);
  } else if (data.type === 'GET_TOKENS') {
    return getTokens(config.code, getSelectedTransforms());
  } else if (data.type === 'PROFILE_SUCRASE') {
    return runSucrase().time;
  } else if (data.type === 'PROFILE_BABEL') {
    return runBabel().time;
  }
}

function getSelectedTransforms() {
  return TRANSFORMS
    .map(({name}) => name)
    .filter(name => config.selectedTransforms[name]);
}

function runSucrase() {
  return runAndProfile(() =>
    Sucrase.transform(config.code, {transforms: getSelectedTransforms()})
  );
}

function runBabel() {
  let babelPlugins = TRANSFORMS
    .filter(({name}) => config.selectedTransforms[name])
    .map(({babelName}) => babelName)
    .filter(name => name);
  const babelPresets = TRANSFORMS
    .filter(({name}) => config.selectedTransforms[name])
    .map(({presetName}) => presetName)
    .filter(name => name);
  if (babelPlugins.includes('add-module-exports')) {
    babelPlugins = [
      'add-module-exports',
      ...babelPlugins.filter(p => p !== 'add-module-exports')
    ];
  }
  return runAndProfile(() =>
    Babel.transform(config.code, {
      presets: babelPresets,
      plugins: babelPlugins,
      parserOpts: {plugins: ['jsx', 'classProperties']}
    }).code
  );
}

function runAndProfile(runOperation) {
  try {
    const start = performance.now();
    const code = runOperation();
    const time = performance.now() - start;
    return {code, time};
  } catch (e) {
    console.error(e);
    return {code: e.message, time: null};
  }
}
