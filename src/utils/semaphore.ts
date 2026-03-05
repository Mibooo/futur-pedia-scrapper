import type { Semaphore } from "../types";

export function createSemaphore(max: number): Semaphore {
  let count = 0;
  const queue: Array<() => void> = [];

  async function acquire(): Promise<void> {
    if (count < max) {
      count++;
      return;
    }
    await new Promise<void>((resolve) => queue.push(resolve));
    count++;
  }

  function release(): void {
    count--;
    if (queue.length > 0) {
      queue.shift()!();
    }
  }

  return { acquire, release };
}
