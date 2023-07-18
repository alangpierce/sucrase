import A from "../A";

async function foo() {
  const B = (await import("../B")).default;
  console.log(A + B);
}
