import {ESMODULE_PREFIX, PREFIX} from "./prefixes";
import {assertResult} from "./util";

describe("transform react-display-name", () => {
  it("adds displayName to a React.createClass usage", () => {
    assertResult(
      `
      import React from 'react';

      const C = React.createClass({
        render() {
          return <div />;
        }
      });
    `,
      `${PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);

      const C = _react2.default.createClass({displayName: 'C',
        render() {
          return _react2.default.createElement('div', null );
        }
      });
    `,
    );
  });

  it("adds displayName to a createReactClass usage", () => {
    assertResult(
      `
      import React from 'react';
      import createReactClass from 'create-react-class';

      const C = createReactClass({
        render() {
          return <div />;
        }
      });
    `,
      `${PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);
      var _createreactclass = require('create-react-class'); var _createreactclass2 = _interopRequireDefault(_createreactclass);

      const C = (0, _createreactclass2.default)({displayName: 'C',
        render() {
          return _react2.default.createElement('div', null );
        }
      });
    `,
    );
  });

  it("does not add displayName if it is already present", () => {
    assertResult(
      `
      import React from 'react';

      const C = React.createClass({
        displayName: 'Foo',
        
        render() {
          return <div />;
        }
      });
    `,
      `${PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);

      const C = _react2.default.createClass({
        displayName: 'Foo',
        
        render() {
          return _react2.default.createElement('div', null );
        }
      });
    `,
    );
  });

  it("does not add displayName if there is no identifier to find", () => {
    assertResult(
      `
      import React from 'react';

      export default React.createClass({
        render() {
          return <div />;
        }
      });
    `,
      `${PREFIX}${ESMODULE_PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);

      exports. default = _react2.default.createClass({
        render() {
          return _react2.default.createElement('div', null );
        }
      });
    `,
    );
  });

  it("adds a displayName for a class in an object key position", () => {
    assertResult(
      `
      import React from 'react';

      const o = {
        Foo: React.createClass({
          render() {
            return null;
          },
        })
      };
    `,
      `${PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);

      const o = {
        Foo: _react2.default.createClass({displayName: 'Foo',
          render() {
            return null;
          },
        })
      };
    `,
    );
  });

  it("does not count a nested displayName key as an existing display name", () => {
    assertResult(
      `
      import React from 'react';

      const C = React.createClass({
        render() {
          const o = {displayName: 'Hello'};
          return null;
        }
      });
    `,
      `${PREFIX}
      var _react = require('react'); var _react2 = _interopRequireDefault(_react);

      const C = _react2.default.createClass({displayName: 'C',
        render() {
          const o = {displayName: 'Hello'};
          return null;
        }
      });
    `,
    );
  });
});
