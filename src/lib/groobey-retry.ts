const transientDatabaseMessages = [
  "schema cache",
  "retrying",
  "not accepting connections",
  "recovery mode",
  "failed to fetch",
];

export function isTransientDatabaseError(message = "") {
  const normalized = message.toLowerCase();
  return transientDatabaseMessages.some((item) => normalized.includes(item));
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function retryTransient<T>(
  operation: () => Promise<T>,
  getMessage: (result: T) => string | undefined,
  attempts = 3,
) {
  let lastResult: T | undefined;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastResult = await operation();
    const message = getMessage(lastResult);
    if (!message || !isTransientDatabaseError(message)) return lastResult;
    await wait(400 + attempt * 500);
  }
  return lastResult as T;
}
