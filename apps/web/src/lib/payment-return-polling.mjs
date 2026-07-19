export const PAYMENT_RETURN_DELAYS_MS = Object.freeze([
  0,
  1_000,
  2_000,
  3_000,
  5_000,
  8_000,
  10_000,
  12_000,
]);

export async function pollPaymentReturn({
  confirm,
  signal,
  delaysMs = PAYMENT_RETURN_DELAYS_MS,
  wait = waitForPaymentDelay,
}) {
  for (let index = 0; index < delaysMs.length; index += 1) {
    if (signal?.aborted) {
      return { kind: "aborted" };
    }

    const delayMs = delaysMs[index];
    if (delayMs > 0) {
      try {
        await wait(delayMs, signal);
      } catch (error) {
        if (signal?.aborted || error?.name === "AbortError") {
          return { kind: "aborted" };
        }
        throw error;
      }
    }

    if (signal?.aborted) {
      return { kind: "aborted" };
    }

    const result = await confirm({ attempt: index + 1, signal });
    if (result.kind !== "pending") {
      return result;
    }
  }

  return { kind: "timeout" };
}

export function waitForPaymentDelay(delayMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    function onAbort() {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      reject(createAbortError());
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}
