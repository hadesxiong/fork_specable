# OpenAPI Editor: MVP Implementation Plan

## Scope

The MVP delivers a fast, keyboard-driven OpenAPI editor targeting individual developers. It includes:

- **CodeMirror 6 editor** with YAML/JSON support
- **Tiered validation pipeline** (syntax → schema → lint) via Web Workers
- **Documentation preview** with endpoint cards and schema display
- **Outline view** with filtering and navigation
- **Command palette** and keyboard shortcuts
- **$ref navigation** (go-to-definition, find references)
- **File System Access API** with fallback

Excluded from MVP: Graph visualisation, Try It Out playground, Diff view, Code Snippets, AI assistance, CLI, multi-file workspaces.

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
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  Parser Worker   │  │ Validator Worker │  │  Linter Worker   │   │
│  │  (Lezer YAML)    │  │ (swagger-parser) │  │   (Spectral)     │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Editor Core | CodeMirror 6 | Viewport-only rendering, ~150KB bundle, excellent extensibility |
| UI Framework | React 19 | Concurrent rendering, Suspense for code splitting |
| State Management | Zustand | Minimal boilerplate, built-in persistence (localStorage only for MVP) |
| Worker Communication | Comlink | Type-safe RPC, transparent async |
| Parsing | Lezer (YAML grammar) | Incremental parsing, error recovery |
| Validation | Ajv + @apidevtools/swagger-parser | Fast JSON Schema, comprehensive OpenAPI validation |
| Linting | Spectral | Industry standard, extensible rulesets |
| Styling | Tailwind CSS | Utility-first, tree-shakeable |
| Build | Vite | Fast HMR, native ES modules |
| Testing | Vitest + Playwright | Unit and E2E coverage |

---

## Implementation Breakdown

### Phase 1: Project Foundation

**Project Setup**
- Initialise Vite + React 19 + TypeScript project
- Configure Tailwind CSS with dark theme tokens
- Set up ESLint, Prettier, Husky pre-commit hooks
- Create directory structure:
  ```
  src/
  ├── components/
  │   ├── Editor/
  │   ├── Preview/
  │   ├── Outline/
  │   ├── CommandPalette/
  │   └── common/
  ├── workers/
  ├── services/
  ├── store/
  ├── hooks/
  └── utils/
  ```

**CodeMirror Integration**
- Install and configure CodeMirror 6 with extensions:
  - `@codemirror/lang-yaml`
  - `@codemirror/lang-json`
  - `@codemirror/language` (folding)
  - `@codemirror/search`
  - `@codemirror/lint`
- Implement language auto-detection (YAML vs JSON)
- Add line numbers, active line highlight, selection matches
- Configure fold gutter with semantic folding markers
- Create custom keymap for OpenAPI-specific shortcuts

**State Management**
- Create Zustand store with slices:
  - `fileSlice`: active file content, dirty state, file metadata
  - `validationSlice`: errors, warnings, validation status
  - `uiSlice`: panel visibility, theme preference
- Implement localStorage persistence for UI preferences only
- Note: Do not persist `EditorView` or `Map` objects

---

### Phase 2: Validation Pipeline

**Worker Infrastructure**
- Set up Comlink for type-safe worker communication
- Create single validation worker (not a pool for MVP)
- Implement message batching to reduce overhead

**Validation Worker**
- Integrate `@apidevtools/swagger-parser` for OpenAPI validation
- Implement content hashing for cache invalidation
- Add LRU cache (max 10 entries) for validation results
- Return structured errors with line/column positions

**Linter Worker**
- Integrate Spectral with default OAS ruleset
- Map Spectral severity levels to editor diagnostics
- Return diagnostics with JSON path for navigation

**Pipeline Orchestration**
- Implement tiered validation:
  1. Syntax check (immediate, <50ms) - native YAML/JSON parse
  2. Schema validation (debounced 300ms) - swagger-parser
  3. Linting (debounced 500ms) - Spectral
- Add `AbortController` for cancellation on new edits
- Create progress callback for incremental UI updates

**Editor Integration**
- Display errors/warnings in gutter via `@codemirror/lint`
- Show inline diagnostics on hover
- Add status bar indicator: "Validating..." / "Valid" / "3 errors, 2 warnings"

---

### Phase 3: Navigation & Commands

**Source Map Builder**
- Parse YAML/JSON to build path-to-position mapping
- Store in a plain object (not `Map`) for serialisation safety
- Run in validation worker, return alongside validation results
- Handle edge cases: multi-line strings, anchors, aliases

**$ref Resolution**
- Implement `resolveRef(ref: string): { line, column } | null`
- Build reference graph: which paths reference which targets
- Handle circular references gracefully

**Go-to-Definition (F12)**
- Detect $ref under cursor using CodeMirror syntax tree
- Look up target position in source map
- Scroll to target line, centre in viewport, flash highlight

**Find All References (Shift+F12)**
- Search reference graph for all paths pointing to current location
- Display results in a dropdown or bottom panel
- Click to navigate

