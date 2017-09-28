import * as assert from 'assert';

import transform from '../src/transform';

describe('transform', () => {
  it('does a simple tranform', () => {
    assert.equal(transform('foo'), 'foo;');
  })
});
