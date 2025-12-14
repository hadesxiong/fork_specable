# OpenAPI Editor: Future Phases

This document outlines features excluded from the MVP, organised into logical phases for post-launch development.

---

## Phase 2: Enhanced Visualisation

### Graph View
Interactive force-directed graph showing schema relationships.

**Features**
- D3.js force-directed layout with zoom/pan
- Node types: schemas, endpoints (optional toggle)
- Edge types: $ref (solid), allOf (dashed), oneOf/anyOf (dotted), items (arrow)
- Colour coding: referenced schemas (blue), orphaned schemas (grey)
- Filtering: all / referenced only / orphaned only
- Click node to navigate to source
- Hover to highlight connected nodes and edges

**Technical Considerations**
- Move graph computation to a worker for specs with 100+ schemas
- Debounce graph rebuild on spec changes (500ms)
- Use incremental simulation updates rather than full restart on filter change
- Consider WebGL renderer (e.g., `@pixi/graphics`) for very large graphs

**Keyboard Shortcut**: `Ctrl+Shift+2`

---

### Minimap Enhancements
Visual overview of document structure in the scrollbar area.

**Features**
- Colour-coded sections: paths (blue), schemas (green), info (grey), security (red)
- Error/warning markers visible at document scale
- Click to navigate
- Region markers from `# region` comments

---

## Phase 3: Interactive Testing

### Try It Out Playground
Send requests to API endpoints directly from the editor.

