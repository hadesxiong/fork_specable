import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ValidationPipeline } from './validation-pipeline';
import type { ValidationResult, LintResult } from '../workers/types';

// Worker is not defined in jsdom; stub it so the inline `new Worker()` calls don't throw
globalThis.Worker = vi.fn() as unknown as typeof Worker;

vi.mock('./worker-factory', () => ({
  createWorker: vi.fn(),
  createLazyWorker: vi.fn(),
}));

vi.mock('./shared-workers', () => ({
  getValidatorWorker: vi.fn(),
}));

import { createWorker } from './worker-factory';
import { getValidatorWorker } from './shared-workers';

function createValidationResult(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return {
    valid: true,
    syntaxValid: true,
    schemaValid: true,
    errors: [],
    warnings: [],
    parsedSpec: { openapi: '3.0.3', info: { title: 'Test', version: '1.0.0' }, paths: {} } as ValidationResult['parsedSpec'],
    sourceMap: {},
    parseTimeMs: 5,
    validateTimeMs: 10,
    ...overrides,
  };
}

function createLintResult(overrides: Partial<LintResult> = {}): LintResult {
  return {
    diagnostics: [],
    lintTimeMs: 3,
    ...overrides,
  };
}

describe('ValidationPipeline', () => {
  let pipeline: ValidationPipeline;
  let mockValidate: ReturnType<typeof vi.fn>;
  let mockLint: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();

    mockValidate = vi.fn();
    mockLint = vi.fn();

    // initialise() uses shared getValidatorWorker for validator, createWorker for linter
    vi.mocked(getValidatorWorker).mockReturnValue({ validate: mockValidate } as never);
    vi.mocked(createWorker)
      .mockReturnValueOnce([{ lint: mockLint } as never, {} as Worker]);

    pipeline = new ValidationPipeline();
  });

  afterEach(() => {
    pipeline.terminate();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('validate', () => {
    it('returns validation and lint results on success', async () => {
      const validationResult = createValidationResult();
      const lintResult = createLintResult();
      mockValidate.mockResolvedValue(validationResult);
      mockLint.mockResolvedValue(lintResult);

      const result = await pipeline.validate('openapi: 3.0.3');

      expect(result.validation).toEqual(validationResult);
      expect(result.lint).toEqual(lintResult);
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('calls onProgress at each stage', async () => {
      mockValidate.mockResolvedValue(createValidationResult());
      mockLint.mockResolvedValue(createLintResult());
      const onProgress = vi.fn();

      await pipeline.validate('openapi: 3.0.3', onProgress);

      const stages = onProgress.mock.calls.map((call) => call[0]);
      expect(stages).toEqual(['validating', 'validating', 'linting', 'linting', 'complete']);
    });

    it('skips linting when syntax is invalid', async () => {
      mockValidate.mockResolvedValue(createValidationResult({ syntaxValid: false }));

      const result = await pipeline.validate('invalid: {{{');

      expect(result.lint).toBeNull();
      expect(mockLint).not.toHaveBeenCalled();
    });

    it('rejects with timeout error when validator worker hangs', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockValidate.mockReturnValue(new Promise(() => {}));

      const validatePromise = pipeline.validate('openapi: 3.0.3');
      const rejection = validatePromise.catch((e: Error) => e);

      await vi.advanceTimersByTimeAsync(30_000);

      const error = await rejection;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Validation worker timed out after 30000ms');
    });

    it('treats linter timeout as non-fatal', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const validationResult = createValidationResult();
      mockValidate.mockResolvedValue(validationResult);
      mockLint.mockReturnValue(new Promise(() => {}));

      const validatePromise = pipeline.validate('openapi: 3.0.3');
      await vi.advanceTimersByTimeAsync(15_000);

      const result = await validatePromise;
      expect(result.validation).toEqual(validationResult);
      expect(result.lint).toBeNull();
    });

    it('initialises workers only once', async () => {
      mockValidate.mockResolvedValue(createValidationResult());
      mockLint.mockResolvedValue(createLintResult());

      await pipeline.validate('first');
      await pipeline.validate('second');

      expect(createWorker).toHaveBeenCalledTimes(1); // once for linter (validator uses shared worker)
    });
  });

  describe('validateDebounced', () => {
    it('fires immediately when debounceMs is 0', async () => {
      mockValidate.mockResolvedValue(createValidationResult());
      mockLint.mockResolvedValue(createLintResult());

      const promise = pipeline.validateDebounced('content', undefined, 0);
      // debounceMs=0 still uses setTimeout(fn, 0), so advance timers
      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result.validation).not.toBeNull();
    });

    it('debounces when debounceMs is greater than 0', async () => {
      mockValidate.mockResolvedValue(createValidationResult());
      mockLint.mockResolvedValue(createLintResult());

      const promise = pipeline.validateDebounced('content', undefined, 300);

      // Should not have called validate yet
      expect(mockValidate).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(300);
      const result = await promise;

      expect(mockValidate).toHaveBeenCalledWith('content');
      expect(result.validation).not.toBeNull();
    });

    it('cancels previous debounce when called again', async () => {
      mockValidate.mockResolvedValue(createValidationResult());
      mockLint.mockResolvedValue(createLintResult());

      // First call is superseded -- its promise never resolves (generation counter)
      pipeline.validateDebounced('first', undefined, 300);

      const second = pipeline.validateDebounced('second', undefined, 300);

      await vi.advanceTimersByTimeAsync(300);

      const result = await second;
      expect(mockValidate).toHaveBeenCalledWith('second');
      expect(mockValidate).not.toHaveBeenCalledWith('first');
      expect(result.validation).not.toBeNull();
    });
  });

  describe('cancel', () => {
    it('prevents debounce timer from firing', async () => {
      mockValidate.mockResolvedValue(createValidationResult());
      mockLint.mockResolvedValue(createLintResult());

      // The promise never settles after cancel (generation counter)
      pipeline.validateDebounced('content', undefined, 300);

      pipeline.cancel();

      await vi.advanceTimersByTimeAsync(300);
      expect(mockValidate).not.toHaveBeenCalled();
    });
  });

  describe('lintToValidationErrors', () => {
    it('converts lint diagnostics to validation errors', async () => {
      const { lintToValidationErrors } = await import('./validation-pipeline');

      const lint: LintResult = {
        diagnostics: [
          {
            line: 5,
            column: 3,
            endLine: 5,
            endColumn: 20,
            message: 'Operation must have summary',
            severity: 'warning',
            code: 'operation-summary',
            path: ['paths', '/books', 'get'],
          },
          {
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 10,
            message: 'Use https',
            severity: 'hint',
            code: 'oas3-server-https',
            path: ['servers', '0'],
          },
        ],
        lintTimeMs: 5,
      };

      const errors = lintToValidationErrors(lint);

      expect(errors).toHaveLength(2);
      expect(errors[0].severity).toBe('warning');
      expect(errors[0].path).toBe('paths./books.get');
      expect(errors[1].severity).toBe('info'); // 'hint' mapped to 'info'
    });
  });
});
