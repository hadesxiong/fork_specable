# OpenAPI Editor: Implementation Summary

## What Was Built

Specable delivers a fast, keyboard-driven OpenAPI editor targeting individual developers. The implementation includes:

**Core Editor**
- CodeMirror 6 editor with YAML/JSON support
- Tiered validation pipeline (syntax → schema → lint) via Web Workers
- Documentation preview with endpoint cards and schema display
- Outline view with filtering and navigation
- Command palette and keyboard shortcuts
- `$ref` navigation (go-to-definition, Ctrl+Click)
- File System Access API with fallback

**Beyond Original MVP Scope**
- Graph visualisation of schema relationships (PixiJS + d3-force)
- Try It Out playground for API testing
- Diff view with breaking change detection

**Not Yet Implemented**: Code snippets, AI assistance, CLI, multi-file workspaces, version history.

---

## Architecture

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
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    Comlink (RPC Bridge)
                              │
┌─────────────────────────────┴───────────────────────────────────────┐
│                         Web Workers                                  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │   Validator    │  │    Linter      │  │     Graph      │         │
│  │ (swagger-parser│  │  (Spectral)    │  │  (d3-force)    │         │
│  │    + js-yaml)  │  │                │  │                │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
│  ┌────────────────┐                                                  │
│  │      Diff      │                                                  │
│  │  (deep-diff)   │                                                  │
│  └────────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Editor Core | CodeMirror 6 | Viewport-only rendering, ~150KB bundle, excellent extensibility |
| UI Framework | React 19 | Concurrent rendering, React Compiler for automatic memoisation |
| State Management | Zustand | Minimal boilerplate, built-in persistence (localStorage) |
| Worker Communication | Comlink | Type-safe RPC, transparent async |
| Parsing | js-yaml | YAML parsing in validator worker |
| Validation | @apidevtools/swagger-parser | Comprehensive OpenAPI validation |
| Linting | Spectral | Industry standard, extensible rulesets |
| Graph Layout | d3-force + PixiJS | Force-directed layout with WebGL rendering |
| Diff | deep-diff | Structural comparison for breaking change detection |
| Styling | Tailwind CSS 4 | Utility-first, tree-shakeable |
| Build | Vite 7 | Fast HMR, native ES modules |
| Testing | Vitest | Unit tests with React Testing Library |

---

## Implementation Details

### Project Foundation

**Project Setup**
- Vite 7 + React 19 + TypeScript
- Tailwind CSS 4 with dark theme tokens
- ESLint with React Compiler plugin
- React Compiler (babel-plugin-react-compiler) for automatic memoisation

**CodeMirror Integration** (`src/components/Editor/`)
- Extensions: `@codemirror/lang-yaml`, `@codemirror/lang-json`, folding, search, lint
- Language auto-detection (YAML vs JSON based on file extension and content)
- Custom theme (`theme.ts`) with purple accent colours
- `$ref` navigation via `ref-navigation.ts` (F12, Ctrl+Click)
- Diagnostics integration (`diagnostics.ts`)

**State Management** (`src/store/index.ts`)
- Single Zustand store (not split into slices)
- State includes: file, parsedSpec, sourceMap, validation, UI, graph, diff, tryIt
- localStorage persistence for UI preferences and current file
- Note: `EditorView` reference stored but not persisted

### Validation Pipeline

**Workers** (`src/workers/`)
- `validator.worker.ts`: YAML/JSON parsing via js-yaml, OpenAPI validation via swagger-parser
- `linter.worker.ts`: Spectral with default OAS ruleset
- `graph.worker.ts`: Builds schema relationship graph from parsed spec
- `diff.worker.ts`: Computes API differences using deep-diff with breaking change detection
- Worker types defined in `types.ts`

**Pipeline Orchestration** (`src/services/validation-pipeline.ts`)
- `ValidationPipeline` singleton coordinates validator and linter workers
- Debounced validation (300ms) with `AbortController` for cancellation
- Source map built during validation for accurate error positions
- Limitation: OpenAPI 3.1.x specs only get syntax validation (swagger-parser limitation)

**Editor Integration**
- Errors/warnings displayed in gutter via `@codemirror/lint`
- Inline diagnostics on hover
- Status bar shows validation status and counts

### Navigation & Commands

**Source Map** (`src/utils/source-map.ts`)
- Builds JSON path to line/column mapping during YAML/JSON parsing
- Plain object structure (not `Map`) for serialisation safety
- Handles nested structures, arrays, and special characters

**$ref Navigation** (`src/components/Editor/ref-navigation.ts`)
- F12 / Ctrl+Click: Navigate to `$ref` target
- Detects reference under cursor, resolves via source map
- Scrolls to target with brief highlight animation

**Command Palette** (`src/components/CommandPalette/`)
- Fuzzy search via Fuse.js
- Commands registered with id, label, shortcut, category, action
- Categories: Navigation, Edit, View
- Keyboard: `Ctrl+Shift+P` to open, arrows to navigate, Enter to execute