**Command Palette**
- Build palette component with fuzzy search (using `fuse.js`)
- Register commands with metadata: id, label, shortcut, category, action
- Categories: Navigation, Edit, View, OpenAPI
- Keyboard navigation: arrow keys, Enter to execute, Escape to close
- Trigger with `Ctrl+Shift+P`

**Core Commands**
- Go to Line (`Ctrl+G`)
- Go to Symbol (`Ctrl+Shift+O`) - list paths, operations, schemas
- Toggle Preview (`Ctrl+\`)
- Toggle Outline (`Ctrl+Shift+E`)
- Fold All / Unfold All (`Ctrl+K Ctrl+0` / `Ctrl+K Ctrl+J`)

---

### Phase 4: UI Components

**Layout**
- Three-column resizable layout: Outline | Editor | Preview
- Collapsible panels with keyboard toggles
- Persistent splitter positions in localStorage

**Outline View**
- Tree structure: Paths → Operations, Schemas, Security Schemes
- Method badges with colour coding (GET=green, POST=blue, etc.)
- Filter input with fuzzy matching
- Click to navigate; sync selection with cursor position
- Expand/collapse with chevron icons

**Documentation Preview**
- Render parsed spec as API documentation
- Components:
  - API info header (title, version, description)
  - Server selector (if multiple servers defined)
  - Endpoint cards grouped by path
  - Operation details: method badge, summary, description
  - Parameters table with type, required indicator
  - Response codes with schema preview
  - Schema definitions with property list
- Click endpoint/schema to navigate to source
- Debounce preview updates (500ms after validation completes)

**Status Bar**
- Left: File name, dirty indicator, cursor position (Ln X, Col Y)
- Centre: Validation status with error/warning counts
- Right: Language mode (YAML/JSON), OpenAPI version

---

### Phase 5: File System

**File System Access API**
- Implement `openFile()` with file picker
- Implement `saveFile()` with write access
- Store file handles for re-saving without picker
- Detect external changes via polling (1s interval)

**Fallback for Unsupported Browsers**
- `<input type="file">` for opening
- Blob download for saving
- Display browser compatibility notice

**File State**
- Track dirty state (content differs from last save)
- Warn on close/navigate away if unsaved changes
- Show asterisk in tab/title for dirty files

---

### Phase 6: Polish & Testing

**Performance**
- Profile with Chrome DevTools on 5,000+ line spec
- Target metrics:
  - Keystroke latency: <16ms
  - Syntax validation: <50ms
  - Full validation: <300ms
  - Memory usage: <100MB
- Optimise if needed: reduce re-renders, batch state updates

**Accessibility**
- Keyboard navigation for all interactive elements
- ARIA labels for buttons, panels, tree items
- Focus management for modals (command palette, dialogs)
- Sufficient colour contrast (WCAG AA)

**Testing**
- Unit tests (Vitest):
  - Validation pipeline logic
  - Source map builder
  - $ref resolver
  - Command registration
- E2E tests (Playwright):
  - Load file, edit, save
  - Validation error display
  - Go-to-definition navigation
  - Command palette interaction
  - Outline navigation

**Error Handling**
- Graceful degradation if worker fails to load
- User-friendly messages for parse errors
- Recovery from corrupted localStorage state

---

## File Structure

```
src/
├── components/
│   ├── Editor/
│   │   ├── Editor.tsx           # Main CodeMirror wrapper
│   │   ├── extensions/          # Custom CM extensions
│   │   └── keymaps.ts           # Keyboard shortcuts
│   ├── Preview/
│   │   ├── PreviewPane.tsx      # Container
│   │   └── DocumentationView.tsx
│   ├── Outline/
│   │   └── OutlineView.tsx
│   ├── CommandPalette/
│   │   └── CommandPalette.tsx
│   ├── Layout/
│   │   ├── MainLayout.tsx
│   │   ├── StatusBar.tsx
│   │   └── ResizablePanels.tsx
│   └── common/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Modal.tsx
├── workers/
│   ├── validator.worker.ts
│   ├── linter.worker.ts
│   └── types.ts
├── services/
│   ├── validation-pipeline.ts
│   ├── ref-resolver.ts
│   ├── source-map.ts
│   └── file-system.ts
├── store/
│   ├── index.ts
│   ├── fileSlice.ts
│   ├── validationSlice.ts
│   └── uiSlice.ts
├── hooks/
│   ├── useValidation.ts
│   ├── useCommands.ts
│   └── useFileSystem.ts
├── utils/
│   ├── yaml.ts
│   ├── json-path.ts
│   └── debounce.ts
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

## Out of Scope for MVP

See [future.md](./future.md) for planned features:
- Graph visualisation of schema relationships
- Try It Out API playground
- Diff view with breaking change detection
- Code snippet generation
- AI-assisted editing
- Multi-file workspace support
- CLI for CI/CD
- IndexedDB persistence and version history
