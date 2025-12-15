import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OpenAPIV3 } from 'openapi-types';
import type { EditorView } from '@codemirror/view';

export interface EditorFile {
  id: string;
  name: string;
  content: string;
  path?: string;
  isDirty: boolean;
  language: 'yaml' | 'json';
}

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

// Graph types
export type RightPanelView = 'preview' | 'graph' | 'diff' | 'tryit';
export type GraphFilter = 'all' | 'referenced' | 'orphaned';
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

// Diff types
export type DiffFilter = 'all' | 'breaking' | 'non-breaking';
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

export interface ComparisonSpec {
  content: string;
  parsed: OpenAPIV3.Document;
  sourceMap: SourceMap;
  name: string;
}

// Try It Out types
export type AuthType = 'none' | 'bearer' | 'apiKey' | 'basic';

export interface AuthConfig {
  type: AuthType;
  bearerToken: string;
  apiKeyName: string;
  apiKeyValue: string;
  apiKeyLocation: 'header' | 'query';
  username: string;
  password: string;
}

export interface TryItResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  responseTimeMs: number;
  error?: string;
  isCorsError?: boolean;
}

export interface TryItState {
  selectedOperationId: string | null;
  selectedServer: string | null;
  customServerUrl: string;
  authConfig: AuthConfig;
  parameterValues: Record<string, string>;
  requestBody: string;
  requestContentType: string;
  isExecuting: boolean;
  lastResponse: TryItResponse | null;
}

interface EditorState {
  // File state
  file: EditorFile | null;

  // Parsed state
  parsedSpec: OpenAPIV3.Document | null;
  sourceMap: SourceMap;

  // Validation state
  isValidating: boolean;
  syntaxValid: boolean;
  schemaValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];

  // UI state
  showPreview: boolean;
  showOutline: boolean;
  rightPanelView: RightPanelView;

  // Graph state
  graphData: GraphData | null;
  graphFilter: GraphFilter;
  isGraphLoading: boolean;

  // Diff state
  comparisonSpec: ComparisonSpec | null;
  diffResult: DiffResult | null;
  diffFilter: DiffFilter;
  isDiffLoading: boolean;

  // Try It Out state
  tryIt: TryItState;

  // Editor reference (not persisted)
  editorView: EditorView | null;
}

interface EditorActions {
  // File actions
  setFile: (file: EditorFile | null) => void;
  updateContent: (content: string) => void;
  markClean: () => void;

  // Parsed state actions
  setParsedSpec: (spec: OpenAPIV3.Document | null, sourceMap: SourceMap) => void;

  // Validation actions
  setValidating: (isValidating: boolean) => void;
  setValidationResult: (result: {
    syntaxValid: boolean;
    schemaValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
  }) => void;
  clearValidation: () => void;

  // UI actions
  togglePreview: () => void;
  toggleOutline: () => void;
  setRightPanelView: (view: RightPanelView) => void;

  // Graph actions
  setGraphData: (data: GraphData | null) => void;
  setGraphFilter: (filter: GraphFilter) => void;
  setGraphLoading: (loading: boolean) => void;

  // Diff actions
  setComparisonSpec: (spec: ComparisonSpec | null) => void;
  setDiffResult: (result: DiffResult | null) => void;
  setDiffFilter: (filter: DiffFilter) => void;
  setDiffLoading: (loading: boolean) => void;
  clearComparison: () => void;

  // Try It Out actions
  setTryItOperation: (operationId: string | null) => void;
  setTryItServer: (server: string | null) => void;
  setTryItCustomServer: (url: string) => void;
  setTryItAuth: (config: Partial<AuthConfig>) => void;
  setTryItParameter: (key: string, value: string) => void;
  setTryItRequestBody: (body: string) => void;
  setTryItContentType: (contentType: string) => void;
  setTryItExecuting: (executing: boolean) => void;
  setTryItResponse: (response: TryItResponse | null) => void;
  resetTryItParameters: () => void;

  // Editor actions
  setEditorView: (view: EditorView | null) => void;
  goToLine: (line: number, column?: number) => void;
  goToPosition: (pos: number) => void;
}

type EditorStore = EditorState & EditorActions;

const DEFAULT_SPEC = `openapi: 3.0.3
info:
  title: Sample API
  description: A sample OpenAPI specification
  version: 1.0.0
servers:
  - url: https://api.example.com/v1
paths:
  /users:
    get:
      summary: List users
      operationId: listUsers
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
components:
  schemas:
    User:
      type: object
      required:
        - id
        - email
      properties:
        id:
          type: integer
          format: int64
        email:
          type: string
          format: email
        name:
          type: string
`;