### UI Components

**Layout** (`src/components/Layout/`)
- Three-panel resizable layout: Outline | Editor | Right Panel
- Right panel switchable: Preview, Graph, Diff, Try It Out
- Collapsible panels with keyboard toggles
- `StatusBar.tsx`: File info, validation status, cursor position

**Outline View** (`src/components/Outline/OutlineView.tsx`)
- Hierarchical tree: Info, Paths → Operations, Components → Schemas
- Method badges with HTTP verb colours
- Filter input for fuzzy search
- Click to navigate to source

**Documentation Preview** (`src/components/Preview/`)
- `DocumentationView.tsx`: Rendered API documentation
- API info header, server list, endpoint cards
- Schema viewer with property tables
- Click to navigate to source

**Graph View** (`src/components/GraphView/`)
- Interactive force-directed graph (PixiJS + d3-force)
- Nodes: schemas (with property previews)
- Edges: `$ref`, `allOf`, `anyOf`, `oneOf`, `items`
- Filtering: all / referenced / orphaned schemas
- Click node to navigate to source

**Diff View** (`src/components/DiffView/`)
- Load comparison spec via file picker
- Breaking change detection with categorisation
- Filtering: all / breaking / non-breaking
- Click to navigate to source in either spec

**Try It Out** (`src/components/TryItOut/`)
- Send requests to API endpoints from the editor
- Server selector, parameter inputs, request body editor
- Authentication: Bearer, API Key, Basic
- Response display with timing

### File System

**File System Access API** (`src/services/file-system.ts`)
- Native file open/save via `showOpenFilePicker` / `showSaveFilePicker`
- File handle stored for re-saving without picker
- Fallback: `<input type="file">` for open, Blob download for save

**File State**
- Dirty state tracking (asterisk in title)
- `beforeunload` warning for unsaved changes

---

## File Structure

```
src/
├── components/
│   ├── CommandPalette/
│   │   ├── CommandPalette.tsx
│   │   ├── useCommandPalette.ts
│   │   └── index.ts
│   ├── DiffView/
│   │   ├── DiffView.tsx
│   │   ├── DiffList.tsx
│   │   ├── DiffSummary.tsx
│   │   ├── DiffToolbar.tsx
│   │   └── index.ts
│   ├── Editor/
│   │   ├── Editor.tsx
│   │   ├── extensions.ts
│   │   ├── theme.ts
│   │   ├── diagnostics.ts
│   │   ├── ref-navigation.ts
│   │   └── index.ts
│   ├── GraphView/
│   │   ├── GraphView.tsx
│   │   ├── GraphCanvas.tsx
│   │   ├── GraphLegend.tsx
│   │   ├── GraphToolbar.tsx
│   │   └── index.ts
│   ├── Layout/
│   │   ├── MainLayout.tsx
│   │   ├── StatusBar.tsx
│   │   ├── DiagnosticsPanel.tsx
│   │   ├── AboutModal.tsx
│   │   ├── KeyboardShortcutsModal.tsx
│   │   └── index.ts
│   ├── Outline/
│   │   ├── OutlineView.tsx
│   │   └── index.ts
│   ├── Preview/
│   │   ├── DocumentationView.tsx
│   │   ├── components.tsx
│   │   ├── schema-utils.ts
│   │   ├── Markdown.tsx
│   │   └── index.ts
│   └── TryItOut/
│       ├── TryItOutView.tsx
│       ├── OperationSelector.tsx
│       ├── ServerSelector.tsx
│       ├── AuthConfig.tsx
│       ├── ParameterForm.tsx
│       ├── RequestBodyEditor.tsx
│       ├── ResponseDisplay.tsx
│       ├── request-execution.ts
│       └── index.ts
├── hooks/
│   ├── useFileSystem.ts
│   └── useValidation.ts
├── services/
│   ├── validation-pipeline.ts
│   ├── diff-engine.ts
│   ├── graph-builder.ts
│   └── file-system.ts
├── store/
│   └── index.ts              # Single Zustand store
├── test/
│   └── setup.ts
├── types/
│   ├── file-system-access.d.ts
│   └── fonts.d.ts
├── utils/
│   ├── format.ts
│   └── source-map.ts
├── workers/
│   ├── validator.worker.ts
│   ├── linter.worker.ts
│   ├── graph.worker.ts
│   ├── diff.worker.ts
│   └── types.ts
├── App.tsx
├── main.tsx
└── index.css
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Time to Interactive | < 2s |
| Syntax validation latency | < 50ms |
| Full validation latency | < 300ms |
| Keystroke latency (5k line file) | < 16ms |
| Bundle size (gzipped) | < 400KB |
| Lighthouse Accessibility | 100 |

---

## Not Yet Implemented

See [future.md](./future.md) for planned features:
- Code snippet generation
- AI-assisted editing
- Multi-file workspace support
- CLI for CI/CD
- IndexedDB persistence and version history
- VS Code extension
- Real-time collaboration
