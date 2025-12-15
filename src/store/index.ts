import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OpenAPIV3 } from 'openapi-types';
import type { EditorView } from '@codemirror/view';
import type { VersionSnapshot } from '../services/version-history-db';

export type { VersionSnapshot } from '../services/version-history-db';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration: number;
}

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
export type RightPanelView = 'preview' | 'graph' | 'diff' | 'tryit' | 'history';
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

  // Version History state
  versionHistory: VersionSnapshot[];
  selectedSnapshotId: string | null;
  isHistoryLoading: boolean;

  // Toast state
  toasts: Toast[];

  // Editor reference (not persisted)
  editorView: EditorView | null;
}

interface EditorActions {
  // File actions
  setFile: (file: EditorFile | null) => void;
  updateContent: (content: string) => void;
  markClean: () => void;
  updateFileIdentity: (file: EditorFile) => void;

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

  // Version History actions
  setVersionHistory: (history: VersionSnapshot[]) => void;
  addSnapshot: (snapshot: VersionSnapshot) => void;
  removeSnapshot: (id: string) => void;
  setSelectedSnapshot: (id: string | null) => void;
  setHistoryLoading: (loading: boolean) => void;

  // Toast actions
  showToast: (type: Toast['type'], message: string, duration?: number) => void;
  dismissToast: (id: string) => void;

  // Editor actions
  setEditorView: (view: EditorView | null) => void;
  goToLine: (line: number, column?: number) => void;
  goToPosition: (pos: number) => void;
}

type EditorStore = EditorState & EditorActions;

