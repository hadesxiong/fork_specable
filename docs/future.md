# OpenAPI Editor: Future Phases

This document outlines features planned for post-launch development.

---

## Implemented Features

The following features from the original roadmap have been implemented:

### Graph View ✓
Interactive force-directed graph showing schema relationships.
- PixiJS + d3-force layout with zoom/pan
- Node types: schemas with property previews
- Edge types: `$ref`, `allOf`, `anyOf`, `oneOf`, `items`
- Filtering: all / referenced / orphaned
- Click node to navigate to source
- Graph computation in dedicated worker

### Try It Out ✓
Send requests to API endpoints directly from the editor.
- Server selector (from spec's `servers` array)
- Auto-populated parameter inputs from operation definition
- Request body editor
- Authentication: Bearer, API Key, Basic
- Response display with status, headers, body, and timing
- CORS limitation noted in UI

### Diff View ✓
Compare current spec against another version with breaking change detection.
- Load comparison file via file picker
- Categorise changes: added, removed, modified
- Breaking change detection and flagging
- Filter: all / breaking / non-breaking
- Click to navigate to source in either spec
- Diff computation in dedicated worker

---

## Phase 2: Code Generation

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

---

## Phase 3: Version Control Integration

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
- Initial implementation: read-only status display; writes via external Git client

---

## Phase 4: Multi-File Support

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

## Phase 5: AI Assistance

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

## Phase 6: Ecosystem Integration

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

## Phase 7: Collaboration

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

## Phase 8: Enterprise Features

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

| Phase | Features | User Value | Complexity | Status |
|-------|----------|------------|------------|--------|
| — | Graph View | High | Medium | ✓ Done |
| — | Try It Out | High | Medium | ✓ Done |
| — | Diff View | High | Medium | ✓ Done |
| 2 | Code Snippets | High | Low | Planned |
| 3 | Version History, Git | Medium | Medium | Planned |
| 4 | Multi-File, Bundling | Medium | High | Planned |
| 5 | AI Assistance | Medium | Medium | Planned |
| 6 | CLI, Exports, VS Code | High | High | Planned |
| 7 | Collaboration | Low | Very High | Planned |
| 8 | Enterprise Features | Low | Medium | Planned |

**Recommended order**: 2 (Code Snippets) → 3 (Version History) → 6 (CLI) → 4 (Multi-File) → 5 (AI) → 6 (VS Code) → 8 → 7

---

## Technical Considerations

Items to address as features are added:

1. **Worker pool complexity** — Single workers are sufficient; add pooling only if profiling shows benefit
2. **OpenAPI 3.1 support** — swagger-parser limitation means 3.1 specs only get syntax validation
3. **Source map accuracy** — Edge cases with multi-line strings, anchors, aliases may need refinement
4. **Type duplication** — Graph and diff types exist in both `src/workers/types.ts` and `src/store/index.ts`
5. **IndexedDB migration** — Plan schema versioning before adding version history feature
