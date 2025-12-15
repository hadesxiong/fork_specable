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

// Graph types
export type GraphEdgeType = 'ref' | 'allOf' | 'anyOf' | 'oneOf' | 'items';

export interface SchemaProperty {
  name: string;
  type: string;
  required: boolean;
  refTarget?: string;
}

export interface GraphNode {
  id: string;
  type: 'schema' | 'endpoint';
  label: string;
  jsonPath: string;
  referenced: boolean;
  properties?: SchemaProperty[];
  description?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: GraphEdgeType;
  sourceProperty?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphResult {
  data: GraphData;
  computeTimeMs: number;
}

export interface GraphWorkerApi {
  buildGraph(spec: OpenAPIV3.Document, includeEndpoints: boolean): Promise<GraphResult>;
}

// Diff types
export type DiffChangeType = 'added' | 'removed' | 'modified';

export interface DiffChange {
  path: string;
  type: DiffChangeType;
  breaking: boolean;
  breakingReason?: string;
  oldValue?: unknown;
  newValue?: unknown;
  jsonPathOld?: string;
  jsonPathNew?: string;
}

export interface DiffSummary {
  added: number;
  removed: number;
  modified: number;
  breaking: number;
  nonBreaking: number;
}

export interface DiffResult {
  changes: DiffChange[];
  summary: DiffSummary;
}

export interface DiffComputeResult {
  result: DiffResult;
  computeTimeMs: number;
}

export interface DiffWorkerApi {
  computeDiff(oldSpec: OpenAPIV3.Document, newSpec: OpenAPIV3.Document): Promise<DiffComputeResult>;
}