const DEFAULT_SPEC = `openapi: 3.0.3
info:
  title: Bookstore API
  description: |
    A sample API for managing a bookstore inventory.

    ## Features demonstrated
    - Multiple servers for different environments
    - Authentication (Bearer token, API key)
    - CRUD operations with various HTTP methods
    - Schema relationships (\`$ref\`, \`allOf\`, \`oneOf\`)
    - Path, query, and header parameters
    - Request/response validation
  version: 1.0.0
  contact:
    name: API Support
    email: support@example.com

servers:
  - url: https://api.bookstore.example.com/v1
    description: Production
  - url: https://staging-api.bookstore.example.com/v1
    description: Staging
  - url: http://localhost:3000/v1
    description: Local development

tags:
  - name: Books
    description: Book inventory management
  - name: Authors
    description: Author information
  - name: Orders
    description: Customer orders

security:
  - bearerAuth: []
  - apiKey: []

paths:
  /books:
    get:
      tags: [Books]
      summary: List books
      description: Retrieve a paginated list of books with optional filtering.
      operationId: listBooks
      parameters:
        - name: limit
          in: query
          description: Maximum number of books to return
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: offset
          in: query
          description: Number of books to skip
          schema:
            type: integer
            minimum: 0
            default: 0
        - name: genre
          in: query
          description: Filter by genre
          schema:
            $ref: '#/components/schemas/Genre'
        - name: X-Request-ID
          in: header
          description: Optional request tracking ID
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: List of books
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Book'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
        '401':
          $ref: '#/components/responses/Unauthorized'

    post:
      tags: [Books]
      summary: Create a book
      description: Add a new book to the inventory.
      operationId: createBook
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BookInput'
      responses:
        '201':
          description: Book created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Book'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /books/{bookId}:
    parameters:
      - $ref: '#/components/parameters/BookId'

    get:
      tags: [Books]
      summary: Get a book
      description: Retrieve details of a specific book.
      operationId: getBook
      responses:
        '200':
          description: Book details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Book'
        '404':
          $ref: '#/components/responses/NotFound'

    put:
      tags: [Books]
      summary: Update a book
      operationId: updateBook
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BookInput'
      responses:
        '200':
          description: Book updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Book'
        '404':
          $ref: '#/components/responses/NotFound'

    delete:
      tags: [Books]
      summary: Delete a book
      operationId: deleteBook
      responses:
        '204':
          description: Book deleted
        '404':
          $ref: '#/components/responses/NotFound'

  /authors:
    get:
      tags: [Authors]
      summary: List authors
      operationId: listAuthors
      responses:
        '200':
          description: List of authors
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Author'

  /authors/{authorId}:
    get:
      tags: [Authors]
      summary: Get an author
      operationId: getAuthor
      parameters:
        - name: authorId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Author details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Author'

  /orders:
    post:
      tags: [Orders]
      summary: Place an order
      operationId: createOrder
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/OrderInput'
      responses:
        '201':
          description: Order placed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key

  parameters:
    BookId:
      name: bookId
      in: path
      required: true
      description: Unique book identifier
      schema:
        type: string
        format: uuid

  responses:
    BadRequest:
      description: Invalid request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

  schemas:
    Book:
      allOf:
        - $ref: '#/components/schemas/BookInput'
        - type: object
          required: [id, createdAt]
          properties:
            id:
              type: string
              format: uuid
            createdAt:
              type: string
              format: date-time
            updatedAt:
              type: string
              format: date-time

    BookInput:
      type: object
      required: [title, authorId, genre, price]
      properties:
        title:
          type: string
          minLength: 1
          maxLength: 200
          example: The Great Gatsby
        authorId:
          type: string
          format: uuid
        genre:
          $ref: '#/components/schemas/Genre'
        price:
          $ref: '#/components/schemas/Money'
        isbn:
          type: string
          pattern: ^\\d{13}$
        publishedDate:
          type: string
          format: date
        description:
          type: string

    Author:
      type: object
      required: [id, name]
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        biography:
          type: string
        books:
          type: array
          items:
            $ref: '#/components/schemas/Book'

    Genre:
      type: string
      enum: [fiction, non-fiction, mystery, sci-fi, fantasy, biography, history]

    Money:
      type: object
      required: [amount, currency]
      properties:
        amount:
          type: number
          minimum: 0
          example: 19.99
        currency:
          type: string
          enum: [USD, EUR, GBP]
          default: USD

    OrderInput:
      type: object
      required: [items]
      properties:
        items:
          type: array
          minItems: 1
          items:
            $ref: '#/components/schemas/OrderItem'
        shippingAddress:
          $ref: '#/components/schemas/Address'

    OrderItem:
      type: object
      required: [bookId, quantity]
      properties:
        bookId:
          type: string
          format: uuid
        quantity:
          type: integer
          minimum: 1

    Order:
      type: object
      required: [id, status, items, total]
      properties:
        id:
          type: string
          format: uuid
        status:
          type: string
          enum: [pending, confirmed, shipped, delivered, cancelled]
        items:
          type: array
          items:
            $ref: '#/components/schemas/OrderItem'
        total:
          $ref: '#/components/schemas/Money'
        shippingAddress:
          $ref: '#/components/schemas/Address'
        createdAt:
          type: string
          format: date-time

    Address:
      type: object
      required: [street, city, country]
      properties:
        street:
          type: string
        city:
          type: string
        postcode:
          type: string
        country:
          type: string

    Pagination:
      type: object
      properties:
        total:
          type: integer
        limit:
          type: integer
        offset:
          type: integer
        hasMore:
          type: boolean

    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              reason:
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
      versionHistory: [],
      selectedSnapshotId: null,
      isHistoryLoading: false,
      toasts: [],
      editorView: null,

      // File actions
      setFile: (file) => set({
        file,
        parsedSpec: null,
        sourceMap: {},
        errors: [],
        warnings: [],
        versionHistory: [],
        selectedSnapshotId: null,
      }),

      updateContent: (content) => set((state) => ({
        file: state.file ? { ...state.file, content, isDirty: true } : null,
      })),

      markClean: () => set((state) => ({
        file: state.file ? { ...state.file, isDirty: false } : null,
      })),

      updateFileIdentity: (file) => set({ file }),

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

      // Version History actions
      setVersionHistory: (history) => set({ versionHistory: history }),
      addSnapshot: (snapshot) => set((state) => ({
        versionHistory: [snapshot, ...state.versionHistory],
      })),
      removeSnapshot: (id) => set((state) => ({
        versionHistory: state.versionHistory.filter((s) => s.id !== id),
        selectedSnapshotId: state.selectedSnapshotId === id ? null : state.selectedSnapshotId,
      })),
      setSelectedSnapshot: (id) => set({ selectedSnapshotId: id }),
      setHistoryLoading: (loading) => set({ isHistoryLoading: loading }),

      // Toast actions
      showToast: (type, message, duration = 4000) => set((state) => ({
        toasts: [
          ...state.toasts,
          { id: crypto.randomUUID(), type, message, duration },
        ],
      })),
      dismissToast: (id) => set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
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
