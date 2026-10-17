export type LoginBucket = {
  failures: number[];
  references: number;
  tail: Promise<void>;
};

export function pruneLoginFailures(bucket: LoginBucket, now: number, windowMs: number): void {
  bucket.failures = bucket.failures.filter((time) => now - time < windowMs);
}

export async function lockLoginBucket(bucket: LoginBucket): Promise<() => void> {
  const previous = bucket.tail;
  let release = (): void => undefined;
  bucket.tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  return release;
}
