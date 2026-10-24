import type { CommercialController } from './controller';

export type CommercialReadWave = Readonly<{
  publicEpoch: number;
  sources: readonly Readonly<{ path: string; version: number }>[];
}>;

export class CommercialReadOwner {
  private active = true;
  private publicEpoch = 0;
  private publicPending = 0;
  public completedPublicReads = 0;
  public completedFullLoads = 0;
  public sourceRevision = 0;
  private readonly successfulSources = new Set<string>();
  private readonly sourceVersions = new Map<string, number>();
  private readonly idleWaiters = new Set<() => void>();

  public constructor(private readonly sessionIsCurrent: () => boolean) {}

  public isAlive(): boolean {
    try {
      return this.active && this.sessionIsCurrent();
    } catch {
      return false;
    }
  }

  public beginPublicRead(fullLoad = false): () => void {
    this.publicEpoch += 1;
    this.publicPending += 1;
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      this.publicPending -= 1;
      this.completedPublicReads += 1;
      if (fullLoad) this.completedFullLoads += 1;
      if (this.publicPending === 0) this.releaseWaiters();
    };
  }

  public waitUntilIdle(): Promise<void> {
    if (!this.isAlive() || this.publicPending === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.add(resolve));
  }

  public isIdle(): boolean {
    return this.publicPending === 0;
  }

  public noteSuccess(path: string): void {
    this.successfulSources.add(path);
    this.sourceRevision += 1;
  }

  public sourcePaths(): ReadonlySet<string> {
    return this.successfulSources;
  }

  public claim(paths: readonly string[]): CommercialReadWave {
    return {
      publicEpoch: this.publicEpoch,
      sources: paths.map((path) => {
        const version = (this.sourceVersions.get(path) ?? 0) + 1;
        this.sourceVersions.set(path, version);
        return { path, version };
      }),
    };
  }

  public accepts(wave: CommercialReadWave): boolean {
    return (
      this.isAlive() &&
      this.publicPending === 0 &&
      this.publicEpoch === wave.publicEpoch &&
      wave.sources.every((source) => this.sourceVersions.get(source.path) === source.version)
    );
  }

  public dispose(): void {
    this.active = false;
    this.releaseWaiters();
  }

  private releaseWaiters(): void {
    for (const resolve of this.idleWaiters) resolve();
    this.idleWaiters.clear();
  }
}

const owners = new WeakMap<object, CommercialReadOwner>();
const noop = () => {
  return;
};

export function beginCommercialCostRead(controller: object, publicRead: boolean): () => void {
  return publicRead ? (owners.get(controller)?.beginPublicRead() ?? noop) : noop;
}

export function noteCommercialSourceRead(controller: object, path: string): void {
  owners.get(controller)?.noteSuccess(path);
}

export function attachCommercialReadOwner(
  controller: object,
  sessionIsCurrent: () => boolean,
): CommercialReadOwner {
  owners.get(controller)?.dispose();
  const owner = new CommercialReadOwner(sessionIsCurrent);
  owners.set(controller, owner);
  return owner;
}

export function beginCommercialRead(
  controller: Pick<CommercialController, 'loading'>,
  fullLoad = true,
): () => void {
  const finish = owners.get(controller)?.beginPublicRead(fullLoad) ?? noop;
  try {
    controller.loading = true;
  } catch (failure) {
    finish();
    throw failure;
  }
  return finish;
}

export function endCommercialRead(
  controller: Pick<CommercialController, 'loading'>,
  finish: () => void,
): void {
  try {
    controller.loading = false;
  } finally {
    finish();
  }
}
