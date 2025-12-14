import { wrap, type Remote } from 'comlink';
import type { ValidatorWorkerApi, LinterWorkerApi, ValidationResult, LintResult, ValidationError } from '../workers/types';

export interface PipelineResult {
  validation: ValidationResult | null;
  lint: LintResult | null;
  totalTimeMs: number;
}

export class ValidationPipeline {
  private validatorWorker: Remote<ValidatorWorkerApi> | null = null;
  private linterWorker: Remote<LinterWorkerApi> | null = null;
  private pendingValidation: AbortController | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingDebounceReject: ((reason: Error) => void) | null = null;

  async initialise() {
    if (!this.validatorWorker) {
      try {
        const worker = new Worker(
          new URL('../workers/validator.worker.ts', import.meta.url),
          { type: 'module' }
        );
        worker.onerror = (e) => console.error('Validator worker error:', e);
        this.validatorWorker = wrap<ValidatorWorkerApi>(worker);
      } catch (e) {
        console.error('Failed to create validator worker:', e);
        throw e;
      }
    }

    if (!this.linterWorker) {
      try {
        const worker = new Worker(
          new URL('../workers/linter.worker.ts', import.meta.url),
          { type: 'module' }
        );
        worker.onerror = (e) => console.error('Linter worker error:', e);
        this.linterWorker = wrap<LinterWorkerApi>(worker);
      } catch (e) {
        console.error('Failed to create linter worker:', e);
        throw e;
      }
    }
  }

  async validate(
    content: string,
    onProgress?: (stage: 'validating' | 'linting' | 'complete', result: Partial<PipelineResult>) => void
  ): Promise<PipelineResult> {
    // Cancel any pending validation
    this.pendingValidation?.abort();
    this.pendingValidation = new AbortController();
    const signal = this.pendingValidation.signal;

    await this.initialise();

    const startTime = performance.now();
    const result: PipelineResult = {
      validation: null,
      lint: null,
      totalTimeMs: 0,
    };

    // Stage 1: Schema validation
    if (signal.aborted) throw new Error('Validation cancelled');

    onProgress?.('validating', result);

    try {
      result.validation = await this.validatorWorker!.validate(content);
      onProgress?.('validating', result);
    } catch (e) {
      console.error('Validation worker failed:', e);
      if (signal.aborted) throw new Error('Validation cancelled');
      throw e;
    }

    // Stage 2: Linting (only if syntax is valid)
    if (!signal.aborted && result.validation?.syntaxValid) {
      onProgress?.('linting', result);

      try {
        result.lint = await this.linterWorker!.lint(content);
        onProgress?.('linting', result);
      } catch (e) {
        if (signal.aborted) throw new Error('Validation cancelled');
        // Linting errors are not fatal
        console.error('Linting failed:', e);
      }
    }

    result.totalTimeMs = performance.now() - startTime;
    onProgress?.('complete', result);

    return result;
  }

  validateDebounced(
    content: string,
    onProgress?: (stage: 'validating' | 'linting' | 'complete', result: Partial<PipelineResult>) => void,
    debounceMs = 300
  ): Promise<PipelineResult> {
    return new Promise((resolve, reject) => {
      // Cancel any pending debounced validation
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      if (this.pendingDebounceReject) {
        this.pendingDebounceReject(new Error('Validation cancelled'));
        this.pendingDebounceReject = null;
      }

      this.pendingDebounceReject = reject;

      this.debounceTimer = setTimeout(async () => {
        this.pendingDebounceReject = null;
        try {
          const result = await this.validate(content, onProgress);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      }, debounceMs);
    });
  }

  cancel() {
    this.pendingValidation?.abort();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pendingDebounceReject) {
      this.pendingDebounceReject(new Error('Validation cancelled'));
      this.pendingDebounceReject = null;
    }
  }

  terminate() {
    this.cancel();
    // Workers are terminated when the page unloads
  }
}

// Singleton instance
let pipelineInstance: ValidationPipeline | null = null;

export function getValidationPipeline(): ValidationPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new ValidationPipeline();
  }
  return pipelineInstance;
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
  }));
}
