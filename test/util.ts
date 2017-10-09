import * as assert from 'assert';

import { transform, Transform } from '../src';

export function assertResult(
  code: string, expectedResult: string, transforms: Array<Transform> = ['jsx', 'imports']
): void {
  assert.equal(transform(code, {transforms}), expectedResult);
}
