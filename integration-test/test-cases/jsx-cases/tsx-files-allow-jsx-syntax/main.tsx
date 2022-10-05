let wasCalled: boolean = false;
const React = {
  createElement(): void {
    wasCalled = true;
  }
}
const elem = <div />;
if (!wasCalled) {
  throw new Error();
}
