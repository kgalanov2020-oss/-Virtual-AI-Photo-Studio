import assert from "node:assert/strict";
import test from "node:test";
import { pollPaymentReturn } from "./payment-return-polling.mjs";

test("payment return keeps checking after pending responses until confirmed", async () => {
  const attempts = [];
  const waits = [];
  const results = [
    { kind: "pending" },
    { kind: "pending" },
    { kind: "confirmed" },
  ];

  const result = await pollPaymentReturn({
    delaysMs: [0, 1_000, 2_000, 3_000],
    wait: async (delayMs) => waits.push(delayMs),
    confirm: async ({ attempt }) => {
      attempts.push(attempt);
      return results.shift();
    },
  });

  assert.deepEqual(result, { kind: "confirmed" });
  assert.deepEqual(attempts, [1, 2, 3]);
  assert.deepEqual(waits, [1_000, 2_000]);
});

test("payment return stops after the bounded retry schedule", async () => {
  let confirmCalls = 0;

  const result = await pollPaymentReturn({
    delaysMs: [0, 1, 2],
    wait: async () => {},
    confirm: async () => {
      confirmCalls += 1;
      return { kind: "pending" };
    },
  });

  assert.deepEqual(result, { kind: "timeout" });
  assert.equal(confirmCalls, 3);
});

test("payment return cancellation prevents another provider check", async () => {
  const controller = new AbortController();
  let confirmCalls = 0;

  const result = await pollPaymentReturn({
    signal: controller.signal,
    delaysMs: [0, 1_000],
    wait: async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    },
    confirm: async () => {
      confirmCalls += 1;
      return { kind: "pending" };
    },
  });

  assert.deepEqual(result, { kind: "aborted" });
  assert.equal(confirmCalls, 1);
});
