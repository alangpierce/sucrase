// Generated file, do not edit! Run "yarn generate" to re-generate this file.
/* eslint-disable default-case */
import {input, state} from "../parser/base";
import {charCodes} from "../util/charcodes";
import {isIdentifierChar} from "../util/identifier";
import {ContextualKeyword, finishToken} from "./index";
import {TokenType as tt} from "./types";

export default function readWord(): void {
  switch (input.charCodeAt(state.pos++)) {
    case charCodes.uppercaseR:
      if (
        input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
        input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
        input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
        input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
        !isIdentifierChar(input.charCodeAt(state.pos)) &&
        input.charCodeAt(state.pos) !== charCodes.backslash
      ) {
        finishToken(tt.name, ContextualKeyword._React);
        return;
      }
      break;
    case charCodes.lowercaseA:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseB:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseR &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._abstract);
            return;
          }
          break;
        case charCodes.lowercaseS:
          if (
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._as);
            return;
          }
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseY &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseN &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._async);
            return;
          }
          break;
        case charCodes.lowercaseW:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseI &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._await);
            return;
          }
          break;
      }
      break;
    case charCodes.lowercaseB:
      if (
        input.charCodeAt(state.pos++) === charCodes.lowercaseR &&
        input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
        input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
        input.charCodeAt(state.pos++) === charCodes.lowercaseK &&
        !isIdentifierChar(input.charCodeAt(state.pos)) &&
        input.charCodeAt(state.pos) !== charCodes.backslash
      ) {
        finishToken(tt._break);
        return;
      }
      break;
    case charCodes.lowercaseC:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseA:
          switch (input.charCodeAt(state.pos++)) {
            case charCodes.lowercaseS:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt._case);
                return;
              }
              break;
            case charCodes.lowercaseT:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseH &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt._catch);
                return;
              }
              break;
          }
          break;
        case charCodes.lowercaseH:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseK &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._checks);
            return;
          }
          break;
        case charCodes.lowercaseL:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._class);
            return;
          }
          break;
        case charCodes.lowercaseO:
          if (input.charCodeAt(state.pos++) === charCodes.lowercaseN) {
            switch (input.charCodeAt(state.pos++)) {
              case charCodes.lowercaseS:
                if (input.charCodeAt(state.pos++) === charCodes.lowercaseT) {
                  if (
                    !isIdentifierChar(input.charCodeAt(state.pos)) &&
                    input.charCodeAt(state.pos) !== charCodes.backslash
                  ) {
                    finishToken(tt._const);
                    return;
                  }
                  if (
                    input.charCodeAt(state.pos++) === charCodes.lowercaseR &&
                    input.charCodeAt(state.pos++) === charCodes.lowercaseU &&
                    input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
                    input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
                    input.charCodeAt(state.pos++) === charCodes.lowercaseO &&
                    input.charCodeAt(state.pos++) === charCodes.lowercaseR &&
                    !isIdentifierChar(input.charCodeAt(state.pos)) &&
                    input.charCodeAt(state.pos) !== charCodes.backslash
                  ) {
                    finishToken(tt.name, ContextualKeyword._constructor);
                    return;
                  }
                }
                break;
              case charCodes.lowercaseT:
                if (
                  input.charCodeAt(state.pos++) === charCodes.lowercaseI &&
                  input.charCodeAt(state.pos++) === charCodes.lowercaseN &&
                  input.charCodeAt(state.pos++) === charCodes.lowercaseU &&
                  input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                  !isIdentifierChar(input.charCodeAt(state.pos)) &&
                  input.charCodeAt(state.pos) !== charCodes.backslash
                ) {
                  finishToken(tt._continue);
                  return;
                }
                break;
            }
          }
          break;
        case charCodes.lowercaseR:
          if (input.charCodeAt(state.pos++) === charCodes.lowercaseE) {
            if (input.charCodeAt(state.pos++) === charCodes.lowercaseA) {
              if (input.charCodeAt(state.pos++) === charCodes.lowercaseT) {
                if (input.charCodeAt(state.pos++) === charCodes.lowercaseE) {
                  switch (input.charCodeAt(state.pos++)) {
                    case charCodes.uppercaseC:
                      if (
                        input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
                        input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
                        input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
                        input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
                        !isIdentifierChar(input.charCodeAt(state.pos)) &&
                        input.charCodeAt(state.pos) !== charCodes.backslash
                      ) {
                        finishToken(tt.name, ContextualKeyword._createClass);
                        return;
                      }
                      break;
                    case charCodes.uppercaseR:
                      if (
                        input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                        input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
                        input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
                        input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
                        input.charCodeAt(state.pos++) === charCodes.uppercaseC &&
                        input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
                        input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
                        input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
                        input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
                        !isIdentifierChar(input.charCodeAt(state.pos)) &&
                        input.charCodeAt(state.pos) !== charCodes.backslash
                      ) {
                        finishToken(tt.name, ContextualKeyword._createReactClass);
                        return;
                      }
                      break;
                  }
                }
              }
            }
          }
          break;
      }
      break;
    case charCodes.lowercaseD:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseE:
          switch (input.charCodeAt(state.pos++)) {
            case charCodes.lowercaseB:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseU &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseG &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseG &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseR &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt._debugger);
                return;
              }
              break;
            case charCodes.lowercaseC:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseR &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt.name, ContextualKeyword._declare);
                return;
              }
              break;
            case charCodes.lowercaseF:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseU &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt._default);
                return;
              }
              break;
            case charCodes.lowercaseL:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt._delete);
                return;
              }
              break;
          }
          break;
        case charCodes.lowercaseI:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseP &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseY &&
            input.charCodeAt(state.pos++) === charCodes.uppercaseN &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseM &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._displayName);
            return;
          }
          break;
        case charCodes.lowercaseO:
          if (
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._do);
            return;
          }
          break;
      }
      break;
    case charCodes.lowercaseE:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseL:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._else);
            return;
          }
          break;
        case charCodes.lowercaseN:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseU &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseM &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._enum);
            return;
          }
          break;
        case charCodes.lowercaseX:
          switch (input.charCodeAt(state.pos++)) {
            case charCodes.lowercaseP:
              if (input.charCodeAt(state.pos++) === charCodes.lowercaseO) {
                if (input.charCodeAt(state.pos++) === charCodes.lowercaseR) {
                  if (input.charCodeAt(state.pos++) === charCodes.lowercaseT) {
                    if (
                      !isIdentifierChar(input.charCodeAt(state.pos)) &&
                      input.charCodeAt(state.pos) !== charCodes.backslash
                    ) {
                      finishToken(tt._export);
                      return;
                    }
                    if (
                      input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
                      !isIdentifierChar(input.charCodeAt(state.pos)) &&
                      input.charCodeAt(state.pos) !== charCodes.backslash
                    ) {
                      finishToken(tt.name, ContextualKeyword._exports);
                      return;
                    }
                  }
                }
              }
              break;
            case charCodes.lowercaseT:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseN &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseD &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt._extends);
                return;
              }
              break;
          }
          break;
      }
      break;
    case charCodes.lowercaseF:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseA:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._false);
            return;
          }
          break;
        case charCodes.lowercaseI:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseN &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseY &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._finally);
            return;
          }
          break;
        case charCodes.lowercaseO:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseR &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._for);
            return;
          }
          break;
        case charCodes.lowercaseR:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseO &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseM &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._from);
            return;
          }
          break;
        case charCodes.lowercaseU:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseN &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseI &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseO &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseN &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._function);
            return;
          }
          break;
      }
      break;
    case charCodes.lowercaseG:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseE:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._get);
            return;
          }
          break;
        case charCodes.lowercaseL:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseO &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseB &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._global);
            return;
          }
          break;
      }
      break;
    case charCodes.lowercaseI:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseF:
          if (
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._if);
            return;
          }
          break;
        case charCodes.lowercaseM:
          if (input.charCodeAt(state.pos++) === charCodes.lowercaseP) {
            switch (input.charCodeAt(state.pos++)) {
              case charCodes.lowercaseL:
                if (
                  input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                  input.charCodeAt(state.pos++) === charCodes.lowercaseM &&
                  input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                  input.charCodeAt(state.pos++) === charCodes.lowercaseN &&
                  input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
                  input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
                  !isIdentifierChar(input.charCodeAt(state.pos)) &&
                  input.charCodeAt(state.pos) !== charCodes.backslash
                ) {
                  finishToken(tt.name, ContextualKeyword._implements);
                  return;
                }
                break;
              case charCodes.lowercaseO:
                if (
                  input.charCodeAt(state.pos++) === charCodes.lowercaseR &&
                  input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
                  !isIdentifierChar(input.charCodeAt(state.pos)) &&
                  input.charCodeAt(state.pos) !== charCodes.backslash
                ) {
                  finishToken(tt._import);
                  return;
                }
                break;
            }
          }
          break;
        case charCodes.lowercaseN:
          if (
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._in);
            return;
          }
          switch (input.charCodeAt(state.pos++)) {
            case charCodes.lowercaseS:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseN &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseO &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseF &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt._instanceof);
                return;
              }
              break;
            case charCodes.lowercaseT:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseR &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseF &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt.name, ContextualKeyword._interface);
                return;
              }
              break;
          }
          break;
        case charCodes.lowercaseS:
          if (
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._is);
            return;
          }
          break;
      }
      break;
    case charCodes.lowercaseK:
      if (
        input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
        input.charCodeAt(state.pos++) === charCodes.lowercaseY &&
        input.charCodeAt(state.pos++) === charCodes.lowercaseO &&
        input.charCodeAt(state.pos++) === charCodes.lowercaseF &&
        !isIdentifierChar(input.charCodeAt(state.pos)) &&
        input.charCodeAt(state.pos) !== charCodes.backslash
      ) {
        finishToken(tt.name, ContextualKeyword._keyof);
        return;
      }
      break;
    case charCodes.lowercaseL:
      if (
        input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
        input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
        !isIdentifierChar(input.charCodeAt(state.pos)) &&
        input.charCodeAt(state.pos) !== charCodes.backslash
      ) {
        finishToken(tt._let);
        return;
      }
      break;
    case charCodes.lowercaseM:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseI:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseX &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseI &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseN &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._mixins);
            return;
          }
          break;
        case charCodes.lowercaseO:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseD &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseU &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._module);
            return;
          }
          break;
      }
      break;
    case charCodes.lowercaseN:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseA:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseM &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseP &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._namespace);
            return;
          }
          break;
        case charCodes.lowercaseE:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseW &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._new);
            return;
          }
          break;
        case charCodes.lowercaseU:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._null);
            return;
          }
          break;
      }
      break;
    case charCodes.lowercaseO:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseF:
          if (
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._of);
            return;
          }
          break;
        case charCodes.lowercaseP:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseQ &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseU &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._opaque);
            return;
          }
          break;
      }
      break;
    case charCodes.lowercaseP:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseR:
          switch (input.charCodeAt(state.pos++)) {
            case charCodes.lowercaseI:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseV &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt.name, ContextualKeyword._private);
                return;
              }
              break;
            case charCodes.lowercaseO:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseD &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt.name, ContextualKeyword._protected);
                return;
              }
              break;
          }
          break;
        case charCodes.lowercaseU:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseB &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseI &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._public);
            return;
          }
          break;
      }
      break;
    case charCodes.lowercaseR:
      if (input.charCodeAt(state.pos++) === charCodes.lowercaseE) {
        switch (input.charCodeAt(state.pos++)) {
          case charCodes.lowercaseA:
            if (
              input.charCodeAt(state.pos++) === charCodes.lowercaseD &&
              input.charCodeAt(state.pos++) === charCodes.lowercaseO &&
              input.charCodeAt(state.pos++) === charCodes.lowercaseN &&
              input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
              input.charCodeAt(state.pos++) === charCodes.lowercaseY &&
              !isIdentifierChar(input.charCodeAt(state.pos)) &&
              input.charCodeAt(state.pos) !== charCodes.backslash
            ) {
              finishToken(tt.name, ContextualKeyword._readonly);
              return;
            }
            break;
          case charCodes.lowercaseQ:
            if (
              input.charCodeAt(state.pos++) === charCodes.lowercaseU &&
              input.charCodeAt(state.pos++) === charCodes.lowercaseI &&
              input.charCodeAt(state.pos++) === charCodes.lowercaseR &&
              input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
              !isIdentifierChar(input.charCodeAt(state.pos)) &&
              input.charCodeAt(state.pos) !== charCodes.backslash
            ) {
              finishToken(tt.name, ContextualKeyword._require);
              return;
            }
            break;
          case charCodes.lowercaseT:
            if (
              input.charCodeAt(state.pos++) === charCodes.lowercaseU &&
              input.charCodeAt(state.pos++) === charCodes.lowercaseR &&
              input.charCodeAt(state.pos++) === charCodes.lowercaseN &&
              !isIdentifierChar(input.charCodeAt(state.pos)) &&
              input.charCodeAt(state.pos) !== charCodes.backslash
            ) {
              finishToken(tt._return);
              return;
            }
            break;
        }
      }
      break;
    case charCodes.lowercaseS:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseE:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._set);
            return;
          }
          break;
        case charCodes.lowercaseT:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseA &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseI &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt.name, ContextualKeyword._static);
            return;
          }
          break;
        case charCodes.lowercaseU:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseP &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseR &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._super);
            return;
          }
          break;
        case charCodes.lowercaseW:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseI &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseC &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseH &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._switch);
            return;
          }
          break;
      }
      break;
    case charCodes.lowercaseT:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseH:
          switch (input.charCodeAt(state.pos++)) {
            case charCodes.lowercaseI:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseS &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt._this);
                return;
              }
              break;
            case charCodes.lowercaseR:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseO &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseW &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt._throw);
                return;
              }
              break;
          }
          break;
        case charCodes.lowercaseR:
          switch (input.charCodeAt(state.pos++)) {
            case charCodes.lowercaseU:
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt._true);
                return;
              }
              break;
            case charCodes.lowercaseY:
              if (
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt._try);
                return;
              }
              break;
          }
          break;
        case charCodes.lowercaseY:
          if (input.charCodeAt(state.pos++) === charCodes.lowercaseP) {
            if (input.charCodeAt(state.pos++) === charCodes.lowercaseE) {
              if (
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt.name, ContextualKeyword._type);
                return;
              }
              if (
                input.charCodeAt(state.pos++) === charCodes.lowercaseO &&
                input.charCodeAt(state.pos++) === charCodes.lowercaseF &&
                !isIdentifierChar(input.charCodeAt(state.pos)) &&
                input.charCodeAt(state.pos) !== charCodes.backslash
              ) {
                finishToken(tt._typeof);
                return;
              }
            }
          }
          break;
      }
      break;
    case charCodes.lowercaseV:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseA:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseR &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._var);
            return;
          }
          break;
        case charCodes.lowercaseO:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseI &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseD &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._void);
            return;
          }
          break;
      }
      break;
    case charCodes.lowercaseW:
      switch (input.charCodeAt(state.pos++)) {
        case charCodes.lowercaseH:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseI &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._while);
            return;
          }
          break;
        case charCodes.lowercaseI:
          if (
            input.charCodeAt(state.pos++) === charCodes.lowercaseT &&
            input.charCodeAt(state.pos++) === charCodes.lowercaseH &&
            !isIdentifierChar(input.charCodeAt(state.pos)) &&
            input.charCodeAt(state.pos) !== charCodes.backslash
          ) {
            finishToken(tt._with);
            return;
          }
          break;
      }
      break;
    case charCodes.lowercaseY:
      if (
        input.charCodeAt(state.pos++) === charCodes.lowercaseI &&
        input.charCodeAt(state.pos++) === charCodes.lowercaseE &&
        input.charCodeAt(state.pos++) === charCodes.lowercaseL &&
        input.charCodeAt(state.pos++) === charCodes.lowercaseD &&
        !isIdentifierChar(input.charCodeAt(state.pos)) &&
        input.charCodeAt(state.pos) !== charCodes.backslash
      ) {
        finishToken(tt._yield);
        return;
      }
      break;
  }

  state.pos--;
  while (state.pos < input.length) {
    const ch = input.charCodeAt(state.pos);
    if (isIdentifierChar(ch)) {
      state.pos++;
    } else if (ch === charCodes.backslash) {
      // \u
      state.pos += 2;
      if (input.charCodeAt(state.pos) === charCodes.leftCurlyBrace) {
        while (input.charCodeAt(state.pos) !== charCodes.leftCurlyBrace) {
          state.pos++;
        }
        state.pos++;
      }
    } else {
      break;
    }
  }
  finishToken(tt.name);
}
