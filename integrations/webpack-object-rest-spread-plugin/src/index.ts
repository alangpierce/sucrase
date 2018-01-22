/* eslint-disable import/first */
// @ts-ignore: No types.
import bareAcorn = require("acorn");
// @ts-ignore: No types.
import injectDynamicImport from "acorn-dynamic-import/lib/inject";
// @ts-ignore: No types.
import injectObjectRestSpread = require("acorn-object-rest-spread/inject");

const acorn = injectObjectRestSpread(injectDynamicImport(bareAcorn));

// This is ugly integration code and a lot is copied and pasted from Webpack, so just allow "any"
// everywhere.
// tslint:disable

/**
 * Patch the webpack parser to allow object rest/spread. This is heavily based on the
 * webpack-async-await project: https://github.com/MatAtBread/webpack-async-await
 */
export = class ObjectRestSpreadPlugin {
  apply(compiler: any) {
    compiler.plugin("compilation", (compilation: any, params: any) => {
      params.normalModuleFactory.plugin("parser", (parser: any) => {
        parser.parse = patchedParse;
        parser.walkObjectExpression = patchedWalkObjectExpression;
        parser.walkObjectPattern = patchedWalkObjectPattern;
      });
    });
  }
};

// All code below was copied and pasted from webpack, with small modifications.
/* eslint-disable */
const ECMA_VERSION = 2017;

const POSSIBLE_AST_OPTIONS: any = [
  {
    ranges: true,
    locations: true,
    ecmaVersion: ECMA_VERSION,
    sourceType: "module",
    plugins: {
      dynamicImport: true,
      objectRestSpread: true,
    },
  },
  {
    ranges: true,
    locations: true,
    ecmaVersion: ECMA_VERSION,
    sourceType: "script",
    plugins: {
      dynamicImport: true,
      objectRestSpread: true,
    },
  },
];

/**
 * This is a copy-paste from the Parser.parse method in Webpack, with the parse calls replaced with
 * the new acorn parser.
 */
function patchedParse(source: any, initialState: any) {
  let ast;
  const comments: any = [];
  for (let i = 0, len = POSSIBLE_AST_OPTIONS.length; i < len; i++) {
    if (!ast) {
      try {
        comments.length = 0;
        POSSIBLE_AST_OPTIONS[i].onComment = comments;
        ast = acorn.parse(source, POSSIBLE_AST_OPTIONS[i]);
      } catch (e) {
        // ignore the error
      }
    }
  }
  if (!ast) {
    // for the error
    ast = acorn.parse(source, {
      ranges: true,
      locations: true,
      ecmaVersion: ECMA_VERSION,
      sourceType: "module",
      plugins: {
        dynamicImport: true,
        objectRestSpread: true,
      },
      onComment: comments,
    });
  }
  if (!ast || typeof ast !== "object") throw new Error("Source couldn't be parsed");
  const oldScope = this.scope;
  const oldState = this.state;
  const oldComments = this.comments;
  this.scope = {
    inTry: false,
    definitions: [],
    renames: {},
  };
  const state = (this.state = initialState || {});
  this.comments = comments;
  if (this.applyPluginsBailResult("program", ast, comments) === undefined) {
    this.prewalkStatements(ast.body);
    this.walkStatements(ast.body);
  }
  this.scope = oldScope;
  this.state = oldState;
  this.comments = oldComments;
  return state;
}

function patchedWalkObjectExpression(expression: any) {
  for(let propIndex = 0, len = expression.properties.length; propIndex < len; propIndex++) {
    const prop = expression.properties[propIndex];
    if (prop.type === "SpreadElement") {
      this.walkExpression(prop.argument);
      continue;
    }
    if(prop.computed)
      this.walkExpression(prop.key);
    if(prop.shorthand)
      this.scope.inShorthand = true;
    this.walkExpression(prop.value);
    if(prop.shorthand)
      this.scope.inShorthand = false;
  }
}

function patchedWalkObjectPattern(pattern: any) {
  for(let i = 0, len = pattern.properties.length; i < len; i++) {
    const prop = pattern.properties[i];
    if (prop.type === "RestElement") {
      this.walkExpression(prop.argument);
      continue;
    }
    if(prop) {
      if(prop.computed)
        this.walkExpression(prop.key);
      if(prop.value)
        this.walkPattern(prop.value);
    }
  }
}
