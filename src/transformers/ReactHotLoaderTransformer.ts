import {IdentifierRole, isTopLevelDeclaration} from "../parser/tokenizer";
import type TokenProcessor from "../TokenProcessor";
import Transformer from "./Transformer";

export default class ReactHotLoaderTransformer extends Transformer {
  private extractedDefaultExportName: string | null = null;

  constructor(readonly tokens: TokenProcessor, readonly filePath: string) {
    super();
  }

  setExtractedDefaultExportName(extractedDefaultExportName: string): void {
    this.extractedDefaultExportName = extractedDefaultExportName;
  }

  getPrefixCode(): string {
    return `
      (function () {
        var enterModule = require('react-hot-loader').enterModule;
        enterModule && enterModule(module);
      })();`
      .replace(/\s+/g, " ")
      .trim();
  }

  getSuffixCode(): string {
    const topLevelNames = new Set();
    for (const token of this.tokens.tokens) {
      if (
        !token.isType &&
        isTopLevelDeclaration(token) &&
        token.identifierRole !== IdentifierRole.ImportDeclaration
      ) {
        topLevelNames.add(this.tokens.identifierNameForToken(token));
      }
    }
    const namesToRegister = Array.from(topLevelNames).map((name) => ({
      variableName: name,
      uniqueLocalName: name,
    }));
    if (this.extractedDefaultExportName) {
      namesToRegister.push({
        variableName: this.extractedDefaultExportName,
        uniqueLocalName: "default",
      });
    }
    return `
;(function () {
  var reactHotLoader = require('react-hot-loader').default;
  var leaveModule = require('react-hot-loader').leaveModule;
  if (!reactHotLoader) {
    return;
  }
${namesToRegister
  .map(
    ({variableName, uniqueLocalName}) =>
      `  reactHotLoader.register(${variableName}, "${uniqueLocalName}", ${JSON.stringify(
        this.filePath || "",
      )});`,
  )
  .join("\n")}
  leaveModule(module);
})();`;
  }

  process(): boolean {
    return false;
  }
}
