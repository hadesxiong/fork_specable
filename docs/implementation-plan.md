# OpenAPI Editor: Technical Implementation Plan

> **Note**: This is a historical planning document from the initial design phase. For the current implementation state, see [mvp.md](./mvp.md). Some architectural decisions described here were modified during implementation—notably, the store uses a single file rather than slices, and worker pool complexity was deferred in favour of single workers.

## Executive Summary

This document outlines the technical architecture and implementation roadmap for a high-performance, web-based OpenAPI specification editor targeting individual developers. The editor prioritizes sub-100ms validation feedback, keyboard-first workflows, and intelligent navigation for complex specifications—addressing the critical failures of existing tools like Swagger Editor, Stoplight, and Redocly.

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser Main Thread                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   UI Layer   │  │ State Store  │  │    Command System        │  │
│  │   (React)    │  │   (Zustand)  │  │  (Command Palette)       │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                       │                 │
│  ┌──────┴─────────────────┴───────────────────────┴──────────────┐  │
│  │                    CodeMirror 6 Editor                        │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐  │  │
│  │  │ YAML/JSON   │ │ Extensions  │ │ View (Viewport-only     │  │  │
│  │  │ Language    │ │ (Shortcuts, │ │      rendering)         │  │  │
│  │  │ Support     │ │  Folding)   │ │                         │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    Comlink (RPC Bridge)
                              │
┌─────────────────────────────┴───────────────────────────────────────┐
│                         Web Workers                                  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  Parser Worker   │  │ Validator Worker │  │  Linter Worker   │   │
│  │                  │  │                  │  │                  │   │
│  │ • Lezer YAML     │  │ • JSON Schema    │  │ • Spectral       │   │
│  │ • Incremental    │  │ • $ref resolver  │  │ • Custom rules   │   │
│  │ • AST cache      │  │ • Type checking  │  │ • Breaking chgs  │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐                         │
│  │  Search Worker   │  │    AI Worker     │                         │
│  │                  │  │                  │                         │
│  │ • Symbol index   │  │ • Schema gen     │                         │
│  │ • Fuzzy match    │  │ • Description    │                         │
│  │ • Ref graph      │  │ • Fix suggest    │                         │
│  └──────────────────┘  └──────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────────────┐
│                      Storage Layer                                   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   IndexedDB      │  │  File System     │  │  Optional Cloud  │   │
│  │                  │  │  Access API      │  │  Sync            │   │
│  │ • Documents      │  │                  │  │                  │   │
│  │ • Settings       │  │ • Direct file    │  │ • GitHub         │   │
│  │ • History        │  │ • Watch changes  │  │ • GitLab         │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Editor Core | CodeMirror 6 | Superior large-file handling, smaller bundle (~150KB vs Monaco ~2MB), better extensibility |
| UI Framework | React 19 | Concurrent rendering, Suspense for code splitting, mature ecosystem |
| State Management | Zustand | Minimal boilerplate, excellent performance, built-in persistence |
| Worker Communication | Comlink | Type-safe RPC, transparent async, minimal overhead |
| Parsing | Lezer (YAML grammar) | Incremental parsing, error recovery, ~64 bits/node memory |
| Validation | Ajv + @apidevtools/swagger-parser | Fast JSON Schema, comprehensive OpenAPI validation |
| Linting | Spectral | Industry standard, extensible rulesets |
| Styling | Tailwind CSS | Utility-first, tree-shakeable, consistent design system |
| Build | Vite | Fast HMR, optimized chunking, native ES modules |
| Testing | Vitest + Playwright | Unit/integration with same config, E2E for critical paths |

---

## 2. Core Components

### 2.1 Editor Engine

#### 2.1.1 CodeMirror 6 Configuration

```typescript
// src/editor/setup.ts
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { yaml } from '@codemirror/lang-yaml';
import { json } from '@codemirror/lang-json';
import { foldGutter, foldKeymap } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { lintGutter } from '@codemirror/lint';

export function createEditorState(doc: string, extensions: Extension[] = []): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      // Core editing
      history(),
      
      // Syntax highlighting (auto-detect YAML/JSON)
      yaml(),
      json(),
      
      // UI enhancements
      lineNumbers(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      foldGutter(),
      lintGutter(),
      
      // Keymaps (order matters - later takes precedence)
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...searchKeymap,
        ...openApiKeymap, // Custom OpenAPI shortcuts
      ]),
      
      // Custom extensions
      openapiLinter(),
      refHighlighter(),
      breadcrumbTracker(),
      
      // User extensions
      ...extensions,
    ],
  });
}
```

#### 2.1.2 Custom OpenAPI Keybindings

```typescript
// src/editor/keymaps.ts
import { KeyBinding } from '@codemirror/view';
import { Command } from '@codemirror/state';

export const openApiKeymap: KeyBinding[] = [
  // Navigation
  { key: 'F12', run: goToDefinition },
  { key: 'Alt-F12', run: peekDefinition },
  { key: 'Ctrl-Shift-o', run: goToSymbol },
  { key: 'Ctrl-g', run: goToLine },
  
  // Multi-cursor
  { key: 'Ctrl-d', run: selectNextOccurrence },
  { key: 'Ctrl-Shift-l', run: selectAllOccurrences },
  
  // Folding (semantic)
  { key: 'Ctrl-Shift-[', run: foldRegion },
  { key: 'Ctrl-Shift-]', run: unfoldRegion },
  { key: 'Ctrl-k Ctrl-0', run: foldAllPaths },
  { key: 'Ctrl-k Ctrl-1', run: foldAllSchemas },
  { key: 'Ctrl-k Ctrl-j', run: unfoldAll },
  
  // OpenAPI specific
  { key: 'Ctrl-Shift-n', run: newEndpoint },
  { key: 'Ctrl-Shift-s', run: newSchema },
  { key: 'Ctrl-.', run: quickFix },
  { key: 'Ctrl-Space', run: triggerCompletion },
  
  // Command palette
  { key: 'Ctrl-Shift-p', run: openCommandPalette },
  { key: 'Ctrl-p', run: quickOpen },
];
```

### 2.2 Web Worker Architecture

#### 2.2.1 Worker Pool Manager

```typescript
// src/workers/pool.ts
import { wrap, Remote, transfer } from 'comlink';

interface WorkerInstance<T> {
  worker: Worker;
  api: Remote<T>;
  busy: boolean;
}

export class WorkerPool<T> {
  private workers: WorkerInstance<T>[] = [];
  private queue: Array<{ task: (api: Remote<T>) => Promise<any>; resolve: Function; reject: Function }> = [];

  constructor(
    private createWorker: () => Worker,
    private poolSize: number = navigator.hardwareConcurrency || 4
  ) {
    this.initialize();
  }

  private initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = this.createWorker();
      this.workers.push({
        worker,
        api: wrap<T>(worker),
        busy: false,
      });
    }
  }

  async execute<R>(task: (api: Remote<T>) => Promise<R>): Promise<R> {
    const available = this.workers.find(w => !w.busy);
    
    if (available) {
      available.busy = true;
      try {
        return await task(available.api);
      } finally {
        available.busy = false;
        this.processQueue();
      }
    }

    // Queue if all workers busy
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
    });
  }

  private processQueue() {
    if (this.queue.length === 0) return;
    const available = this.workers.find(w => !w.busy);
    if (!available) return;

    const { task, resolve, reject } = this.queue.shift()!;
    this.execute(task).then(resolve).catch(reject);
  }

  terminate() {
    this.workers.forEach(w => w.worker.terminate());
  }
}
```

#### 2.2.2 Validation Worker

```typescript
// src/workers/validator.worker.ts
import { expose } from 'comlink';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  parsedSpec?: OpenAPIV3.Document | OpenAPIV3_1.Document;
  parseTimeMs: number;
  validateTimeMs: number;
}

interface ValidationError {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  path: string;
  severity: 'error';
  rule?: string;
}

interface ValidationWarning extends Omit<ValidationError, 'severity'> {
  severity: 'warning';
}

class ValidatorWorker {
  private ajv: Ajv;
  private specCache: Map<string, { hash: string; result: ValidationResult }> = new Map();

  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true, 
      strict: false,
      validateFormats: true,
    });
    addFormats(this.ajv);
  }

  async validate(content: string, fileId: string): Promise<ValidationResult> {
    const hash = await this.hashContent(content);
    const cached = this.specCache.get(fileId);
    
    if (cached && cached.hash === hash) {
      return cached.result;
    }

    const parseStart = performance.now();
    let parsedSpec: OpenAPIV3.Document | OpenAPIV3_1.Document;
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Parse and dereference
      parsedSpec = await SwaggerParser.validate(content, {
        parse: { yaml: { allowEmpty: false } },
        resolve: { external: false }, // Handle external refs separately
        dereference: { circular: 'ignore' },
      }) as OpenAPIV3.Document | OpenAPIV3_1.Document;
    } catch (e: any) {
      const parseTimeMs = performance.now() - parseStart;
      const error = this.parseSwaggerError(e, content);
      return {
        valid: false,
        errors: [error],
        warnings: [],
        parseTimeMs,
        validateTimeMs: 0,
      };
    }

    const parseTimeMs = performance.now() - parseStart;
    const validateStart = performance.now();

    // Additional semantic validation
    this.validateSemantics(parsedSpec, errors, warnings);

    const validateTimeMs = performance.now() - validateStart;

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      parsedSpec,
      parseTimeMs,
      validateTimeMs,
    };

    this.specCache.set(fileId, { hash, result });
    return result;
  }

  private validateSemantics(
    spec: OpenAPIV3.Document | OpenAPIV3_1.Document,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ) {
    // Check for orphaned schemas
    const usedSchemas = new Set<string>();
    this.findUsedSchemas(spec, usedSchemas);
    
    const definedSchemas = Object.keys(spec.components?.schemas || {});
    for (const schema of definedSchemas) {
      if (!usedSchemas.has(schema)) {
        warnings.push({
          line: 0, // Would need source map for accurate line
          column: 0,
          message: `Schema "${schema}" is defined but never referenced`,
          path: `#/components/schemas/${schema}`,
          severity: 'warning',
          rule: 'unused-schema',
        });
      }
    }

    // Validate security scheme references
    // Validate response codes
    // Check for missing descriptions
    // etc.
  }

  private findUsedSchemas(obj: any, used: Set<string>, visited = new Set<any>()) {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
    visited.add(obj);

    if (obj.$ref && typeof obj.$ref === 'string') {
      const match = obj.$ref.match(/#\/components\/schemas\/(\w+)/);
      if (match) used.add(match[1]);
    }

    for (const value of Object.values(obj)) {
      this.findUsedSchemas(value, used, visited);
    }
  }

  private parseSwaggerError(e: any, content: string): ValidationError {
    // Parse error message to extract line/column
    // swagger-parser errors include path info
    return {
      line: e.line || 1,
      column: e.column || 1,
      message: e.message,
      path: e.path || '',
      severity: 'error',
    };
  }

  private async hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Incremental validation for real-time feedback
  async validateIncremental(
    content: string,
    changedRange: { from: number; to: number },
    fileId: string
  ): Promise<ValidationResult> {
    // For small changes, try to validate only affected paths
    // Fall back to full validation for structural changes
    return this.validate(content, fileId);
  }
}

expose(new ValidatorWorker());
```

#### 2.2.3 Linter Worker (Spectral Integration)

```typescript
// src/workers/linter.worker.ts
import { expose } from 'comlink';
import { Spectral, Document, Ruleset } from '@stoplight/spectral-core';
import { oas } from '@stoplight/spectral-rulesets';
import { Yaml } from '@stoplight/spectral-parsers';

interface LintResult {
  diagnostics: LintDiagnostic[];
  lintTimeMs: number;
}

interface LintDiagnostic {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  code: string;
  path: string[];
}

class LinterWorker {
  private spectral: Spectral;
  private customRules: Ruleset | null = null;

  constructor() {
    this.spectral = new Spectral();
    this.spectral.setRuleset(oas);
  }

  async lint(content: string): Promise<LintResult> {
    const start = performance.now();
    
    const doc = new Document(content, Yaml, 'openapi.yaml');
    const results = await this.spectral.run(doc);

    const diagnostics: LintDiagnostic[] = results.map(r => ({
      line: r.range.start.line + 1,
      column: r.range.start.character + 1,
      endLine: r.range.end.line + 1,
      endColumn: r.range.end.character + 1,
      message: r.message,
      severity: this.mapSeverity(r.severity),
      code: String(r.code),
      path: r.path.map(String),
    }));

    return {
      diagnostics,
      lintTimeMs: performance.now() - start,
    };
  }

