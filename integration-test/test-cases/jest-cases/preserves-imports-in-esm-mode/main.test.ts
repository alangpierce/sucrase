// This static import should be preserved rather than transformed to require.
import {one} from "./main";

test("addition", () => {
  expect(one + one).toBe(2 as number);
});
