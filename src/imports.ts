import { Transformer } from './transformer';
import { RootTransformer } from './index';
import TokenProcessor from './tokens';

export default class ImportTransformer implements Transformer {
  constructor(readonly rootTransformer: RootTransformer, readonly tokens: TokenProcessor) {
  }

  process(): boolean {
    return false;
  }
}