  async setCustomRuleset(ruleset: object) {
    this.customRules = ruleset as Ruleset;
    this.spectral.setRuleset({
      ...oas,
      ...this.customRules,
    });
  }

  private mapSeverity(severity: number): LintDiagnostic['severity'] {
    switch (severity) {
      case 0: return 'error';
      case 1: return 'warning';
      case 2: return 'info';
      default: return 'hint';
    }
  }
}

expose(new LinterWorker());
```

### 2.3 Validation Pipeline

```typescript
// src/services/validation-pipeline.ts
import { debounce } from 'lodash-es';
import type { ValidationResult } from '../workers/validator.worker';
import type { LintResult } from '../workers/linter.worker';

interface PipelineResult {
  syntax: { valid: boolean; errors: any[] };
  schema: ValidationResult | null;
  lint: LintResult | null;
  totalTimeMs: number;
}

export class ValidationPipeline {
  private validatorPool: WorkerPool<ValidatorWorker>;
  private linterPool: WorkerPool<LinterWorker>;
  
  private pendingValidation: AbortController | null = null;
  
  constructor() {
    this.validatorPool = new WorkerPool(
      () => new Worker(new URL('../workers/validator.worker.ts', import.meta.url), { type: 'module' })
    );
    this.linterPool = new WorkerPool(
      () => new Worker(new URL('../workers/linter.worker.ts', import.meta.url), { type: 'module' })
    );
  }

  // Tiered validation with increasing depth
  async validate(
    content: string,
    fileId: string,
    onProgress: (stage: string, result: Partial<PipelineResult>) => void
  ): Promise<PipelineResult> {
    // Cancel any pending validation
    this.pendingValidation?.abort();
    this.pendingValidation = new AbortController();
    const signal = this.pendingValidation.signal;

    const startTime = performance.now();
    const result: PipelineResult = {
      syntax: { valid: true, errors: [] },
      schema: null,
      lint: null,
      totalTimeMs: 0,
    };

    // Stage 1: Syntax check (immediate, <50ms)
    try {
      const syntaxResult = await this.quickSyntaxCheck(content);
      result.syntax = syntaxResult;
      onProgress('syntax', { syntax: syntaxResult });
      
      if (!syntaxResult.valid) {
        result.totalTimeMs = performance.now() - startTime;
        return result;
      }
    } catch (e) {
      if (signal.aborted) throw new Error('Validation cancelled');
      throw e;
    }

    // Stage 2: Schema validation (debounced, <200ms)
    if (!signal.aborted) {
      try {
        const schemaResult = await this.validatorPool.execute(
          api => api.validate(content, fileId)
        );
        result.schema = schemaResult;
        onProgress('schema', { schema: schemaResult });
      } catch (e) {
        if (signal.aborted) throw new Error('Validation cancelled');
        throw e;
      }
    }

    // Stage 3: Linting (background, <500ms typically)
    if (!signal.aborted) {
      try {
        const lintResult = await this.linterPool.execute(
          api => api.lint(content)
        );
        result.lint = lintResult;
        onProgress('lint', { lint: lintResult });
      } catch (e) {
        if (signal.aborted) throw new Error('Validation cancelled');
        throw e;
      }
    }

    result.totalTimeMs = performance.now() - startTime;
    return result;
  }

  private async quickSyntaxCheck(content: string): Promise<{ valid: boolean; errors: any[] }> {
    // Fast YAML/JSON syntax check without full parsing
    try {
      // Use native JSON.parse for JSON
      if (content.trim().startsWith('{')) {
        JSON.parse(content);
      } else {
        // For YAML, use a lightweight parser
        const yaml = await import('yaml');
        yaml.parse(content);
      }
      return { valid: true, errors: [] };
    } catch (e: any) {
      return {
        valid: false,
        errors: [{
          message: e.message,
          line: e.linePos?.[0]?.line || 1,
          column: e.linePos?.[0]?.col || 1,
        }],
      };
    }
  }

  // Debounced validation trigger
  readonly debouncedValidate = debounce(
    (content: string, fileId: string, onProgress: (stage: string, result: Partial<PipelineResult>) => void) => {
      return this.validate(content, fileId, onProgress);
    },
    300,
    { leading: false, trailing: true }
  );
}
```

### 2.4 Command Palette System

```typescript
// src/components/CommandPalette/CommandPalette.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Fuse from 'fuse.js';
import { useEditorStore } from '../../store/editor';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category: 'navigation' | 'edit' | 'view' | 'file' | 'openapi';
  action: () => void | Promise<void>;
  when?: () => boolean; // Conditional availability
}

const COMMANDS: Command[] = [
  // Navigation
  { id: 'goto.line', label: 'Go to Line...', shortcut: 'Ctrl+G', category: 'navigation', action: () => {} },
  { id: 'goto.symbol', label: 'Go to Symbol...', shortcut: 'Ctrl+Shift+O', category: 'navigation', action: () => {} },
  { id: 'goto.definition', label: 'Go to Definition', shortcut: 'F12', category: 'navigation', action: () => {} },
  
  // Edit
  { id: 'edit.undo', label: 'Undo', shortcut: 'Ctrl+Z', category: 'edit', action: () => {} },
  { id: 'edit.redo', label: 'Redo', shortcut: 'Ctrl+Y', category: 'edit', action: () => {} },
  { id: 'edit.selectAll', label: 'Select All Occurrences', shortcut: 'Ctrl+Shift+L', category: 'edit', action: () => {} },
  
  // View
  { id: 'view.togglePreview', label: 'Toggle Preview Panel', shortcut: 'Ctrl+\\', category: 'view', action: () => {} },
  { id: 'view.toggleOutline', label: 'Toggle Outline', shortcut: 'Ctrl+Shift+E', category: 'view', action: () => {} },
  { id: 'view.zenMode', label: 'Toggle Zen Mode', shortcut: 'Ctrl+K Z', category: 'view', action: () => {} },
  
  // OpenAPI specific
  { id: 'openapi.newEndpoint', label: 'New Endpoint...', shortcut: 'Ctrl+Shift+N', category: 'openapi', action: () => {} },
  { id: 'openapi.newSchema', label: 'New Schema...', shortcut: 'Ctrl+Shift+S', category: 'openapi', action: () => {} },
  { id: 'openapi.generateFromJson', label: 'Generate Schema from JSON...', category: 'openapi', action: () => {} },
  { id: 'openapi.validateSpec', label: 'Validate Specification', shortcut: 'Ctrl+Shift+V', category: 'openapi', action: () => {} },
  { id: 'openapi.previewDocs', label: 'Preview Documentation', category: 'openapi', action: () => {} },
];

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fuzzy search setup
  const fuse = useMemo(() => new Fuse(COMMANDS, {
    keys: ['label', 'category'],
    threshold: 0.4,
    includeScore: true,
  }), []);

  const filteredCommands = useMemo(() => {
    if (!query) return COMMANDS;
    return fuse.search(query).map(result => result.item);
  }, [query, fuse]);

  // Keyboard navigation
  useHotkeys('ctrl+shift+p, cmd+shift+p', (e) => {
    e.preventDefault();
    setIsOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, { enableOnFormTags: true });

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }, [filteredCommands, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
      <div className="relative w-[600px] bg-gray-900 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Type a command or search..."
          className="w-full px-4 py-3 bg-transparent text-white text-lg outline-none border-b border-gray-700"
          autoFocus
        />
        <div className="max-h-[400px] overflow-y-auto">
          {filteredCommands.map((cmd, index) => (
            <div
              key={cmd.id}
              className={`px-4 py-2 flex items-center justify-between cursor-pointer ${
                index === selectedIndex ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
              onClick={() => { cmd.action(); setIsOpen(false); }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 uppercase w-20">{cmd.category}</span>
                <span className="text-white">{cmd.label}</span>
              </div>
              {cmd.shortcut && (
                <kbd className="px-2 py-1 text-xs bg-gray-700 rounded">{cmd.shortcut}</kbd>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

### 2.5 $ref Navigation System

```typescript
// src/services/ref-resolver.ts
import { OpenAPIV3 } from 'openapi-types';

interface RefLocation {
  path: string;      // JSON pointer path
  line: number;      // 1-indexed line number
  column: number;    // 1-indexed column number
  targetPath: string; // Resolved target path
  targetLine: number;
  targetColumn: number;
}

interface SymbolInfo {
  name: string;
  kind: 'path' | 'operation' | 'schema' | 'parameter' | 'response' | 'security';
  path: string;
  line: number;
  column: number;
  detail?: string;
}

export class RefResolver {
  private sourceMap: Map<string, { line: number; column: number }> = new Map();
  private symbolIndex: SymbolInfo[] = [];
  private refGraph: Map<string, Set<string>> = new Map(); // What references what

  async buildIndex(content: string, parsedSpec: OpenAPIV3.Document): Promise<void> {
    this.sourceMap.clear();
    this.symbolIndex = [];
    this.refGraph.clear();

    // Build source map from YAML/JSON content
    await this.buildSourceMap(content);

    // Index all symbols
    this.indexSymbols(parsedSpec);

    // Build reference graph
    this.buildRefGraph(parsedSpec);
  }

  private async buildSourceMap(content: string): Promise<void> {
    const yaml = await import('yaml');
    const doc = yaml.parseDocument(content);
    
    const visit = (node: any, path: string[] = []) => {
      if (!node || typeof node !== 'object') return;
      
      if (node.range) {
        const [start] = node.range;
        const pos = this.offsetToPosition(content, start);
        this.sourceMap.set(path.join('/'), pos);
      }

      if (node.items) {
        node.items.forEach((item: any, index: number) => {
          if (item.key) {
            visit(item, [...path, String(item.key.value)]);
          } else {
            visit(item, [...path, String(index)]);
          }
        });
      }
      
      if (node.value) {
        visit(node.value, path);
      }
    };

    visit(doc.contents);
  }

  private offsetToPosition(content: string, offset: number): { line: number; column: number } {
    const lines = content.slice(0, offset).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }

  private indexSymbols(spec: OpenAPIV3.Document): void {
    // Index paths
    for (const [pathKey, pathItem] of Object.entries(spec.paths || {})) {
      const pathPath = `/paths/${this.escapeJsonPointer(pathKey)}`;
      const pos = this.sourceMap.get(pathPath) || { line: 0, column: 0 };
      
      this.symbolIndex.push({
        name: pathKey,
        kind: 'path',
        path: pathPath,
        line: pos.line,
        column: pos.column,
      });

      // Index operations
      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const) {
        const operation = (pathItem as any)?.[method];
        if (operation) {
          const opPath = `${pathPath}/${method}`;
          const opPos = this.sourceMap.get(opPath) || { line: 0, column: 0 };
          
          this.symbolIndex.push({
            name: `${method.toUpperCase()} ${pathKey}`,
            kind: 'operation',
            path: opPath,
            line: opPos.line,
            column: opPos.column,
            detail: operation.summary || operation.operationId,
          });
        }
      }
    }

    // Index schemas
    for (const [schemaName, schema] of Object.entries(spec.components?.schemas || {})) {
      const schemaPath = `/components/schemas/${schemaName}`;
      const pos = this.sourceMap.get(schemaPath) || { line: 0, column: 0 };
      
      this.symbolIndex.push({
        name: schemaName,
        kind: 'schema',
        path: schemaPath,
        line: pos.line,
        column: pos.column,
        detail: (schema as any).description?.slice(0, 50),
      });
    }

    // Index parameters, responses, security schemes similarly...
  }

  private buildRefGraph(obj: any, currentPath: string = '', visited = new Set<any>()): void {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
    visited.add(obj);

    if (obj.$ref && typeof obj.$ref === 'string') {
      const targetPath = obj.$ref.replace('#', '');
      
      if (!this.refGraph.has(currentPath)) {
        this.refGraph.set(currentPath, new Set());
      }
      this.refGraph.get(currentPath)!.add(targetPath);
    }

    for (const [key, value] of Object.entries(obj)) {
      this.buildRefGraph(value, `${currentPath}/${key}`, visited);
    }
  }

  // Go to definition
  resolveRef(ref: string): { line: number; column: number } | null {
    const targetPath = ref.replace('#', '').replace(/^\//, '');
    const pos = this.sourceMap.get(targetPath);
    return pos || null;
  }

  // Find all references to a path
  findReferences(targetPath: string): RefLocation[] {
    const references: RefLocation[] = [];
    
    for (const [sourcePath, targets] of this.refGraph.entries()) {
      if (targets.has(targetPath)) {
        const sourcePos = this.sourceMap.get(sourcePath);
        const targetPos = this.sourceMap.get(targetPath);
        
        if (sourcePos && targetPos) {
          references.push({
            path: sourcePath,
            line: sourcePos.line,
            column: sourcePos.column,
            targetPath,
            targetLine: targetPos.line,
            targetColumn: targetPos.column,
          });
        }
      }
    }
    
    return references;
  }

  // Symbol search with fuzzy matching
  searchSymbols(query: string): SymbolInfo[] {
    if (!query) return this.symbolIndex.slice(0, 50);
    
    const lowerQuery = query.toLowerCase();
    return this.symbolIndex
      .filter(s => s.name.toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        // Prioritize exact prefix matches
        const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
        const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 50);
  }

  private escapeJsonPointer(str: string): string {
    return str.replace(/~/g, '~0').replace(/\//g, '~1');
  }
}
```

---

## 3. UI Components

### 3.1 Component Hierarchy

```
App
├── Header
│   ├── FileMenu
│   ├── Breadcrumbs
│   └── ToolbarActions
├── MainContent
│   ├── Sidebar
│   │   ├── FileExplorer (for multi-file)
│   │   └── OutlineView
│   ├── EditorPane
│   │   ├── EditorTabs
│   │   ├── CodeMirrorEditor
│   │   ├── Minimap
│   │   └── StatusBar
│   └── PreviewPane
│       ├── PreviewTabBar
│       ├── DocumentationView      (Ctrl+Shift+1)
│       │   ├── ApiInfoHeader
│       │   ├── PathSection
│       │   ├── OperationCard
│       │   └── SchemasSection
│       ├── GraphView              (Ctrl+Shift+2)
│       │   ├── GraphToolbar (filter controls)
│       │   ├── D3ForceGraph
│       │   └── NodeTooltip
│       ├── TryItOut               (Ctrl+Shift+3)
│       │   ├── ServerSelector
│       │   ├── ParameterSection
│       │   ├── RequestBodyEditor
│       │   ├── SendButton
│       │   └── ResponseDisplay
│       ├── DiffView               (Ctrl+Shift+4)
│       │   ├── DiffSummary
│       │   ├── ChangeCard
│       │   └── ChangelogExport
│       ├── CodeSnippetsView       (Ctrl+Shift+5)
│       │   ├── LanguageSelector
│       │   ├── CodeDisplay
│       │   └── CopyButton
│       └── ValidationReportView   (Ctrl+Shift+6)
│           ├── ReportSummary
│           ├── IssueGroup
│           └── IssueCard
├── BottomPanel
│   ├── ProblemsTab
│   ├── OutputTab
│   └── TerminalTab (future)
├── CommandPalette
├── SymbolPicker (Go to Symbol)
├── QuickFix popup
└── Notifications
```

### 3.2 Outline View Component

```typescript
// src/components/Outline/OutlineView.tsx
import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Globe, Box, Shield, Key, FileCode } from 'lucide-react';
import { useEditorStore } from '../../store/editor';
import type { OpenAPIV3 } from 'openapi-types';

interface OutlineNode {
  id: string;
  label: string;
  kind: 'paths' | 'path' | 'operation' | 'schemas' | 'schema' | 'security' | 'parameters';
  children?: OutlineNode[];
  line?: number;
  method?: string;
  deprecated?: boolean;
}

const METHOD_COLORS: Record<string, string> = {
  get: 'text-green-400',
  post: 'text-blue-400',
  put: 'text-orange-400',
  patch: 'text-yellow-400',
  delete: 'text-red-400',
  options: 'text-gray-400',
  head: 'text-purple-400',
};

const KIND_ICONS: Record<string, React.ComponentType<any>> = {
  paths: Globe,
  schemas: Box,
  security: Shield,
  parameters: Key,
  default: FileCode,
};

export const OutlineView: React.FC = () => {
  const { parsedSpec, goToLine, sourceMap } = useEditorStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['paths', 'schemas']));
  const [filter, setFilter] = useState('');

  const outline = useMemo(() => {
    if (!parsedSpec) return [];
    return buildOutlineTree(parsedSpec, sourceMap);
  }, [parsedSpec, sourceMap]);

  const filteredOutline = useMemo(() => {
    if (!filter) return outline;
    return filterOutline(outline, filter.toLowerCase());
  }, [outline, filter]);

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (node: OutlineNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const Icon = KIND_ICONS[node.kind] || KIND_ICONS.default;

    return (
      <div key={node.id}>
        <div
          className={`
            flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-800 rounded
            ${node.deprecated ? 'line-through opacity-60' : ''}
          `}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (hasChildren) toggleExpanded(node.id);
            if (node.line) goToLine(node.line);
          }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <span className="w-4" />
          )}
          
          {node.method ? (
            <span className={`text-xs font-mono font-bold ${METHOD_COLORS[node.method]}`}>
              {node.method.toUpperCase().padEnd(6)}
            </span>
          ) : (
            <Icon className="w-4 h-4 text-gray-400" />
          )}
          
          <span className="text-sm text-gray-200 truncate">{node.label}</span>
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 border-r border-gray-700">
      <div className="p-2 border-b border-gray-700">
        <input
          type="text"
          placeholder="Filter outline..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {filteredOutline.map(node => renderNode(node))}
      </div>
    </div>
  );
};

function buildOutlineTree(spec: OpenAPIV3.Document, sourceMap: Map<string, any>): OutlineNode[] {
  const nodes: OutlineNode[] = [];

  // Paths section
  if (spec.paths && Object.keys(spec.paths).length > 0) {
    const pathNodes: OutlineNode[] = [];
    
    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      const operations: OutlineNode[] = [];
      
      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const) {
        const operation = (pathItem as any)?.[method] as OpenAPIV3.OperationObject | undefined;
        if (operation) {
          operations.push({
            id: `${pathKey}-${method}`,
            label: operation.summary || operation.operationId || pathKey,
            kind: 'operation',
            method,
            line: sourceMap.get(`paths.${pathKey}.${method}`)?.line,
            deprecated: operation.deprecated,
          });
        }
      }

      pathNodes.push({
        id: pathKey,
        label: pathKey,
        kind: 'path',
        children: operations,
        line: sourceMap.get(`paths.${pathKey}`)?.line,
      });
    }

    nodes.push({
      id: 'paths',
      label: `Paths (${pathNodes.length})`,
      kind: 'paths',
      children: pathNodes,
    });
  }

  // Schemas section
  if (spec.components?.schemas && Object.keys(spec.components.schemas).length > 0) {
    const schemaNodes: OutlineNode[] = Object.entries(spec.components.schemas).map(([name, schema]) => ({
      id: `schema-${name}`,
      label: name,
      kind: 'schema',
      line: sourceMap.get(`components.schemas.${name}`)?.line,
      deprecated: (schema as any).deprecated,
    }));

    nodes.push({
      id: 'schemas',
      label: `Schemas (${schemaNodes.length})`,
      kind: 'schemas',
      children: schemaNodes,
    });
  }

  // Security schemes
  if (spec.components?.securitySchemes) {
    const securityNodes: OutlineNode[] = Object.keys(spec.components.securitySchemes).map(name => ({
      id: `security-${name}`,
      label: name,
      kind: 'security',
      line: sourceMap.get(`components.securitySchemes.${name}`)?.line,
    }));

    nodes.push({
      id: 'security',
      label: `Security (${securityNodes.length})`,
      kind: 'security',
      children: securityNodes,
    });
  }

  return nodes;
}

