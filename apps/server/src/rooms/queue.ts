/**
 * One queue per room: intents, timers and host commands run one at a time, in arrival order, so two
 * calls that arrive together (or a timer firing while a call is applied) can never both apply. Today
 * every handler is synchronous; the queue is what keeps that true once one awaits a database write.
 */
export type Queue = {
  enqueue(task: () => void | Promise<void>): Promise<void>;
};

export function createQueue(onError: (error: unknown) => void): Queue {
  let tail: Promise<void> = Promise.resolve();
  return {
    enqueue(task) {
      const run = tail.then(task).catch(onError);
      tail = run;
      return run;
    },
  };
}
