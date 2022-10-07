test("addition", async () => {
  // Assert that module is defined to confirm that this is a CJS file.
  expect(module).toBeTruthy();

  // This dynamic import should be preserved, not transformed to require.
  const {one} = await import("./main");
  expect(one + one).toBe(2 as number);
});
