import type { OpenAPIV3 } from 'openapi-types';

export interface ValidationError {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  path: string;
  severity: 'error' | 'warning' | 'info';
  rule?: string;
}

export interface SourcePosition {
  line: number;
  column: number;
}

export interface SourceMap {
  [jsonPath: string]: SourcePosition;
}

export interface ValidationResult {
  valid: boolean;
  syntaxValid: boolean;
  schemaValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  parsedSpec: OpenAPIV3.Document | null;
  sourceMap: SourceMap;
  parseTimeMs: number;
  validateTimeMs: number;
}

export interface LintDiagnostic {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  code: string;
  path: string[];
}

export interface LintResult {
  diagnostics: LintDiagnostic[];
  lintTimeMs: number;
}

export interface ValidatorWorkerApi {
  validate(content: string): Promise<ValidationResult>;
}

export interface LinterWorkerApi {
  lint(content: string): Promise<LintResult>;
}
