import GZip from 'gzip-js';
import * as Base64 from 'base64-js';

import {TRANSFORMS} from './Constants';

export function saveHashState({code, compressedCode, selectedTransforms, compareWithBabel, showTokens}) {
  let hashState = '';

  const transformsValue = TRANSFORMS
    .filter(({name}) => selectedTransforms[name])
    .map(({name}) => name)
    .join(',');

  hashState += `selectedTransforms=${transformsValue}`;
  hashState += `&compareWithBabel=${compareWithBabel}`;
  hashState += `&showTokens=${showTokens}`;

  if (code.length > 150) {
    hashState += `&compressedCode=${window.encodeURIComponent(compressedCode)}`;
  } else {
    hashState += `&code=${window.encodeURIComponent(code)}`;
  }

  window.location.hash = hashState;
}

export function loadHashState() {
  try {
    let hashContents = window.location.hash;
    if (!hashContents.startsWith('#')) {
      return null;
    }
    const components = hashContents.substr(1).split('&');
    const result = {};
    for (const component of components) {
      let [key, value] = component.split('=');
      if (key === 'selectedTransforms') {
        result.selectedTransforms = {};
        for (const transformName of value.split(',')) {
          result.selectedTransforms[transformName] = true;
        }
      } else if (key === 'code') {
        result.code = window.decodeURIComponent(value);
      } else if (key === 'compressedCode') {
        result.code = decompressCode(window.decodeURIComponent(value));
      } else if (['compareWithBabel', 'showTokens'].includes(key)) {
        result[key] = value === 'true';
      }
    }
    // Deleting code and refreshing should give the default state again.
    if (!result.code) {
      return null;
    }
    return result;
  } catch (e) {
    console.error(`Error when loading hash fragment.`);
    console.error(e);
    return null;
  }
}

export function compressCode(code) {
  return Base64.fromByteArray(GZip.zip(code));
}

function decompressCode(compressedCode) {
  return String.fromCharCode(...GZip.unzip(Base64.toByteArray(compressedCode)));
}
