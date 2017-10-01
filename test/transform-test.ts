import * as assert from 'assert';

import {transform} from '../src/index';

function assertResult(code: string, expectedResult: string): void {
  assert.equal(transform(code), expectedResult);
}

describe('transform', () => {
  it('transforms a self-closing JSX element', () => {
    assertResult(`
      <Foo />
    `, `
      React.createElement(Foo, null )
    `);
  });

  it('transforms nested JSX elements', () => {
    assertResult(`
      <div><span></span></div>
    `, `
      React.createElement('div', null, React.createElement('span', null))
    `);
  });

  it('transforms interpolated children', () => {
    assertResult(`
      <div>{x}</div>
    `, `
      React.createElement('div', null, x)
    `);
  });

  it('handles string property values', () => {
    assertResult(`
      <A foo='bar' />
    `, `
      React.createElement(A, { foo: 'bar',} )
    `);
  });

  it('handles inline comments', () => {
    assertResult(`
      <A
        b='c' // A comment
        d='e' /* Another comment */
      />
    `, `
      React.createElement(A, {
        b: 'c', // A comment
        d: 'e',} /* Another comment */
      )
    `);
  });

  it('handles multiline strings', () => {
    assertResult(`
      const x = (
        <div>
          foo  bar
          baz
        </div>
      );
    `, `
      const x = (
        React.createElement('div', null, "foo  bar baz"


        )
      );
    `);
  });

  it('handles nested JSX tags', () => {
    assertResult(`
      const x = (
        <div>
          <Span />
        </div>
      );
    `, `
      const x = (
        React.createElement('div', null
          , React.createElement(Span, null )
        )
      );
    `);
  });

  it('handles complex lower-case tag values', () => {
    assertResult(`
      <a.b c='d' />
    `, `
      React.createElement(a.b, { c: 'd',} )
    `);
  });

  it('handles prop spread operators', () => {
    assertResult(`
      <a {...b} c='d' />
    `, `
      React.createElement('a', { ...b, c: 'd',} )
    `);
  });

  it('handles HTML entities', () => {
    assertResult(`
      <span>a&nbsp;b</span>
    `, `
      React.createElement('span', null, "a b")
    `);
  });
});
