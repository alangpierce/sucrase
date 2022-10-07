test("jsx elements", () => {
  // Test that the automatic runtime is being used by using JSX without a
  // React import.
  expect(<div />.type).toBe('div');
});
