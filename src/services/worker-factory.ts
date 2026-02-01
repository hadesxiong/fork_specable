import { wrap, type Remote } from 'comlink';

type WorkerModule = 'validator' | 'linter' | 'graph' | 'diff';

const workerUrls: Record<WorkerModule, () => URL> = {
  validator: () => new URL('../workers/validator.worker.ts', import.meta.url),
  linter: () => new URL('../workers/linter.worker.ts', import.meta.url),
  graph: () => new URL('../workers/graph.worker.ts', import.meta.url),
  diff: () => new URL('../workers/diff.worker.ts', import.meta.url),
};

/**
 * Creates a web worker and wraps it with Comlink for typed RPC.
 *
 * @param module - The worker module to load
 * @returns A tuple of [wrappedApi, rawWorker] for the specified worker type
 */
export function createWorker<T>(module: WorkerModule): [Remote<T>, Worker] {
  const url = workerUrls[module]();
  const worker = new Worker(url, { type: 'module' });

  worker.onerror = (e) => {
    console.error(`${module} worker error:`, e);
  };

  const api = wrap<T>(worker);
  return [api, worker];
}

/**
 * Creates a lazily-initialised worker singleton.
 * The worker is only created on first access.
 */
export function createLazyWorker<T>(module: WorkerModule): () => Remote<T> {
  let api: Remote<T> | null = null;

  return () => {
    if (!api) {
      const [wrappedApi] = createWorker<T>(module);
      api = wrappedApi;
    }
    return api;
  };
}
