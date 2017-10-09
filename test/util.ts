import * as assert from 'assert';

import { transform } from '../src';

export function assertResult(code: string, expectedResult: string): void {
  assert.equal(transform(code, {transforms: ['jsx', 'imports']}), expectedResult);
}