**Features**
- Server selector (from spec's `servers` array)
- Auto-populated parameter inputs from operation definition
- Request body editor with schema-based validation
- Authentication header configuration (Bearer, API Key, Basic)
- Response display: status, headers, body (formatted JSON)
- Response time measurement
- Request history (last 20 requests per session)

**Technical Considerations**
- CORS: requests must go through a proxy or the API must allow browser origins
- Consider optional backend proxy service for users who need it
- Store auth tokens securely (sessionStorage, not localStorage)

**Keyboard Shortcut**: `Ctrl+Shift+3`

---

### Code Snippet Generation
Generate client code for the active endpoint.

**Supported Languages**
- cURL
- JavaScript (fetch)
- Python (requests)
- Go (net/http)
- PHP (cURL)
- Ruby (net/http)

**Features**
- Language tabs with syntax highlighting
- Copy to clipboard button
- Auto-include example request body from spec
- Configurable: include/exclude headers, auth placeholder

**Keyboard Shortcut**: `Ctrl+Shift+5`

---

## Phase 4: Version Control Integration

### Diff View
Compare current spec against a previous version with breaking change detection.

**Features**
- Load comparison file via file picker or drag-and-drop
- Categorise changes: added, removed, modified
- Flag breaking changes:
  - Removed endpoint
  - Removed operation
  - New required parameter
  - Removed success response (2xx)
  - Changed parameter type (narrowing)
  - Removed schema property
- Filter: all / breaking only / non-breaking only
- Click change to navigate to source
- Export changelog as Markdown

**Breaking Change Detection Logic**
```
Breaking:
- DELETE paths.{path}
- DELETE paths.{path}.{method}
- ADD paths.{path}.{method}.parameters.{name} WHERE required=true
- DELETE paths.{path}.{method}.responses.2xx
- DELETE components.schemas.{name} WHERE referenced
- MODIFY parameter.type (string → integer, etc.)

Non-breaking:
- ADD paths.{path}
- ADD paths.{path}.{method}
- ADD paths.{path}.{method}.parameters.{name} WHERE required=false
- ADD components.schemas.{name}
- MODIFY description, summary, examples
```

**Keyboard Shortcut**: `Ctrl+Shift+4`

---

### Version History
Track specification changes over time using IndexedDB.

**Features**
- Auto-save snapshots on significant changes (debounced)
- Manual save points with labels
- Timeline view of versions
- Restore previous version
- Compare any two versions

**Storage**
- IndexedDB with `idb` wrapper
- Schema: `{ id, fileId, timestamp, label?, content, hash }`
- Retain last 50 versions per file
- Prune on storage pressure

---

### Git Integration
Direct integration with Git repositories.

**Features**
- Detect if file is in a Git repository (via File System Access API directory scan)
- Show Git status: modified, staged, committed
- View diff against HEAD
- Commit changes with message (requires user permission)
- Branch indicator in status bar

**Limitations**
- Full Git operations require a backend or CLI bridge
- MVP: read-only status display; writes via external Git client

---

## Phase 5: Multi-File Support

### Workspace Mode
Open a directory containing multiple OpenAPI files with $ref resolution across files.

**Features**
- File explorer sidebar with tree view
- Detect OpenAPI files (`.yaml`, `.yml`, `.json` with `openapi` key)
- Resolve external $refs: `$ref: './schemas/user.yaml#/User'`
- Cross-file go-to-definition
- Cross-file find references
- Workspace-wide symbol search

**Technical Considerations**
- File watcher for external changes (polling-based)
- Lazy loading: parse files on demand, not all at once
- Shared validation context across files

---

### Bundling
Combine multi-file specs into a single output file.

**Features**
- Bundle to single YAML or JSON
- Inline all external $refs
- Preserve or flatten component structure (user choice)
- Output path configuration

---

## Phase 6: AI Assistance

### Schema Generation from JSON
Paste a JSON sample, generate OpenAPI schema.

**Features**
- Paste JSON in modal or dedicated panel
- Infer types, required properties, formats (date-time, email, uri)
- Handle arrays: infer item schema from first element
- Insert generated schema at cursor or in components/schemas

**Implementation**
- Can be done client-side with heuristics
- Optional: use LLM for better type inference and descriptions

---

### Description Generation
AI-generated descriptions for endpoints, parameters, schemas.

**Features**
- Right-click → "Generate description"
- Use operation name, parameter name, schema structure as context
- Preview and edit before inserting
- Configurable tone: technical, friendly, formal

**Implementation**
- Requires API key configuration (OpenAI, Anthropic, or local model)
- Store key in secure storage (not localStorage)
- Rate limiting and cost display

---

### Error Fix Suggestions
AI-suggested fixes for validation errors.

**Features**
- "Fix with AI" button on error diagnostics
- Suggest corrected YAML/JSON
- Preview diff before applying
- Learn from accepted fixes (optional)

---

## Phase 7: Ecosystem Integration

### CLI Tool
Command-line interface for CI/CD integration.

**Commands**
```bash
specable validate openapi.yaml        # Validate and exit with code
specable lint openapi.yaml            # Run Spectral linting
specable bundle src/ -o dist/api.yaml # Bundle multi-file spec
specable diff old.yaml new.yaml       # Show breaking changes
specable export html openapi.yaml     # Generate static docs
```

**Distribution**
- npm package: `npm install -g specable`
- Standalone binaries via pkg or Bun

---

### Export Formats

**Static HTML Documentation**
- Self-contained HTML file with embedded CSS/JS
- Similar to Redoc standalone
- Customisable theme and logo

**Postman Collection**
- Convert OpenAPI to Postman Collection v2.1
- Preserve examples, auth configuration

**OpenAPI Version Conversion**
- 3.0 ↔ 3.1 conversion
- Warn on incompatible features

---

### VS Code Extension
First-class VS Code integration.

**Features**
- Syntax highlighting and validation (via LSP)
- Go-to-definition, find references
- Hover documentation
- Outline view in Explorer sidebar
- Preview panel as webview

**Implementation**
- Language Server Protocol (LSP) for validation/navigation
- Reuse core logic from web editor
- Webview for preview (embedded web editor)

---

## Phase 8: Collaboration

### Comments and Annotations
Add comments to specific locations in the spec.

**Features**
- Comment thread anchored to JSON path
- Markdown support in comments
- Resolve/unresolve threads
- Export comments as review document

**Storage**
- Separate from spec file (sidecar JSON or IndexedDB)
- Optional: sync via backend for team sharing

---

### Real-time Collaboration
Multiple users editing simultaneously.

**Features**
- Cursor presence (show other users' cursors)
- Conflict-free editing (CRDT-based)
- User avatars and names

**Technical Considerations**
- Requires backend infrastructure (WebSocket server, CRDT sync)
- Consider Yjs or Automerge for CRDT
- Significant complexity; consider as paid feature

---

## Phase 9: Enterprise Features

### Custom Rulesets
User-defined Spectral rulesets.

**Features**
- Upload custom ruleset file
- Edit ruleset in-app
- Enable/disable individual rules
- Share rulesets via URL

---

### Theming
Customisable editor appearance.

**Features**
- Light/dark/system theme toggle
- Custom syntax highlighting colours
- Font family and size configuration
- Export/import theme settings

---

### Audit Logging
Track all changes for compliance.

**Features**
- Log: timestamp, user, action, before/after
- Export audit log as JSON/CSV
- Retention policy configuration

---

## Priority Matrix

| Phase | Features | User Value | Complexity |
|-------|----------|------------|------------|
| 2 | Graph View, Minimap | High | Medium |
| 3 | Try It Out, Code Snippets | High | Medium |
| 4 | Diff View, Version History | High | Medium |
| 5 | Multi-File, Bundling | Medium | High |
| 6 | AI Assistance | Medium | Medium |
| 7 | CLI, Exports, VS Code | High | High |
| 8 | Comments, Real-time Collab | Low | Very High |
| 9 | Enterprise Features | Low | Medium |

**Recommended order**: 2 → 3 → 4 → 7 (CLI) → 5 → 6 → 7 (VS Code) → 9 → 8

---

## Technical Debt to Address

Before expanding scope, address issues identified in the original implementation plan:

1. **Worker pool complexity** - Start with single workers; add pooling only if profiling shows benefit
2. **Source map as plain object** - Avoid `Map` in serialised state
3. **Cache eviction** - Implement LRU with max size for all caches
4. **Path regex fragility** - Handle paths with dots, special characters
5. **Consistent line numbering** - Standardise on 1-indexed throughout
6. **Missing `useMemo` dependencies** - Audit all hooks for correctness
7. **Duplicated utilities** - Extract `generateExample`, path parsing to shared modules
