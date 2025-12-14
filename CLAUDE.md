# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Specable is a local-first OpenAPI editor for power users, built with React 19, TypeScript, Vite 7, and Tailwind CSS 4. It aims to provide sub-100ms validation, keyboard-first workflows, and intelligent navigation for large API specifications.

## Development Commands

```bash
pnpm dev          # Start development server
pnpm build        # Type-check and build for production
pnpm lint         # Run ESLint
pnpm preview      # Preview production build
pnpm test         # Run tests in watch mode
pnpm test:run     # Run tests once
pnpm test:coverage # Run tests with coverage report

# Run a single test file
pnpm test src/utils/source-map.test.ts

# Run tests matching a pattern
pnpm test -t "source map"
```

## Architecture

### State Management
- **Zustand store** (`src/store/index.ts`): Single store managing file state, parsed spec, validation results, and UI state (panel visibility, editor reference)
- State is persisted to localStorage for panel preferences and current file

### Validation Pipeline
- **Web Workers** offload validation from the main thread:
  - `validator.worker.ts`: YAML/JSON parsing, OpenAPI schema validation (swagger-parser)
  - `linter.worker.ts`: Spectral linting for best practices
- **ValidationPipeline** (`src/services/validation-pipeline.ts`): Coordinates workers with debouncing (300ms) and cancellation
- Workers communicate via Comlink for typed RPC
- **Data flow**: Content change → `useValidation` hook → debounced `ValidationPipeline.validate()` → worker → store update
- **Limitation**: OpenAPI 3.1.x specs only get syntax validation (swagger-parser doesn't support 3.1 schema validation)

### Editor
- **CodeMirror 6** (`src/components/Editor/`):
  - `extensions.ts`: Language modes (YAML/JSON), syntax highlighting, folding, autocomplete
  - `theme.ts`: Custom dark theme
  - `ref-navigation.ts`: `$ref` click-to-navigate and F12 go-to-definition

### Layout
- **Three-panel layout** (`src/components/Layout/MainLayout.tsx`):
  - Left: OutlineView (hierarchical spec navigation)
  - Centre: CodeMirror editor
  - Right: DocumentationView (rendered preview)
- Resizable panels with drag handles
- StatusBar shows validation status and diagnostics count

### Command Palette
- `Ctrl+Shift+P` to open
- Fuzzy search via Fuse.js
- Commands for navigation, editing, view toggles, and file operations

### File System
- Uses File System Access API for native file open/save (`src/services/file-system.ts`)
- `useFileSystem` hook wraps operations and updates store

## Key Patterns

- **React Compiler** is enabled (babel-plugin-react-compiler) for automatic memoisation
- **Source maps** track YAML/JSON positions back to original content for accurate error locations
- **Node polyfills** (vite-plugin-node-polyfills) allow swagger-parser to run in browser

## Testing

- **Vitest** with jsdom environment and React Testing Library
- Test files: `src/**/*.test.{ts,tsx}`
- Setup file (`src/test/setup.ts`) mocks `matchMedia`, `ResizeObserver`, and `scrollIntoView` for jsdom compatibility
- Worker tests may require mocking Comlink or testing worker logic in isolation
