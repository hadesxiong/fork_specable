import { createLazyWorker } from './worker-factory'
import type { ValidatorWorkerApi } from '../workers/types'

export const getValidatorWorker = createLazyWorker<ValidatorWorkerApi>(
  () =>
    new Worker(new URL('../workers/validator.worker.ts', import.meta.url), {
      type: 'module',
    }),
)
