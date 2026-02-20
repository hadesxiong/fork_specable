import type { Remote } from 'comlink'
import type {
  ValidatorWorkerApi,
  LinterWorkerApi,
  ValidationResult,
  LintResult,
  ValidationError,
} from '../workers/types'
import { createWorker } from './worker-factory'
import { getValidatorWorker } from './shared-workers'

export interface PipelineResult {
  validation: ValidationResult | null
  lint: LintResult | null
  totalTimeMs: number
}

export class ValidationPipeline {
  private validatorWorker: Remote<ValidatorWorkerApi> | null = null
  private linterWorker: Remote<LinterWorkerApi> | null = null
  private pendingValidation: AbortController | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private debounceGeneration = 0

  private callWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      )
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
  }

  async initialise() {
    if (!this.validatorWorker) {
      this.validatorWorker = getValidatorWorker()
    }

    if (!this.linterWorker) {
      try {
        const [api] = createWorker<LinterWorkerApi>(
          new Worker(new URL('../workers/linter.worker.ts', import.meta.url), {
            type: 'module',
          }),
        )
        this.linterWorker = api
      } catch (e) {
        console.error('Failed to create linter worker:', e)
        throw e
      }
    }
  }

  async validate(
    content: string,
    onProgress?: (
      stage: 'validating' | 'linting' | 'complete',
      result: Partial<PipelineResult>,
    ) => void,
  ): Promise<PipelineResult> {
    // Cancel any pending validation
    this.pendingValidation?.abort()
    this.pendingValidation = new AbortController()
    const signal = this.pendingValidation.signal

    await this.initialise()

    const startTime = performance.now()
    const result: PipelineResult = {
      validation: null,
      lint: null,
      totalTimeMs: 0,
    }

    // Stage 1: Schema validation
    if (signal.aborted) throw new Error('Validation cancelled')

    onProgress?.('validating', result)

    try {
      result.validation = await this.callWithTimeout(
        this.validatorWorker!.validate(content),
        30_000,
        'Validation worker',
      )
      onProgress?.('validating', result)
    } catch (e) {
      console.error('Validation worker failed:', e)
      if (signal.aborted) throw new Error('Validation cancelled')
      throw e
    }

    // Stage 2: Linting (only if syntax is valid)
    if (!signal.aborted && result.validation?.syntaxValid) {
      onProgress?.('linting', result)

      try {
        result.lint = await this.callWithTimeout(
          this.linterWorker!.lint(content),
          15_000,
          'Linter worker',
        )
        onProgress?.('linting', result)
      } catch (e) {
        if (signal.aborted) throw new Error('Validation cancelled')
        console.error('Linting failed:', e)
      }
    }

    result.totalTimeMs = performance.now() - startTime
    onProgress?.('complete', result)

    return result
  }

  validateDebounced(
    content: string,
    onProgress?: (
      stage: 'validating' | 'linting' | 'complete',
      result: Partial<PipelineResult>,
    ) => void,
    debounceMs = 300,
  ): Promise<PipelineResult> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    const generation = ++this.debounceGeneration

    return new Promise((resolve, reject) => {
      this.debounceTimer = setTimeout(async () => {
        if (generation !== this.debounceGeneration) return
        try {
          const result = await this.validate(content, onProgress)
          if (generation === this.debounceGeneration) {
            resolve(result)
          }
        } catch (e) {
          if (generation === this.debounceGeneration) {
            reject(e)
          }
        }
      }, debounceMs)
    })
  }

  cancel() {
    this.pendingValidation?.abort()
    this.debounceGeneration++
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  terminate() {
    this.cancel()
    // Workers are terminated when the page unloads
  }
}

// Singleton instance
let pipelineInstance: ValidationPipeline | null = null

export function getValidationPipeline(): ValidationPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new ValidationPipeline()
  }
  return pipelineInstance
}

// Convert lint diagnostics to validation errors for unified display
export function lintToValidationErrors(lint: LintResult): ValidationError[] {
  return lint.diagnostics.map((d) => ({
    line: d.line,
    column: d.column,
    endLine: d.endLine,
    endColumn: d.endColumn,
    message: d.message,
    path: d.path.join('.'),
    severity: d.severity === 'hint' ? 'info' : d.severity,
    rule: d.code,
  }))
}