function filterOutline(nodes: OutlineNode[], query: string): OutlineNode[] {
  return nodes
    .map(node => {
      if (node.children) {
        const filteredChildren = filterOutline(node.children, query);
        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
      }
      if (node.label.toLowerCase().includes(query)) {
        return node;
      }
      return null;
    })
    .filter((node): node is OutlineNode => node !== null);
}
```

### 3.3 Preview Pane System

The preview pane provides multiple visualization modes for understanding and interacting with the OpenAPI specification. Each mode serves a distinct purpose and can be switched via tabs or keyboard shortcuts.

#### 3.3.1 Preview Mode Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  [📄 Docs] [🔗 Graph] [▶ Try It] [⚖ Diff] [💻 Code] [📋 Report]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                     Active Preview Content                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

| Mode | Shortcut | Purpose |
|------|----------|---------|
| Documentation | `Ctrl+Shift+1` | Rendered API reference documentation |
| Graph | `Ctrl+Shift+2` | Visual schema relationship diagram |
| Try It | `Ctrl+Shift+3` | Interactive API request playground |
| Diff | `Ctrl+Shift+4` | Version comparison with breaking change detection |
| Code Snippets | `Ctrl+Shift+5` | Generated client code for current endpoint |
| Validation Report | `Ctrl+Shift+6` | Structured error/warning summary |

#### 3.3.2 Documentation View

The primary preview mode renders the specification as interactive API documentation.

```typescript
// src/components/Preview/DocumentationView.tsx
import React, { useMemo, useCallback } from 'react';
import { useEditorStore } from '../../store/editor';
import type { OpenAPIV3 } from 'openapi-types';

interface DocumentationViewProps {
  onNavigate: (path: string) => void;
}

