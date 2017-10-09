import {assertResult} from './util';

describe('transform JSX', () => {
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
      React.createElement(A, { foo: "bar",} )
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
        b: "c", // A comment
        d: "e",} /* Another comment */
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
      React.createElement(a.b, { c: "d",} )
    `);
  });

  it('handles prop spread operators', () => {
    assertResult(`
      <a {...b} c='d' />
    `, `
      React.createElement('a', { ...b, c: "d",} )
    `);
  });

  it('handles HTML entities', () => {
    assertResult(`
      <span>a&gt;b</span>
    `, `
      React.createElement('span', null, "a>b")
    `);
  });

  it('handles non-breaking spaces in JSX text', () => {
    assertResult(`
      <span>
        a&nbsp;
      </span>
    `, `
      React.createElement('span', null, "a "

      )
    `);
  });

  it('handles comment-only JSX interpolations', () => {
    assertResult(`
      <div>
        <span />
        { /* foo */ }
        <span />
      </div>;
    `, `
      React.createElement('div', null
        , React.createElement('span', null )
         /* foo */ 
        , React.createElement('span', null )
      );
    `);
  });

  it('handles parsing object rest/spread', () => {
    assertResult(`
      const foo = {
        ...bar,
        baz: <Baz />,
      };
    `, `
      const foo = {
        ...bar,
        baz: React.createElement(Baz, null ),
      };
    `);
  });

  it('handles non-identifier prop names', () => {
    assertResult(`
      <div
        a={1}
        data-id={2}
      />
    `, `
      React.createElement('div', {
        a: 1,
        'data-id': 2,}
      )
    `);
  });

  it('handles multi-line prop strings', () => {
    assertResult(`
      <div
        value='This is a
               multi-line string.'
      />
    `, `
      React.createElement('div', {
        value: "This is a multi-line string."
                ,}
      )
    `);
  });

  it('handles leading and trailing spaces in multi-line prop strings', () => {
    assertResult(`
      <div
        value='   
               This is a longer
               multi-line string.
                  '
      />
    `, `
      React.createElement('div', {
        value: "    This is a longer multi-line string. "


                  ,}
      )
    `);
  });

  it('handles prop string values with entities', () => {
    assertResult(`
      <div
        value='a&gt;b'
      />
    `, `
      React.createElement('div', {
        value: "a>b",}
      )
    `);
  });
});
