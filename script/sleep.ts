export default async function sleep(timeMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, timeMs);
  });
}
