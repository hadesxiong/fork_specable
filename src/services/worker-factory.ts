import { wrap, type Remote } from 'comlink';

/**
 * Wraps an existing web worker with Comlink for typed RPC.
 *
 * The caller must construct the Worker inline so that Vite can statically
 * detect the entry point and bundle it for production builds:
 *
 *   createWorker<MyApi>(
 *     new Worker(new URL('./my.worker.ts', import.meta.url), { type: 'module' })
 *   )
 */
export function createWorker<T>(worker: Worker): [Remote<T>, Worker] {
  worker.onerror = (e) => {
    console.error('Worker error:', e);
  };

  const api = wrap<T>(worker);
  return [api, worker];
}

/**
 * Creates a lazily-initialised worker singleton.
 * The worker is only created on first call to the returned function.
 *
 * The factory function must contain an inline `new Worker(new URL(...))` expression
 * so Vite can statically detect and bundle the worker entry point.
 */
export function createLazyWorker<T>(factory: () => Worker): () => Remote<T> {
  let api: Remote<T> | null = null;

  return () => {
    if (!api) {
      const [wrappedApi] = createWorker<T>(factory());
      api = wrappedApi;
    }
    return api;
  };
}