export const useEditorStore = create<EditorStore>()(
  persist(
    (set, get) => ({
      // Initial state
      file: {
        id: 'default',
        name: 'openapi.yaml',
        content: DEFAULT_SPEC,
        isDirty: false,
        language: 'yaml',
      },
      parsedSpec: null,
      sourceMap: {},
      isValidating: false,
      syntaxValid: true,
      schemaValid: true,
      errors: [],
      warnings: [],
      showPreview: true,
      showOutline: true,
      rightPanelView: 'preview',
      graphData: null,
      graphFilter: 'all',
      isGraphLoading: false,
      comparisonSpec: null,
      diffResult: null,
      diffFilter: 'all',
      isDiffLoading: false,
      tryIt: {
        selectedOperationId: null,
        selectedServer: null,
        customServerUrl: '',
        authConfig: {
          type: 'none',
          bearerToken: '',
          apiKeyName: '',
          apiKeyValue: '',
          apiKeyLocation: 'header',
          username: '',
          password: '',
        },
        parameterValues: {},
        requestBody: '',
        requestContentType: 'application/json',
        isExecuting: false,
        lastResponse: null,
      },
      editorView: null,

      // File actions
      setFile: (file) => set({ file, parsedSpec: null, sourceMap: {}, errors: [], warnings: [] }),

      updateContent: (content) => set((state) => ({
        file: state.file ? { ...state.file, content, isDirty: true } : null,
      })),

      markClean: () => set((state) => ({
        file: state.file ? { ...state.file, isDirty: false } : null,
      })),

      // Parsed state actions
      setParsedSpec: (spec, sourceMap) => set({ parsedSpec: spec, sourceMap }),

      // Validation actions
      setValidating: (isValidating) => set({ isValidating }),

      setValidationResult: (result) => set({
        syntaxValid: result.syntaxValid,
        schemaValid: result.schemaValid,
        errors: result.errors,
        warnings: result.warnings,
        isValidating: false,
      }),

      clearValidation: () => set({
        errors: [],
        warnings: [],
        syntaxValid: true,
        schemaValid: true,
      }),

      // UI actions
      togglePreview: () => set((state) => ({ showPreview: !state.showPreview })),
      toggleOutline: () => set((state) => ({ showOutline: !state.showOutline })),
      setRightPanelView: (view) => set({ rightPanelView: view }),

      // Graph actions
      setGraphData: (data) => set({ graphData: data }),
      setGraphFilter: (filter) => set({ graphFilter: filter }),
      setGraphLoading: (loading) => set({ isGraphLoading: loading }),

      // Diff actions
      setComparisonSpec: (spec) => set({ comparisonSpec: spec }),
      setDiffResult: (result) => set({ diffResult: result }),
      setDiffFilter: (filter) => set({ diffFilter: filter }),
      setDiffLoading: (loading) => set({ isDiffLoading: loading }),
      clearComparison: () => set({ comparisonSpec: null, diffResult: null }),

      // Try It Out actions
      setTryItOperation: (operationId) => set((state) => ({
        tryIt: { ...state.tryIt, selectedOperationId: operationId, parameterValues: {}, requestBody: '', lastResponse: null },
      })),
      setTryItServer: (server) => set((state) => ({
        tryIt: { ...state.tryIt, selectedServer: server },
      })),
      setTryItCustomServer: (url) => set((state) => ({
        tryIt: { ...state.tryIt, customServerUrl: url },
      })),
      setTryItAuth: (config) => set((state) => ({
        tryIt: { ...state.tryIt, authConfig: { ...state.tryIt.authConfig, ...config } },
      })),
      setTryItParameter: (key, value) => set((state) => ({
        tryIt: { ...state.tryIt, parameterValues: { ...state.tryIt.parameterValues, [key]: value } },
      })),
      setTryItRequestBody: (body) => set((state) => ({
        tryIt: { ...state.tryIt, requestBody: body },
      })),
      setTryItContentType: (contentType) => set((state) => ({
        tryIt: { ...state.tryIt, requestContentType: contentType },
      })),
      setTryItExecuting: (executing) => set((state) => ({
        tryIt: { ...state.tryIt, isExecuting: executing },
      })),
      setTryItResponse: (response) => set((state) => ({
        tryIt: { ...state.tryIt, lastResponse: response, isExecuting: false },
      })),
      resetTryItParameters: () => set((state) => ({
        tryIt: { ...state.tryIt, parameterValues: {}, requestBody: '' },
      })),

      // Editor actions
      setEditorView: (view) => set({ editorView: view }),

      goToLine: (line, column = 1) => {
        const { editorView } = get();
        if (!editorView) return;

        try {
          const lineInfo = editorView.state.doc.line(line);
          const pos = lineInfo.from + Math.max(0, column - 1);

          editorView.dispatch({
            selection: { anchor: pos },
            scrollIntoView: true,
          });
          editorView.focus();
        } catch {
          // Line out of range
        }
      },

      goToPosition: (pos) => {
        const { editorView } = get();
        if (!editorView) return;

        editorView.dispatch({
          selection: { anchor: pos },
          scrollIntoView: true,
        });
        editorView.focus();
      },
    }),
    {
      name: 'specable-editor',
      partialize: (state) => ({
        showPreview: state.showPreview,
        showOutline: state.showOutline,
        rightPanelView: state.rightPanelView,
        graphFilter: state.graphFilter,
        diffFilter: state.diffFilter,
        file: state.file,
        // Persist TryIt preferences but NOT sensitive credentials
        tryIt: {
          selectedServer: state.tryIt.selectedServer,
          customServerUrl: state.tryIt.customServerUrl,
          authConfig: {
            type: state.tryIt.authConfig.type,
            apiKeyLocation: state.tryIt.authConfig.apiKeyLocation,
          },
          requestContentType: state.tryIt.requestContentType,
        },
      }),
    }
  )
);