export const DocumentationView: React.FC<DocumentationViewProps> = ({ onNavigate }) => {
  const { parsedSpec, activeEndpoint } = useEditorStore();

  if (!parsedSpec) {
    return <EmptyState message="No valid specification to preview" />;
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-900 text-gray-100">
      {/* API Info Header */}
      <header className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 z-10">
        <h1 className="text-2xl font-bold">{parsedSpec.info.title}</h1>
        <p className="text-gray-400 mt-1">{parsedSpec.info.description}</p>
        <div className="flex gap-4 mt-2 text-sm">
          <span className="text-blue-400">Version: {parsedSpec.info.version}</span>
          {parsedSpec.servers?.[0] && (
            <span className="text-green-400">Server: {parsedSpec.servers[0].url}</span>
          )}
        </div>
      </header>

      {/* Endpoints List */}
      <div className="p-4 space-y-6">
        {Object.entries(parsedSpec.paths || {}).map(([path, pathItem]) => (
          <PathSection
            key={path}
            path={path}
            pathItem={pathItem as OpenAPIV3.PathItemObject}
            isActive={activeEndpoint?.startsWith(path)}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* Schemas Section */}
      <SchemasSection schemas={parsedSpec.components?.schemas} onNavigate={onNavigate} />
    </div>
  );
};

const PathSection: React.FC<{
  path: string;
  pathItem: OpenAPIV3.PathItemObject;
  isActive: boolean;
  onNavigate: (path: string) => void;
}> = ({ path, pathItem, isActive, onNavigate }) => {
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

  return (
    <div className={`rounded-lg border ${isActive ? 'border-blue-500' : 'border-gray-700'}`}>
      {methods.map(method => {
        const operation = pathItem[method];
        if (!operation) return null;

        return (
          <OperationCard
            key={method}
            method={method}
            path={path}
            operation={operation as OpenAPIV3.OperationObject}
            onNavigate={onNavigate}
          />
        );
      })}
    </div>
  );
};

const METHOD_STYLES: Record<string, { bg: string; text: string }> = {
  get: { bg: 'bg-green-900/50', text: 'text-green-400' },
  post: { bg: 'bg-blue-900/50', text: 'text-blue-400' },
  put: { bg: 'bg-orange-900/50', text: 'text-orange-400' },
  patch: { bg: 'bg-yellow-900/50', text: 'text-yellow-400' },
  delete: { bg: 'bg-red-900/50', text: 'text-red-400' },
  options: { bg: 'bg-gray-800', text: 'text-gray-400' },
  head: { bg: 'bg-purple-900/50', text: 'text-purple-400' },
};

const OperationCard: React.FC<{
  method: string;
  path: string;
  operation: OpenAPIV3.OperationObject;
  onNavigate: (path: string) => void;
}> = ({ method, path, operation, onNavigate }) => {
  const style = METHOD_STYLES[method];

  return (
    <div
      className={`p-4 border-b border-gray-700 last:border-b-0 cursor-pointer hover:bg-gray-800/50 ${
        operation.deprecated ? 'opacity-60' : ''
      }`}
      onClick={() => onNavigate(`paths.${path}.${method}`)}
    >
      <div className="flex items-center gap-3">
        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${style.bg} ${style.text}`}>
          {method}
        </span>
        <code className="text-gray-300 font-mono">{path}</code>
        {operation.deprecated && (
          <span className="px-2 py-0.5 bg-red-900/50 text-red-400 text-xs rounded">Deprecated</span>
        )}
      </div>
      
      {operation.summary && (
        <p className="mt-2 text-gray-300">{operation.summary}</p>
      )}
      
      {operation.description && (
        <p className="mt-1 text-gray-500 text-sm line-clamp-2">{operation.description}</p>
      )}

      {/* Parameters summary */}
      {operation.parameters && operation.parameters.length > 0 && (
        <div className="mt-3 flex gap-2">
          {operation.parameters.slice(0, 3).map((param: any, i) => (
            <span key={i} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">
              {param.name}
              {param.required && <span className="text-red-400">*</span>}
            </span>
          ))}
          {operation.parameters.length > 3 && (
            <span className="text-gray-500 text-xs">+{operation.parameters.length - 3} more</span>
          )}
        </div>
      )}

      {/* Response codes */}
      <div className="mt-3 flex gap-2">
        {Object.keys(operation.responses || {}).map(code => (
          <span
            key={code}
            className={`px-2 py-0.5 text-xs rounded ${
              code.startsWith('2') ? 'bg-green-900/50 text-green-400' :
              code.startsWith('4') ? 'bg-yellow-900/50 text-yellow-400' :
              code.startsWith('5') ? 'bg-red-900/50 text-red-400' :
              'bg-gray-800 text-gray-400'
            }`}
          >
            {code}
          </span>
        ))}
      </div>
    </div>
  );
};
```

#### 3.3.3 Graph View (Schema Relationships)

Visualizes schema relationships using an interactive node graph.

```typescript
// src/components/Preview/GraphView.tsx
import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useEditorStore } from '../../store/editor';

interface SchemaNode {
  id: string;
  name: string;
  type: 'schema' | 'endpoint';
  properties: number;
  referenced: boolean;
  orphaned: boolean;
}

interface SchemaLink {
  source: string;
  target: string;
  type: 'ref' | 'allOf' | 'oneOf' | 'anyOf' | 'items';
}

interface GraphViewProps {
  onNodeClick: (schemaName: string) => void;
}

export const GraphView: React.FC<GraphViewProps> = ({ onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { parsedSpec } = useEditorStore();
  const [filter, setFilter] = useState<'all' | 'referenced' | 'orphaned'>('all');
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

  const { nodes, links } = useMemo(() => {
    if (!parsedSpec?.components?.schemas) {
      return { nodes: [], links: [] };
    }
    return buildSchemaGraph(parsedSpec);
  }, [parsedSpec]);

  const filteredData = useMemo(() => {
    let filteredNodes = nodes;
    if (filter === 'referenced') {
      filteredNodes = nodes.filter(n => n.referenced);
    } else if (filter === 'orphaned') {
      filteredNodes = nodes.filter(n => n.orphaned);
    }
    
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = links.filter(l => 
      nodeIds.has(l.source as string) && nodeIds.has(l.target as string)
    );
    
    return { nodes: filteredNodes, links: filteredLinks };
  }, [nodes, links, filter]);

  useEffect(() => {
    if (!svgRef.current || filteredData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll('*').remove();

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    const container = svg.append('g');

    // Arrow marker for links
    svg.append('defs').selectAll('marker')
      .data(['ref', 'allOf', 'oneOf', 'anyOf', 'items'])
      .join('marker')
      .attr('id', d => `arrow-${d}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', d => getLinkColor(d))
      .attr('d', 'M0,-5L10,0L0,5');

    // Create force simulation
    const simulation = d3.forceSimulation(filteredData.nodes as any)
      .force('link', d3.forceLink(filteredData.links)
        .id((d: any) => d.id)
        .distance(150))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60));

    // Draw links
    const link = container.append('g')
      .selectAll('path')
      .data(filteredData.links)
      .join('path')
      .attr('stroke', d => getLinkColor(d.type))
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('marker-end', d => `url(#arrow-${d.type})`)
      .attr('opacity', 0.6);

    // Draw nodes
    const node = container.append('g')
      .selectAll('g')
      .data(filteredData.nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<any, SchemaNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Node circles
    node.append('circle')
      .attr('r', d => 20 + Math.min(d.properties * 2, 20))
      .attr('fill', d => d.orphaned ? '#6b7280' : '#3b82f6')
      .attr('stroke', d => highlightedNode === d.id ? '#fbbf24' : '#1e40af')
      .attr('stroke-width', d => highlightedNode === d.id ? 3 : 2);

    // Node labels
    node.append('text')
      .text(d => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', d => 30 + Math.min(d.properties * 2, 20))
      .attr('fill', '#e5e7eb')
      .attr('font-size', '12px');

    // Property count
    node.append('text')
      .text(d => d.properties)
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', '#fff')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold');

    // Hover and click handlers
    node.on('click', (event, d) => {
      onNodeClick(d.name);
    });

    node.on('mouseenter', (event, d) => {
      setHighlightedNode(d.id);
      // Highlight connected links
      link.attr('opacity', l => 
        l.source === d.id || l.target === d.id ? 1 : 0.2
      );
    });

    node.on('mouseleave', () => {
      setHighlightedNode(null);
      link.attr('opacity', 0.6);
    });

    // Simulation tick
    simulation.on('tick', () => {
      link.attr('d', (d: any) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
      });

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [filteredData, highlightedNode, onNodeClick]);

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-3 border-b border-gray-700">
        <span className="text-gray-400 text-sm">Filter:</span>
        <div className="flex gap-1">
          {(['all', 'referenced', 'orphaned'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded ${
                filter === f 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-400" /> $ref
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-green-400" /> allOf
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-yellow-400" /> oneOf
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-purple-400" /> items
          </span>
        </div>
      </div>

      {/* Graph Canvas */}
      <svg ref={svgRef} className="flex-1 w-full" />

      {/* Empty State */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-500">No schemas defined in specification</p>
        </div>
      )}
    </div>
  );
};

function buildSchemaGraph(spec: OpenAPIV3.Document): { nodes: SchemaNode[]; links: SchemaLink[] } {
  const nodes: SchemaNode[] = [];
  const links: SchemaLink[] = [];
  const referenced = new Set<string>();

  // First pass: collect all references
  const findRefs = (obj: any, currentSchema?: string) => {
    if (!obj || typeof obj !== 'object') return;
    
    if (obj.$ref && typeof obj.$ref === 'string') {
      const match = obj.$ref.match(/#\/components\/schemas\/(\w+)/);
      if (match) {
        referenced.add(match[1]);
        if (currentSchema) {
          links.push({ source: currentSchema, target: match[1], type: 'ref' });
        }
      }
    }

    // Handle composition keywords
    for (const keyword of ['allOf', 'oneOf', 'anyOf'] as const) {
      if (Array.isArray(obj[keyword])) {
        obj[keyword].forEach((item: any) => {
          if (item.$ref) {
            const match = item.$ref.match(/#\/components\/schemas\/(\w+)/);
            if (match && currentSchema) {
              referenced.add(match[1]);
              links.push({ source: currentSchema, target: match[1], type: keyword });
            }
          }
        });
      }
    }

    // Handle array items
    if (obj.items?.$ref) {
      const match = obj.items.$ref.match(/#\/components\/schemas\/(\w+)/);
      if (match && currentSchema) {
        referenced.add(match[1]);
        links.push({ source: currentSchema, target: match[1], type: 'items' });
      }
    }

    for (const value of Object.values(obj)) {
      findRefs(value, currentSchema);
    }
  };

  // Find refs from paths
  findRefs(spec.paths);

  // Build nodes and find internal refs
  for (const [name, schema] of Object.entries(spec.components?.schemas || {})) {
    const schemaObj = schema as any;
    const propertyCount = Object.keys(schemaObj.properties || {}).length;
    
    nodes.push({
      id: name,
      name,
      type: 'schema',
      properties: propertyCount,
      referenced: referenced.has(name),
      orphaned: !referenced.has(name),
    });

    findRefs(schemaObj, name);
  }

  return { nodes, links };
}

function getLinkColor(type: string): string {
  switch (type) {
    case 'ref': return '#60a5fa';
    case 'allOf': return '#34d399';
    case 'oneOf': return '#fbbf24';
    case 'anyOf': return '#f472b6';
    case 'items': return '#a78bfa';
    default: return '#6b7280';
  }
}
```

#### 3.3.4 Try It Out (API Playground)

Interactive request builder for testing endpoints.

```typescript
// src/components/Preview/TryItOut.tsx
import React, { useState, useCallback } from 'react';
import { useEditorStore } from '../../store/editor';
import type { OpenAPIV3 } from 'openapi-types';

interface RequestState {
  url: string;
  method: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  pathParams: Record<string, string>;
  body: string;
}

interface ResponseState {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
}

export const TryItOut: React.FC = () => {
  const { parsedSpec, activeEndpoint } = useEditorStore();
  const [selectedServer, setSelectedServer] = useState(0);
  const [request, setRequest] = useState<RequestState>({
    url: '',
    method: 'GET',
    headers: {},
    queryParams: {},
    pathParams: {},
    body: '',
  });
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ request: RequestState; response: ResponseState }>>([]);

  const servers = parsedSpec?.servers || [{ url: 'http://localhost:3000' }];
  const baseUrl = servers[selectedServer]?.url || '';

  // Parse active endpoint to get operation details
  const operation = useMemo(() => {
    if (!activeEndpoint || !parsedSpec) return null;
    
    const [, path, method] = activeEndpoint.match(/paths\.(.+?)\.(\w+)/) || [];
    if (!path || !method) return null;

    const pathItem = parsedSpec.paths?.[path];
    if (!pathItem) return null;

    return {
      path,
      method: method.toUpperCase(),
      operation: (pathItem as any)[method] as OpenAPIV3.OperationObject,
    };
  }, [activeEndpoint, parsedSpec]);

  const executeRequest = useCallback(async () => {
    if (!operation) return;

    setLoading(true);
    const startTime = performance.now();

    try {
      // Build URL with path params
      let url = `${baseUrl}${operation.path}`;
      for (const [key, value] of Object.entries(request.pathParams)) {
        url = url.replace(`{${key}}`, encodeURIComponent(value));
      }

      // Add query params
      const queryString = new URLSearchParams(request.queryParams).toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const fetchOptions: RequestInit = {
        method: operation.method,
        headers: {
          'Content-Type': 'application/json',
          ...request.headers,
        },
      };

      if (['POST', 'PUT', 'PATCH'].includes(operation.method) && request.body) {
        fetchOptions.body = request.body;
      }

      const res = await fetch(url, fetchOptions);
      const responseBody = await res.text();
      const endTime = performance.now();

      const responseState: ResponseState = {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: responseBody,
        time: Math.round(endTime - startTime),
      };

      setResponse(responseState);
      setHistory(prev => [...prev.slice(-9), { request: { ...request }, response: responseState }]);
    } catch (error: any) {
      setResponse({
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: error.message,
        time: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [operation, baseUrl, request]);

  if (!operation) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Select an endpoint from the editor or documentation view to try it out
      </div>
    );
  }

  const parameters = operation.operation.parameters || [];
  const pathParams = parameters.filter((p: any) => p.in === 'path');
  const queryParams = parameters.filter((p: any) => p.in === 'query');
  const headerParams = parameters.filter((p: any) => p.in === 'header');

  return (
    <div className="h-full flex flex-col bg-gray-900 overflow-hidden">
      {/* Request Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Endpoint Info */}
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-bold ${
            METHOD_STYLES[operation.method.toLowerCase()]?.bg || 'bg-gray-700'
          } ${METHOD_STYLES[operation.method.toLowerCase()]?.text || 'text-gray-300'}`}>
            {operation.method}
          </span>
          <code className="text-gray-300 font-mono flex-1">{operation.path}</code>
        </div>

        {/* Server Selection */}
        {servers.length > 1 && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Server</label>
            <select
              value={selectedServer}
              onChange={e => setSelectedServer(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-300"
            >
              {servers.map((server, i) => (
                <option key={i} value={i}>
                  {server.url} {server.description && `- ${server.description}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Path Parameters */}
        {pathParams.length > 0 && (
          <ParameterSection
            title="Path Parameters"
            parameters={pathParams}
            values={request.pathParams}
            onChange={pathParams => setRequest(r => ({ ...r, pathParams }))}
          />
        )}

        {/* Query Parameters */}
        {queryParams.length > 0 && (
          <ParameterSection
            title="Query Parameters"
            parameters={queryParams}
            values={request.queryParams}
            onChange={queryParams => setRequest(r => ({ ...r, queryParams }))}
          />
        )}

        {/* Headers */}
        {headerParams.length > 0 && (
          <ParameterSection
            title="Headers"
            parameters={headerParams}
            values={request.headers}
            onChange={headers => setRequest(r => ({ ...r, headers }))}
          />
        )}

        {/* Request Body */}
        {operation.operation.requestBody && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Request Body</label>
            <textarea
              value={request.body}
              onChange={e => setRequest(r => ({ ...r, body: e.target.value }))}
              placeholder={JSON.stringify(generateExample(operation.operation.requestBody), null, 2)}
              className="w-full h-40 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-300 font-mono text-sm resize-none"
            />
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={executeRequest}
          disabled={loading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
        >
          {loading ? 'Sending...' : 'Send Request'}
        </button>
      </div>

      {/* Response Section */}
      {response && (
        <div className="border-t border-gray-700 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-4 px-4 py-2 bg-gray-800">
            <span className={`font-bold ${
              response.status >= 200 && response.status < 300 ? 'text-green-400' :
              response.status >= 400 && response.status < 500 ? 'text-yellow-400' :
              response.status >= 500 ? 'text-red-400' : 'text-gray-400'
            }`}>
              {response.status} {response.statusText}
            </span>
            <span className="text-gray-500 text-sm">{response.time}ms</span>
          </div>
          <pre className="flex-1 overflow-auto p-4 text-sm text-gray-300 font-mono">
            {formatResponseBody(response.body)}
          </pre>
        </div>
      )}
    </div>
  );
};

const ParameterSection: React.FC<{
  title: string;
  parameters: any[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}> = ({ title, parameters, values, onChange }) => (
  <div>
    <label className="block text-sm text-gray-400 mb-2">{title}</label>
    <div className="space-y-2">
      {parameters.map((param: any) => (
        <div key={param.name} className="flex items-center gap-2">
          <label className="w-32 text-sm text-gray-300 truncate" title={param.name}>
            {param.name}
            {param.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={values[param.name] || ''}
            onChange={e => onChange({ ...values, [param.name]: e.target.value })}
            placeholder={param.schema?.example || param.schema?.type || ''}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-gray-300 text-sm"
          />
        </div>
      ))}
    </div>
  </div>
);

function formatResponseBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function generateExample(requestBody: any): any {
  // Generate example from schema
  const content = requestBody.content?.['application/json'];
  if (content?.example) return content.example;
  if (content?.schema) return generateFromSchema(content.schema);
  return {};
}

function generateFromSchema(schema: any): any {
  if (schema.example) return schema.example;
  if (schema.type === 'object') {
    const obj: any = {};
    for (const [key, prop] of Object.entries(schema.properties || {})) {
      obj[key] = generateFromSchema(prop);
    }
    return obj;
  }
  if (schema.type === 'array') {
    return [generateFromSchema(schema.items || {})];
  }
  if (schema.type === 'string') return 'string';
  if (schema.type === 'number' || schema.type === 'integer') return 0;
  if (schema.type === 'boolean') return true;
  return null;
}
```

#### 3.3.5 Diff View (Version Comparison)

Compare specifications with breaking change detection.

```typescript
// src/components/Preview/DiffView.tsx
import React, { useState, useMemo } from 'react';
import { useEditorStore } from '../../store/editor';

interface ChangeItem {
  type: 'added' | 'removed' | 'modified';
  breaking: boolean;
  path: string;
  description: string;
  oldValue?: any;
  newValue?: any;
}

interface DiffViewProps {
  compareSpec: OpenAPIV3.Document | null;
  onLoadCompare: () => void;
}

export const DiffView: React.FC<DiffViewProps> = ({ compareSpec, onLoadCompare }) => {
  const { parsedSpec } = useEditorStore();
  const [filter, setFilter] = useState<'all' | 'breaking' | 'non-breaking'>('all');

  const changes = useMemo(() => {
    if (!parsedSpec || !compareSpec) return [];
    return computeChanges(compareSpec, parsedSpec);
  }, [parsedSpec, compareSpec]);

  const filteredChanges = useMemo(() => {
    if (filter === 'all') return changes;
    if (filter === 'breaking') return changes.filter(c => c.breaking);
    return changes.filter(c => !c.breaking);
  }, [changes, filter]);

  const breakingCount = changes.filter(c => c.breaking).length;

  if (!compareSpec) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-500">
        <p>Load a previous version to compare</p>
        <button
          onClick={onLoadCompare}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Load Comparison File
        </button>
        <p className="text-sm">Or drag and drop a file here</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Summary Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-medium text-gray-200">
              {changes.length} changes detected
            </h3>
            {breakingCount > 0 && (
              <span className="px-2 py-1 bg-red-900/50 text-red-400 text-sm rounded">
                {breakingCount} breaking
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {(['all', 'breaking', 'non-breaking'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-sm rounded ${
                  filter === f 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {f === 'all' ? 'All' : f === 'breaking' ? 'Breaking' : 'Non-breaking'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Changes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredChanges.map((change, i) => (
          <ChangeCard key={i} change={change} />
        ))}
        {filteredChanges.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            {filter === 'all' ? 'No changes detected' : `No ${filter} changes`}
          </p>
        )}
      </div>

      {/* Export Changelog */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={() => exportChangelog(changes)}
          className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
        >
          Export Changelog as Markdown
        </button>
      </div>
    </div>
  );
};

const ChangeCard: React.FC<{ change: ChangeItem }> = ({ change }) => {
  const [expanded, setExpanded] = useState(false);

  const typeStyles = {
    added: 'bg-green-900/30 border-green-700 text-green-400',
    removed: 'bg-red-900/30 border-red-700 text-red-400',
    modified: 'bg-yellow-900/30 border-yellow-700 text-yellow-400',
  };

  const typeLabels = {
    added: 'Added',
    removed: 'Removed',
    modified: 'Modified',
  };

  return (
    <div
      className={`border rounded p-3 cursor-pointer ${typeStyles[change.type]}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium uppercase">{typeLabels[change.type]}</span>
        {change.breaking && (
          <span className="px-1.5 py-0.5 bg-red-600 text-white text-xs rounded">BREAKING</span>
        )}
        <code className="text-sm font-mono flex-1 truncate">{change.path}</code>
      </div>
      <p className="mt-1 text-sm opacity-80">{change.description}</p>
      
      {expanded && (change.oldValue !== undefined || change.newValue !== undefined) && (
        <div className="mt-3 grid grid-cols-2 gap-4 text-xs font-mono">
          {change.oldValue !== undefined && (
            <div className="bg-red-900/20 rounded p-2">
              <div className="text-red-400 mb-1">Previous</div>
              <pre className="whitespace-pre-wrap">{JSON.stringify(change.oldValue, null, 2)}</pre>
            </div>
          )}
          {change.newValue !== undefined && (
            <div className="bg-green-900/20 rounded p-2">
              <div className="text-green-400 mb-1">Current</div>
              <pre className="whitespace-pre-wrap">{JSON.stringify(change.newValue, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function computeChanges(oldSpec: OpenAPIV3.Document, newSpec: OpenAPIV3.Document): ChangeItem[] {
  const changes: ChangeItem[] = [];

  // Compare paths
  const oldPaths = new Set(Object.keys(oldSpec.paths || {}));
  const newPaths = new Set(Object.keys(newSpec.paths || {}));

  // Removed paths (breaking)
  for (const path of oldPaths) {
    if (!newPaths.has(path)) {
      changes.push({
        type: 'removed',
        breaking: true,
        path: `paths.${path}`,
        description: `Endpoint ${path} was removed`,
      });
    }
  }

  // Added paths (non-breaking)
  for (const path of newPaths) {
    if (!oldPaths.has(path)) {
      changes.push({
        type: 'added',
        breaking: false,
        path: `paths.${path}`,
        description: `New endpoint ${path} was added`,
      });
    }
  }

  // Compare common paths for operation changes
  for (const path of oldPaths) {
    if (!newPaths.has(path)) continue;

    const oldPath = oldSpec.paths![path];
    const newPath = newSpec.paths![path];

    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const oldOp = (oldPath as any)?.[method];
      const newOp = (newPath as any)?.[method];

      if (oldOp && !newOp) {
        changes.push({
          type: 'removed',
          breaking: true,
          path: `paths.${path}.${method}`,
          description: `${method.toUpperCase()} operation was removed`,
        });
      } else if (!oldOp && newOp) {
        changes.push({
          type: 'added',
          breaking: false,
          path: `paths.${path}.${method}`,
          description: `${method.toUpperCase()} operation was added`,
        });
      } else if (oldOp && newOp) {
        // Check for parameter changes
        const oldParams = (oldOp.parameters || []) as any[];
        const newParams = (newOp.parameters || []) as any[];

        // New required parameters (breaking)
        for (const param of newParams) {
          const oldParam = oldParams.find(p => p.name === param.name && p.in === param.in);
          if (!oldParam && param.required) {
            changes.push({
              type: 'added',
              breaking: true,
              path: `paths.${path}.${method}.parameters.${param.name}`,
              description: `Required parameter "${param.name}" was added`,
              newValue: param,
            });
          }
        }

        // Removed parameters (might be breaking depending on context)
        for (const param of oldParams) {
          const newParam = newParams.find(p => p.name === param.name && p.in === param.in);
          if (!newParam) {
            changes.push({
              type: 'removed',
              breaking: false,
              path: `paths.${path}.${method}.parameters.${param.name}`,
              description: `Parameter "${param.name}" was removed`,
              oldValue: param,
            });
          }
        }

        // Response changes
        const oldResponses = Object.keys(oldOp.responses || {});
        const newResponses = Object.keys(newOp.responses || {});

        for (const code of oldResponses) {
          if (!newResponses.includes(code) && code.startsWith('2')) {
            changes.push({
              type: 'removed',
              breaking: true,
              path: `paths.${path}.${method}.responses.${code}`,
              description: `Success response ${code} was removed`,
            });
          }
        }
      }
    }
  }

  // Compare schemas
  const oldSchemas = new Set(Object.keys(oldSpec.components?.schemas || {}));
  const newSchemas = new Set(Object.keys(newSpec.components?.schemas || {}));

  for (const schema of oldSchemas) {
    if (!newSchemas.has(schema)) {
      changes.push({
        type: 'removed',
        breaking: true, // Could be breaking if referenced
        path: `components.schemas.${schema}`,
        description: `Schema "${schema}" was removed`,
      });
    }
  }

  for (const schema of newSchemas) {
    if (!oldSchemas.has(schema)) {
      changes.push({
        type: 'added',
        breaking: false,
        path: `components.schemas.${schema}`,
        description: `Schema "${schema}" was added`,
      });
    }
  }

  return changes;
}

function exportChangelog(changes: ChangeItem[]): void {
  const breaking = changes.filter(c => c.breaking);
  const nonBreaking = changes.filter(c => !c.breaking);

  let markdown = `# API Changelog\n\n`;
  markdown += `Generated: ${new Date().toISOString()}\n\n`;

  if (breaking.length > 0) {
    markdown += `## ⚠️ Breaking Changes\n\n`;
    for (const change of breaking) {
      markdown += `- **${change.type.toUpperCase()}** \`${change.path}\`: ${change.description}\n`;
    }
    markdown += `\n`;
  }

  if (nonBreaking.length > 0) {
    markdown += `## Changes\n\n`;
    for (const change of nonBreaking) {
      markdown += `- **${change.type}** \`${change.path}\`: ${change.description}\n`;
    }
  }

  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `changelog-${new Date().toISOString().split('T')[0]}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
```

#### 3.3.6 Code Snippets View

Generate client code for the active endpoint.

```typescript
// src/components/Preview/CodeSnippetsView.tsx
import React, { useState, useMemo } from 'react';
import { useEditorStore } from '../../store/editor';
import { Copy, Check } from 'lucide-react';

type Language = 'curl' | 'javascript' | 'python' | 'go' | 'php' | 'ruby';

interface CodeSnippetsViewProps {
  // Optional configuration for code generation
}

export const CodeSnippetsView: React.FC<CodeSnippetsViewProps> = () => {
  const { parsedSpec, activeEndpoint } = useEditorStore();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('curl');
  const [copied, setCopied] = useState(false);

  const operation = useMemo(() => {
    if (!activeEndpoint || !parsedSpec) return null;
    
    const [, path, method] = activeEndpoint.match(/paths\.(.+?)\.(\w+)/) || [];
    if (!path || !method) return null;

    const pathItem = parsedSpec.paths?.[path];
    if (!pathItem) return null;

    return {
      path,
      method: method.toUpperCase(),
      operation: (pathItem as any)[method],
      servers: parsedSpec.servers || [{ url: 'https://api.example.com' }],
    };
  }, [activeEndpoint, parsedSpec]);

  const snippet = useMemo(() => {
    if (!operation) return '';
    return generateSnippet(selectedLanguage, operation);
  }, [operation, selectedLanguage]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!operation) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Select an endpoint to generate code snippets
      </div>
    );
  }

  const languages: { id: Language; label: string; icon: string }[] = [
    { id: 'curl', label: 'cURL', icon: '🔧' },
    { id: 'javascript', label: 'JavaScript', icon: '🟨' },
    { id: 'python', label: 'Python', icon: '🐍' },
    { id: 'go', label: 'Go', icon: '🔵' },
    { id: 'php', label: 'PHP', icon: '🐘' },
    { id: 'ruby', label: 'Ruby', icon: '💎' },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Language Selector */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-700 overflow-x-auto">
        {languages.map(lang => (
          <button
            key={lang.id}
            onClick={() => setSelectedLanguage(lang.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm whitespace-nowrap ${
              selectedLanguage === lang.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <span>{lang.icon}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>

      {/* Code Display */}
      <div className="flex-1 overflow-auto relative">
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
        <pre className="p-4 text-sm text-gray-300 font-mono whitespace-pre-wrap">
          <code>{snippet}</code>
        </pre>
      </div>
    </div>
  );
};

function generateSnippet(language: Language, operation: any): string {
  const { path, method, operation: op, servers } = operation;
  const baseUrl = servers[0]?.url || 'https://api.example.com';
  const url = `${baseUrl}${path}`;
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);

  switch (language) {
    case 'curl':
      return generateCurl(url, method, op, hasBody);
    case 'javascript':
      return generateJavaScript(url, method, op, hasBody);
    case 'python':
      return generatePython(url, method, op, hasBody);
    case 'go':
      return generateGo(url, method, op, hasBody);
    case 'php':
      return generatePhp(url, method, op, hasBody);
    case 'ruby':
      return generateRuby(url, method, op, hasBody);
    default:
      return '';
  }
}

function generateCurl(url: string, method: string, op: any, hasBody: boolean): string {
  let cmd = `curl -X ${method} "${url}"`;
  cmd += ` \\\n  -H "Content-Type: application/json"`;
  cmd += ` \\\n  -H "Authorization: Bearer YOUR_API_KEY"`;
  
  if (hasBody) {
    const example = getRequestBodyExample(op);
    cmd += ` \\\n  -d '${JSON.stringify(example, null, 2)}'`;
  }
  
  return cmd;
}

function generateJavaScript(url: string, method: string, op: any, hasBody: boolean): string {
  const example = hasBody ? getRequestBodyExample(op) : null;
  
  return `const response = await fetch("${url}", {
  method: "${method}",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  }${hasBody ? `,
  body: JSON.stringify(${JSON.stringify(example, null, 4).split('\n').join('\n  ')})` : ''}
});

const data = await response.json();
console.log(data);`;
}

function generatePython(url: string, method: string, op: any, hasBody: boolean): string {
  const example = hasBody ? getRequestBodyExample(op) : null;
  
  return `import requests

url = "${url}"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
}
${hasBody ? `
payload = ${JSON.stringify(example, null, 4)}

response = requests.${method.toLowerCase()}(url, headers=headers, json=payload)` : `
response = requests.${method.toLowerCase()}(url, headers=headers)`}

print(response.json())`;
}

function generateGo(url: string, method: string, op: any, hasBody: boolean): string {
  return `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "io/ioutil"
)

func main() {
    url := "${url}"
    ${hasBody ? `
    payload := map[string]interface{}{
        // Add your request body here
    }
    jsonPayload, _ := json.Marshal(payload)
    req, _ := http.NewRequest("${method}", url, bytes.NewBuffer(jsonPayload))` : `
    req, _ := http.NewRequest("${method}", url, nil)`}
    
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer YOUR_API_KEY")
    
    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()
    
    body, _ := ioutil.ReadAll(resp.Body)
    fmt.Println(string(body))
}`;
}

function generatePhp(url: string, method: string, op: any, hasBody: boolean): string {
  return `<?php

$url = "${url}";
$headers = [
    "Content-Type: application/json",
    "Authorization: Bearer YOUR_API_KEY"
];
${hasBody ? `
$payload = json_encode([
    // Add your request body here
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${method}");
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);` : `
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${method}");`}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

echo $response;`;
}

function generateRuby(url: string, method: string, op: any, hasBody: boolean): string {
  return `require 'net/http'
require 'json'

uri = URI("${url}")
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = uri.scheme == 'https'

request = Net::HTTP::${method.charAt(0) + method.slice(1).toLowerCase()}.new(uri.path)
request["Content-Type"] = "application/json"
request["Authorization"] = "Bearer YOUR_API_KEY"
${hasBody ? `
request.body = {
  # Add your request body here
}.to_json` : ''}

response = http.request(request)
puts JSON.parse(response.body)`;
}

function getRequestBodyExample(op: any): any {
  const content = op?.requestBody?.content?.['application/json'];
  if (content?.example) return content.example;
  if (content?.schema?.example) return content.schema.example;
  return { key: 'value' };
}
```

#### 3.3.7 Validation Report View

Structured summary of all validation issues.

```typescript
// src/components/Preview/ValidationReportView.tsx
import React, { useMemo, useState } from 'react';
import { useEditorStore } from '../../store/editor';
import { AlertCircle, AlertTriangle, Info, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface GroupedIssues {
  category: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

interface ValidationIssue {
  line: number;
  column: number;
  message: string;
  path: string;
  rule?: string;
  severity: 'error' | 'warning' | 'info';
}

export const ValidationReportView: React.FC = () => {
  const { validation, goToLine } = useEditorStore();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const allIssues = useMemo(() => {
    const issues: ValidationIssue[] = [
      ...validation.errors.map(e => ({ ...e, severity: 'error' as const })),
      ...validation.warnings.map(w => ({ ...w, severity: 'warning' as const })),
    ];
    return issues;
  }, [validation]);

  const groupedIssues = useMemo(() => {
    const groups: Record<string, GroupedIssues> = {};

    for (const issue of allIssues) {
      // Extract category from path (e.g., "paths", "components.schemas", "info")
      const category = issue.path.split('.').slice(0, 2).join('.') || 'general';
      
      if (!groups[category]) {
        groups[category] = { category, errors: [], warnings: [], info: [] };
      }

      if (issue.severity === 'error') {
        groups[category].errors.push(issue);
      } else if (issue.severity === 'warning') {
        groups[category].warnings.push(issue);
      } else {
        groups[category].info.push(issue);
      }
    }

    return Object.values(groups).sort((a, b) => {
      // Sort by error count, then warning count
      const aScore = a.errors.length * 100 + a.warnings.length;
      const bScore = b.errors.length * 100 + b.warnings.length;
      return bScore - aScore;
    });
  }, [allIssues]);

  const filteredGroups = useMemo(() => {
    if (severityFilter === 'all') return groupedIssues;
    
    return groupedIssues
      .map(group => ({
        ...group,
        errors: severityFilter === 'error' ? group.errors : [],
        warnings: severityFilter === 'warning' ? group.warnings : [],
        info: severityFilter === 'info' ? group.info : [],
      }))
      .filter(g => g.errors.length > 0 || g.warnings.length > 0 || g.info.length > 0);
  }, [groupedIssues, severityFilter]);

  const totalErrors = validation.errors.length;
  const totalWarnings = validation.warnings.length;

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Summary Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {totalErrors === 0 && totalWarnings === 0 ? (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">No issues found</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">{totalErrors} errors</span>
                </div>
                <div className="flex items-center gap-2 text-yellow-400">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">{totalWarnings} warnings</span>
                </div>
              </>
            )}
          </div>

          {/* Severity Filter */}
          <div className="flex gap-1">
            {(['all', 'error', 'warning'] as const).map(sev => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1 text-sm rounded ${
                  severityFilter === sev
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {sev.charAt(0).toUpperCase() + sev.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto">
        {filteredGroups.map(group => {
          const isExpanded = expandedCategories.has(group.category);
          const issueCount = group.errors.length + group.warnings.length + group.info.length;

          return (
            <div key={group.category} className="border-b border-gray-800">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(group.category)}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-800 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <code className="text-gray-300 font-mono text-sm">{group.category}</code>
                <div className="flex-1" />
                <div className="flex gap-2">
                  {group.errors.length > 0 && (
                    <span className="px-2 py-0.5 bg-red-900/50 text-red-400 text-xs rounded">
                      {group.errors.length}
                    </span>
                  )}
                  {group.warnings.length > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-900/50 text-yellow-400 text-xs rounded">
                      {group.warnings.length}
                    </span>
                  )}
                </div>
              </button>

              {/* Issues */}
              {isExpanded && (
                <div className="pl-8 pr-4 pb-2 space-y-1">
                  {[...group.errors, ...group.warnings, ...group.info].map((issue, i) => (
                    <div
                      key={i}
                      onClick={() => goToLine(issue.line, issue.column)}
                      className="flex items-start gap-3 p-2 rounded hover:bg-gray-800 cursor-pointer"
                    >
                      {issue.severity === 'error' && <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />}
                      {issue.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />}
                      {issue.severity === 'info' && <Info className="w-4 h-4 text-blue-400 mt-0.5" />}
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300">{issue.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            Line {issue.line}:{issue.column}
                          </span>
                          {issue.rule && (
                            <span className="text-xs text-gray-600 font-mono">({issue.rule})</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredGroups.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No issues to display</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-t border-gray-700 flex gap-2">
        <button
          onClick={() => setExpandedCategories(new Set(groupedIssues.map(g => g.category)))}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
        >
          Expand All
        </button>
        <button
          onClick={() => setExpandedCategories(new Set())}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
        >
          Collapse All
        </button>
        <div className="flex-1" />
        <button
          onClick={() => exportReport(allIssues)}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
        >
          Export Report
        </button>
      </div>
    </div>
  );
};

function exportReport(issues: ValidationIssue[]): void {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: issues.length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
    },
    issues: issues.map(i => ({
      severity: i.severity,
      message: i.message,
      path: i.path,
      location: `${i.line}:${i.column}`,
      rule: i.rule,
    })),
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `validation-report-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

#### 3.3.8 Preview Pane Container

Orchestrates all preview modes with tab navigation.

```typescript
// src/components/Preview/PreviewPane.tsx
import React, { useState, lazy, Suspense } from 'react';
import { FileText, GitCompare, Play, Code, AlertTriangle, Share2 } from 'lucide-react';
import { useEditorStore } from '../../store/editor';
import { useHotkeys } from 'react-hotkeys-hook';

// Lazy load preview components for code splitting
const DocumentationView = lazy(() => import('./DocumentationView'));
const GraphView = lazy(() => import('./GraphView'));
const TryItOut = lazy(() => import('./TryItOut'));
const DiffView = lazy(() => import('./DiffView'));
const CodeSnippetsView = lazy(() => import('./CodeSnippetsView'));
const ValidationReportView = lazy(() => import('./ValidationReportView'));

type PreviewTab = 'docs' | 'graph' | 'tryit' | 'diff' | 'snippets' | 'report';

interface Tab {
  id: PreviewTab;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}

const TABS: Tab[] = [
  { id: 'docs', label: 'Docs', icon: <FileText className="w-4 h-4" />, shortcut: 'ctrl+shift+1' },
  { id: 'graph', label: 'Graph', icon: <Share2 className="w-4 h-4" />, shortcut: 'ctrl+shift+2' },
  { id: 'tryit', label: 'Try It', icon: <Play className="w-4 h-4" />, shortcut: 'ctrl+shift+3' },
  { id: 'diff', label: 'Diff', icon: <GitCompare className="w-4 h-4" />, shortcut: 'ctrl+shift+4' },
  { id: 'snippets', label: 'Code', icon: <Code className="w-4 h-4" />, shortcut: 'ctrl+shift+5' },
  { id: 'report', label: 'Report', icon: <AlertTriangle className="w-4 h-4" />, shortcut: 'ctrl+shift+6' },
];

export const PreviewPane: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PreviewTab>('docs');
  const [compareSpec, setCompareSpec] = useState<any>(null);
  const { validation, goToLine } = useEditorStore();

  // Register keyboard shortcuts
  useHotkeys('ctrl+shift+1', () => setActiveTab('docs'), { enableOnFormTags: true });
  useHotkeys('ctrl+shift+2', () => setActiveTab('graph'), { enableOnFormTags: true });
  useHotkeys('ctrl+shift+3', () => setActiveTab('tryit'), { enableOnFormTags: true });
  useHotkeys('ctrl+shift+4', () => setActiveTab('diff'), { enableOnFormTags: true });
  useHotkeys('ctrl+shift+5', () => setActiveTab('snippets'), { enableOnFormTags: true });
  useHotkeys('ctrl+shift+6', () => setActiveTab('report'), { enableOnFormTags: true });

  const handleNavigate = (path: string) => {
    // Convert JSON path to line number and navigate
    // This would use the sourceMap from the store
    console.log('Navigate to:', path);
  };

  const handleLoadCompare = async () => {
    // Open file picker for comparison spec
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const content = await file.text();
        const yaml = await import('yaml');
        setCompareSpec(yaml.parse(content));
      }
    };
    input.click();
  };

  const renderContent = () => {
    const Loading = () => (
      <div className="h-full flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );

    switch (activeTab) {
      case 'docs':
        return (
          <Suspense fallback={<Loading />}>
            <DocumentationView onNavigate={handleNavigate} />
          </Suspense>
        );
      case 'graph':
        return (
          <Suspense fallback={<Loading />}>
            <GraphView onNodeClick={(name) => handleNavigate(`components.schemas.${name}`)} />
          </Suspense>
        );
      case 'tryit':
        return (
          <Suspense fallback={<Loading />}>
            <TryItOut />
          </Suspense>
        );
      case 'diff':
        return (
          <Suspense fallback={<Loading />}>
            <DiffView compareSpec={compareSpec} onLoadCompare={handleLoadCompare} />
          </Suspense>
        );
      case 'snippets':
        return (
          <Suspense fallback={<Loading />}>
            <CodeSnippetsView />
          </Suspense>
        );
      case 'report':
        return (
          <Suspense fallback={<Loading />}>
            <ValidationReportView />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-700">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-gray-700 bg-gray-800/50">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const hasIssues = tab.id === 'report' && (validation.errors.length > 0 || validation.warnings.length > 0);

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-500 text-blue-400 bg-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800'
              }`}
              title={`${tab.label} (${tab.shortcut})`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {hasIssues && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-600 text-white rounded-full">
                  {validation.errors.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

export default PreviewPane;
```

---

## 4. State Management

### 4.1 Store Architecture

```typescript
// src/store/editor.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { OpenAPIV3 } from 'openapi-types';
import type { EditorView } from '@codemirror/view';

interface EditorFile {
  id: string;
  name: string;
  content: string;
  path?: string; // File system path if available
  isDirty: boolean;
  language: 'yaml' | 'json';
}

interface ValidationState {
  isValidating: boolean;
  syntaxValid: boolean;
  schemaValid: boolean;
  errors: any[];
  warnings: any[];
  lastValidated: number;
}

interface EditorState {
  // Files
  files: EditorFile[];
  activeFileId: string | null;
  
  // Parsed state
  parsedSpec: OpenAPIV3.Document | null;
  sourceMap: Map<string, { line: number; column: number }>;
  
  // Validation
  validation: ValidationState;
  
  // UI state
  showPreview: boolean;
  showOutline: boolean;
  previewMode: 'docs' | 'graph' | 'tryit';
  theme: 'dark' | 'light';
  
  // Editor reference
  editorView: EditorView | null;
  
  // Actions
  openFile: (file: Omit<EditorFile, 'isDirty'>) => void;
  closeFile: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  setActiveFile: (fileId: string) => void;
  setParsedSpec: (spec: OpenAPIV3.Document | null, sourceMap: Map<string, any>) => void;
  setValidation: (validation: Partial<ValidationState>) => void;
  setEditorView: (view: EditorView | null) => void;
  goToLine: (line: number, column?: number) => void;
  togglePreview: () => void;
  toggleOutline: () => void;
  setPreviewMode: (mode: 'docs' | 'graph' | 'tryit') => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      files: [],
      activeFileId: null,
      parsedSpec: null,
      sourceMap: new Map(),
      validation: {
        isValidating: false,
        syntaxValid: true,
        schemaValid: true,
        errors: [],
        warnings: [],
        lastValidated: 0,
      },
      showPreview: true,
      showOutline: true,
      previewMode: 'docs',
      theme: 'dark',
      editorView: null,

      // Actions
      openFile: (file) => set((state) => {
        const existing = state.files.find(f => f.id === file.id);
        if (existing) {
          state.activeFileId = file.id;
        } else {
          state.files.push({ ...file, isDirty: false });
          state.activeFileId = file.id;
        }
      }),

      closeFile: (fileId) => set((state) => {
        const index = state.files.findIndex(f => f.id === fileId);
        if (index !== -1) {
          state.files.splice(index, 1);
          if (state.activeFileId === fileId) {
            state.activeFileId = state.files[Math.max(0, index - 1)]?.id || null;
          }
        }
      }),

      updateFileContent: (fileId, content) => set((state) => {
        const file = state.files.find(f => f.id === fileId);
        if (file) {
          file.content = content;
          file.isDirty = true;
        }
      }),

      setActiveFile: (fileId) => set((state) => {
        state.activeFileId = fileId;
      }),

      setParsedSpec: (spec, sourceMap) => set((state) => {
        state.parsedSpec = spec;
        state.sourceMap = sourceMap;
      }),

      setValidation: (validation) => set((state) => {
        Object.assign(state.validation, validation);
      }),

      setEditorView: (view) => set((state) => {
        state.editorView = view;
      }),

      goToLine: (line, column = 1) => {
        const { editorView } = get();
        if (!editorView) return;

        const lineInfo = editorView.state.doc.line(line);
        const pos = lineInfo.from + column - 1;
        
        editorView.dispatch({
          selection: { anchor: pos },
          scrollIntoView: true,
          effects: EditorView.scrollIntoView(pos, { y: 'center' }),
        });
        editorView.focus();
      },

      togglePreview: () => set((state) => {
        state.showPreview = !state.showPreview;
      }),

      toggleOutline: () => set((state) => {
        state.showOutline = !state.showOutline;
      }),

      setPreviewMode: (mode) => set((state) => {
        state.previewMode = mode;
      }),
    })),
    {
      name: 'openapi-editor-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        showPreview: state.showPreview,
        showOutline: state.showOutline,
        previewMode: state.previewMode,
        // Don't persist files, editor view, or validation state
      }),
    }
  )
);
```

---

## 5. Performance Optimizations

### 5.1 Virtualized Rendering for Large Files

```typescript
// src/editor/extensions/virtualization.ts
import { Extension, StateField, StateEffect } from '@codemirror/state';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';

// Only render visible lines + buffer
const BUFFER_LINES = 50;

export const virtualizationExtension = (): Extension => {
  return ViewPlugin.fromClass(class {
    constructor(view: EditorView) {
      // CodeMirror 6 handles virtualization internally
      // This plugin adds custom behavior for very large files
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        // Trigger lazy loading of decorations only for visible range
        this.updateVisibleDecorations(update.view);
      }
    }

    private updateVisibleDecorations(view: EditorView) {
      const { from, to } = view.viewport;
      // Only compute decorations (syntax highlighting, lint markers)
      // for the visible range + buffer
    }
  });
};
```

### 5.2 Memoization and Caching Strategy

```typescript
// src/utils/cache.ts
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Validation result cache
export const validationCache = new LRUCache<string, ValidationResult>(50);

// Parsed spec cache
export const specCache = new LRUCache<string, OpenAPIV3.Document>(10);
```

### 5.3 Debouncing and Throttling Configuration

```typescript
// src/config/performance.ts
export const PERFORMANCE_CONFIG = {
  // Validation debounce delays (ms)
  validation: {
    syntax: 100,    // Fast syntax check
    schema: 300,    // Full schema validation
    lint: 500,      // Spectral linting
  },
  
  // UI update throttling
  ui: {
    preview: 500,   // Documentation preview
    outline: 200,   // Outline tree rebuild
    minimap: 100,   // Minimap render
  },
  
  // Search debouncing
  search: {
    symbols: 150,   // Symbol search
    files: 200,     // File search
    global: 300,    // Global text search
  },
  
  // Worker communication batching
  workers: {
    batchInterval: 50,  // Batch multiple requests
    maxBatchSize: 10,   // Max requests per batch
  },
};
```

---

## 6. File System Integration

### 6.1 File System Access API Integration

```typescript
// src/services/file-system.ts
interface FileSystemService {
  openFile(): Promise<EditorFile | null>;
  openDirectory(): Promise<EditorFile[]>;
  saveFile(file: EditorFile): Promise<boolean>;
  watchFile(file: EditorFile, onChange: (content: string) => void): () => void;
}

export class NativeFileSystem implements FileSystemService {
  private fileHandles = new Map<string, FileSystemFileHandle>();
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  async openFile(): Promise<EditorFile | null> {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'OpenAPI Specifications',
            accept: {
              'application/x-yaml': ['.yaml', '.yml'],
              'application/json': ['.json'],
            },
          },
        ],
        multiple: false,
      });

      const file = await handle.getFile();
      const content = await file.text();
      const id = crypto.randomUUID();
      
      this.fileHandles.set(id, handle);

      return {
        id,
        name: file.name,
        content,
        path: file.name,
        isDirty: false,
        language: file.name.endsWith('.json') ? 'json' : 'yaml',
      };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      throw e;
    }
  }

  async openDirectory(): Promise<EditorFile[]> {
    try {
      this.directoryHandle = await window.showDirectoryPicker();
      return this.scanDirectory(this.directoryHandle);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return [];
      throw e;
    }
  }

  private async scanDirectory(
    dir: FileSystemDirectoryHandle,
    path: string = ''
  ): Promise<EditorFile[]> {
    const files: EditorFile[] = [];
    
    for await (const entry of dir.values()) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name;
      
      if (entry.kind === 'file' && this.isOpenApiFile(entry.name)) {
        const file = await entry.getFile();
        const content = await file.text();
        const id = crypto.randomUUID();
        
        this.fileHandles.set(id, entry);
        
        files.push({
          id,
          name: entry.name,
          content,
          path: entryPath,
          isDirty: false,
          language: entry.name.endsWith('.json') ? 'json' : 'yaml',
        });
      } else if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
        const subFiles = await this.scanDirectory(entry, entryPath);
        files.push(...subFiles);
      }
    }
    
    return files;
  }

  async saveFile(file: EditorFile): Promise<boolean> {
    const handle = this.fileHandles.get(file.id);
    
    if (!handle) {
      // Save As
      const newHandle = await window.showSaveFilePicker({
        suggestedName: file.name,
        types: [
          {
            description: 'OpenAPI Specifications',
            accept: {
              'application/x-yaml': ['.yaml', '.yml'],
              'application/json': ['.json'],
            },
          },
        ],
      });
      
      this.fileHandles.set(file.id, newHandle);
      return this.writeToHandle(newHandle, file.content);
    }

    return this.writeToHandle(handle, file.content);
  }

  private async writeToHandle(handle: FileSystemFileHandle, content: string): Promise<boolean> {
    try {
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (e) {
      console.error('Failed to save file:', e);
      return false;
    }
  }

  watchFile(file: EditorFile, onChange: (content: string) => void): () => void {
    // File watching not directly supported in File System Access API
    // Use polling as fallback
    const handle = this.fileHandles.get(file.id);
    if (!handle) return () => {};

    let lastModified = 0;
    const interval = setInterval(async () => {
      try {
        const fileObj = await handle.getFile();
        if (fileObj.lastModified > lastModified) {
          lastModified = fileObj.lastModified;
          const content = await fileObj.text();
          onChange(content);
        }
      } catch (e) {
        // File might have been deleted
      }
    }, 1000);

    return () => clearInterval(interval);
  }

  private isOpenApiFile(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.endsWith('.yaml') || 
           lower.endsWith('.yml') || 
           lower.endsWith('.json');
  }
}

// Fallback for browsers without File System Access API
export class FallbackFileSystem implements FileSystemService {
  async openFile(): Promise<EditorFile | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.yaml,.yml,.json';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return resolve(null);
        
        const content = await file.text();
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          content,
          isDirty: false,
          language: file.name.endsWith('.json') ? 'json' : 'yaml',
        });
      };
      
      input.click();
    });
  }

  async openDirectory(): Promise<EditorFile[]> {
    // Not supported in fallback mode
    return [];
  }

  async saveFile(file: EditorFile): Promise<boolean> {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  watchFile(): () => void {
    return () => {}; // Not supported
  }
}

// Factory
export function createFileSystem(): FileSystemService {
  if ('showOpenFilePicker' in window) {
    return new NativeFileSystem();
  }
  return new FallbackFileSystem();
}
```

---

## 7. Implementation Roadmap

### Phase 1: Core Editor (Weeks 1-4)

**Week 1: Project Setup**
- [ ] Initialize Vite + React + TypeScript project
- [ ] Configure Tailwind CSS and design tokens
- [ ] Set up ESLint, Prettier, Husky
- [ ] Create basic component structure
- [ ] Implement dark theme foundation

**Week 2: CodeMirror Integration**
- [ ] Integrate CodeMirror 6 with YAML/JSON support
- [ ] Implement basic keybindings
- [ ] Add line numbers, folding, search
- [ ] Create editor state management with Zustand
- [ ] Basic file open/save (fallback method)

**Week 3: Validation Pipeline**
- [ ] Set up Web Worker infrastructure with Comlink
- [ ] Implement validation worker (swagger-parser)
- [ ] Create tiered validation pipeline
- [ ] Add error/warning display in gutter
- [ ] Implement debounced validation

**Week 4: Basic UI**
- [ ] Build split pane layout (editor + preview)
- [ ] Create simple documentation preview (using Swagger UI React)
- [ ] Implement status bar with validation status
- [ ] Add basic notifications system
- [ ] File dirty state and unsaved changes warning

### Phase 2: Power User Features (Weeks 5-8)

**Week 5: Command Palette & Navigation**
- [ ] Build command palette component
- [ ] Implement fuzzy search for commands
- [ ] Add Go to Line, Go to Symbol dialogs
- [ ] Create keyboard shortcut system
- [ ] Add shortcut customization

**Week 6: $ref Navigation**
- [ ] Build source map from YAML/JSON
- [ ] Implement Go to Definition (F12)
- [ ] Add Peek Definition (Alt+F12)
- [ ] Create Find All References
- [ ] Highlight $ref on hover

**Week 7: Outline & Breadcrumbs**
- [ ] Build outline tree view component
- [ ] Add filtering and search in outline
- [ ] Implement breadcrumb navigation
- [ ] Sync outline selection with cursor
- [ ] Add collapse/expand all

**Week 8: Advanced Editing**
- [ ] Multi-cursor support
- [ ] Smart code folding (by section type)
- [ ] Auto-completion for $refs
- [ ] Snippet support for common patterns
- [ ] Quick fix actions for common errors

### Phase 3: Preview System & Visualization (Weeks 9-12)

**Week 9: Preview Pane Foundation**
- [ ] Build PreviewPane container with tab system
- [ ] Implement keyboard shortcuts for tab switching (Ctrl+Shift+1-6)
- [ ] Create lazy loading for preview components
- [ ] Build Documentation View with endpoint cards
- [ ] Add method color coding and parameter display
- [ ] Implement click-to-navigate from preview to editor

**Week 10: Graph Visualization & Try It Out**
- [ ] Integrate D3.js force-directed graph
- [ ] Build schema relationship graph with $ref/allOf/oneOf edges
- [ ] Add interactive node selection and filtering (all/referenced/orphaned)
- [ ] Implement zoom/pan controls
- [ ] Build Try It Out playground
- [ ] Add request builder with parameter inputs
- [ ] Implement response display with status/timing
- [ ] Add request history

**Week 11: Code Snippets & Validation Report**
- [ ] Build Code Snippets view with language tabs
- [ ] Implement generators for curl, JavaScript, Python, Go, PHP, Ruby
- [ ] Add copy-to-clipboard functionality
- [ ] Create Validation Report view with grouped issues
- [ ] Add severity filtering and expand/collapse
- [ ] Implement click-to-navigate from issues
- [ ] Add report export (JSON format)

**Week 12: File System & Performance**
- [ ] File System Access API integration
- [ ] Directory opening and scanning
- [ ] Multi-file $ref resolution
- [ ] File watcher for external changes
- [ ] Performance profiling and optimization
- [ ] Large file testing (10k+ lines)
- [ ] Write unit tests (Vitest)

### Phase 4: Differentiation Features (Weeks 13-16)

**Week 13: Diff View & Breaking Change Detection**
- [ ] Implement spec comparison logic in DiffView
- [ ] Detect breaking vs non-breaking changes
- [ ] Build ChangeCard component with expand/collapse
- [ ] Add change categorization by path section
- [ ] Implement changelog export as Markdown
- [ ] Add file drop zone for comparison spec
- [ ] Version history with IndexedDB storage

**Week 14: Spectral Linting & AI Assistance**
- [ ] Integrate Spectral in worker
- [ ] Display lint warnings inline
- [ ] Add quick fixes for lint issues
- [ ] Custom ruleset configuration UI
- [ ] Schema generation from JSON samples
- [ ] Description suggestions via AI
- [ ] Error fix suggestions

**Week 15: Export, Integration & Polish**
- [ ] Export to multiple formats (YAML/JSON)
- [ ] Generate standalone HTML documentation
- [ ] Postman collection export
- [ ] OpenAPI 3.0 ↔ 3.1 conversion
- [ ] CLI for CI/CD integration
- [ ] E2E tests (Playwright) for all preview modes
- [ ] Accessibility audit and fixes

**Week 16: Launch Preparation**
- [ ] Landing page and documentation
- [ ] PWA configuration (offline support)
- [ ] Analytics integration (privacy-respecting)
- [ ] Feedback collection mechanism
- [ ] Preview mode documentation and tutorials
- [ ] Public launch

---

## 8. Testing Strategy

### 8.1 Unit Testing

```typescript
// src/__tests__/validation-pipeline.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ValidationPipeline } from '../services/validation-pipeline';

describe('ValidationPipeline', () => {
  it('should detect syntax errors immediately', async () => {
    const pipeline = new ValidationPipeline();
    const onProgress = vi.fn();
    
    const result = await pipeline.validate(
      'invalid: yaml: content:',
      'test-file',
      onProgress
    );
    
    expect(result.syntax.valid).toBe(false);
    expect(onProgress).toHaveBeenCalledWith('syntax', expect.any(Object));
  });

  it('should validate schema after syntax passes', async () => {
    const pipeline = new ValidationPipeline();
    const onProgress = vi.fn();
    
    const validYaml = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths: {}
`;
    
    const result = await pipeline.validate(validYaml, 'test-file', onProgress);
    
    expect(result.syntax.valid).toBe(true);
    expect(result.schema?.valid).toBe(true);
  });

  it('should cancel pending validation on new request', async () => {
    const pipeline = new ValidationPipeline();
    
    const firstValidation = pipeline.validate('content1', 'file1', () => {});
    const secondValidation = pipeline.validate('content2', 'file1', () => {});
    
    await expect(firstValidation).rejects.toThrow('Validation cancelled');
    await expect(secondValidation).resolves.toBeDefined();
  });
});
```

### 8.2 E2E Testing

```typescript
// e2e/editor.spec.ts
import { test, expect } from '@playwright/test';

test.describe('OpenAPI Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load and display editor', async ({ page }) => {
    await expect(page.locator('.cm-editor')).toBeVisible();
  });

  test('should show validation errors for invalid spec', async ({ page }) => {
    await page.locator('.cm-editor').fill('invalid yaml content');
    await page.waitForTimeout(500); // Wait for debounced validation
    
    await expect(page.locator('.validation-error')).toBeVisible();
  });

  test('should navigate to definition with F12', async ({ page }) => {
    const spec = `
openapi: 3.0.0
info:
  title: Test
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
components:
  schemas:
    User:
      type: object
`;
    
    await page.locator('.cm-editor').fill(spec);
    
    // Position cursor on $ref
    await page.keyboard.press('Control+g');
    await page.locator('input[placeholder*="line"]').fill('13');
    await page.keyboard.press('Enter');
    
    // Trigger go to definition
    await page.keyboard.press('F12');
    
    // Should jump to User schema
    const cursor = await page.evaluate(() => {
      const view = (window as any).__editorView;
      return view.state.selection.main.head;
    });
    
    expect(cursor).toBeGreaterThan(300); // Approximate position of User schema
  });

  test('should open command palette with Ctrl+Shift+P', async ({ page }) => {
    await page.keyboard.press('Control+Shift+p');
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();
  });
});
```

---

## 9. Deployment & Distribution

### 9.1 Build Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'OpenAPI Editor',
        short_name: 'OAS Editor',
        description: 'A fast, keyboard-driven OpenAPI specification editor',
        theme_color: '#1e1e1e',
        background_color: '#1e1e1e',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'codemirror': ['@codemirror/state', '@codemirror/view', '@codemirror/lang-yaml', '@codemirror/lang-json'],
          'validation': ['@apidevtools/swagger-parser', 'ajv'],
          'ui': ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
```

### 9.2 Deployment Targets

| Platform | Method | Notes |
|----------|--------|-------|
| GitHub Pages | GitHub Actions | Free, custom domain support |
| Netlify | Auto-deploy from repo | Edge functions for future features |
| Vercel | Auto-deploy from repo | Good analytics, edge support |
| Self-hosted | Docker container | For enterprise/privacy needs |
| npm package | Library distribution | Embed in other apps |

---

## 10. Success Metrics

### 10.1 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to Interactive | < 2s | Lighthouse |
| Syntax validation latency | < 50ms | Custom timing |
| Full validation latency | < 300ms | Custom timing |
| Keystroke latency (10k line file) | < 16ms | Chrome DevTools |
| Memory usage (10k line file) | < 100MB | Chrome DevTools |
| Bundle size (initial) | < 500KB gzipped | Build output |

### 10.2 User Experience Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Keyboard shortcut coverage | 100% of core features | Feature audit |
| Accessibility score | 100 (Lighthouse) | Lighthouse |
| Error message clarity | > 4/5 user rating | User surveys |
| Documentation completeness | 100% feature coverage | Doc audit |

---

## Appendix A: Keyboard Shortcut Reference

| Category | Shortcut | Action |
|----------|----------|--------|
| **File** | Ctrl+O | Open file |
| | Ctrl+S | Save file |
| | Ctrl+Shift+S | Save as |
| | Ctrl+W | Close file |
| **Edit** | Ctrl+Z | Undo |
| | Ctrl+Y | Redo |
| | Ctrl+D | Select next occurrence |
| | Ctrl+Shift+L | Select all occurrences |
| | Ctrl+/ | Toggle comment |
| | Ctrl+Shift+K | Delete line |
| | Alt+Up/Down | Move line up/down |
| | Ctrl+Shift+D | Duplicate line |
| **Navigation** | Ctrl+G | Go to line |
| | Ctrl+P | Quick open file |
| | Ctrl+Shift+O | Go to symbol |
| | F12 | Go to definition |
| | Alt+F12 | Peek definition |
| | Shift+F12 | Find all references |
| | Ctrl+Shift+\ | Go to matching bracket |
| | Alt+Left/Right | Navigate back/forward |
| **View** | Ctrl+Shift+P | Command palette |
| | Ctrl+\ | Toggle preview |
| | Ctrl+Shift+E | Toggle outline |
| | Ctrl+B | Toggle sidebar |
| | Ctrl+K Z | Zen mode |
| | Ctrl++ / Ctrl+- | Zoom in/out |
| **Folding** | Ctrl+Shift+[ | Fold region |
| | Ctrl+Shift+] | Unfold region |
| | Ctrl+K Ctrl+0 | Fold all |
| | Ctrl+K Ctrl+J | Unfold all |
| **OpenAPI** | Ctrl+Shift+N | New endpoint |
| | Ctrl+Shift+M | New schema |
| | Ctrl+. | Quick fix |
| | Ctrl+Space | Trigger autocomplete |

---

## Appendix B: Configuration Schema

```yaml
# .openapi-editor.yaml
version: 1

editor:
  theme: dark
  fontSize: 14
  fontFamily: "JetBrains Mono, Fira Code, monospace"
  tabSize: 2
  wordWrap: false
  minimap: true
  lineNumbers: true

validation:
  onType: true
  debounceMs: 300
  spectral:
    enabled: true
    ruleset: spectral:oas

preview:
  defaultMode: docs # docs | graph | tryit
  autoRefresh: true
  refreshDelayMs: 500

keybindings:
  preset: default # default | vim | emacs
  custom: []

files:
  autoSave: false
  autoSaveDelayMs: 1000
  watchExternal: true

ai:
  enabled: false
  provider: openai # openai | anthropic | local
  apiKey: ${OPENAI_API_KEY}
```

---

*Document Version: 1.0*  
*Last Updated: December 2024*
