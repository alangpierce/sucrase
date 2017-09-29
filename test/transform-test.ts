import * as assert from 'assert';

import transform from '../src/transform';

describe('transform', () => {
  it('transforms a self-closing JSX element', () => {
    assert.equal(transform('<Foo />'), 'React.createElement(Foo )')
  });

  it('transforms nested JSX elements', () => {
    assert.equal(transform('<div><span></span></div>'), 'React.createElement(Foo)')
  });

  it('transforms interpolated children', () => {
    assert.equal(transform('<div>{x}</div>'), 'React.createElement(Foo)')
  });

  it('handles string property values', () => {
    assert.equal(transform("<A foo='bar' />"), 'React.createElement(Foo)')
  });
});
