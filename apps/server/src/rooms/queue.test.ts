import { describe, expect, it, vi } from "vitest";
import { createQueue } from "./queue.ts";

describe("createQueue", () => {
  it("when a slow task is queued before a fast one, then they still finish in order", async () => {
    const queue = createQueue(() => undefined);
    const done: string[] = [];
    void queue.enqueue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      done.push("slow");
    });
    await queue.enqueue(() => {
      done.push("fast");
    });
    expect(done).toEqual(["slow", "fast"]);
  });

  it("when a task throws, then it is reported and the next task still runs", async () => {
    const onError = vi.fn();
    const queue = createQueue(onError);
    void queue.enqueue(() => {
      throw new Error("boom");
    });
    let ran = false;
    await queue.enqueue(() => {
      ran = true;
    });
    expect(onError).toHaveBeenCalledOnce();
    expect(ran).toBe(true);
  });
});
