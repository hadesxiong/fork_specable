# Specable

A fast, local-first OpenAPI editor for power users. Built for keyboard-first workflows, sub-100ms validation, and intelligent navigation of large API specifications.

## Features

- **Fast Validation** - Real-time OpenAPI validation with debounced updates
- **Spectral Linting** - Best practice rules powered by Stoplight Spectral
- **Keyboard-First** - Command palette (`Ctrl+Shift+P`), go-to-definition (`F12`), and extensive shortcuts
- **Schema Graph** - Interactive visualisation of schema relationships using PixiJS and d3-force
- **API Documentation** - Live rendered preview of your API documentation
- **Diff View** - Compare specs with breaking change detection
- **Try It Out** - Execute API requests against servers defined in your spec
- **Version History** - Automatic snapshots with content deduplication
- **Local-First** - Works entirely in the browser with File System Access API

## Getting Started

### Using the Hosted Version

Visit [specable.dev](https://specable.dev) to use Specable directly in your browser.

### Running Locally

```bash
# Clone the repository
git clone https://github.com/tiaanduplessis/specable.git
cd specable

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Development

```bash
pnpm dev          # Start development server
pnpm build        # Type-check and build for production
pnpm lint         # Run ESLint
pnpm test         # Run tests in watch mode
pnpm test:run     # Run tests once
pnpm test:coverage # Run tests with coverage
```

## Architecture

Specable is built with:

- **React 19** with React Compiler for automatic memoisation
- **TypeScript** for type safety
- **Vite 7** for fast builds and HMR
- **Tailwind CSS 4** for styling
- **CodeMirror 6** for the editor
- **Zustand** for state management
- **Web Workers** for offloading heavy processing (validation, linting, graph building, diffing)

All validation and linting runs in Web Workers to keep the UI responsive. The validation pipeline uses debouncing and cancellation to handle rapid content changes efficiently.

### Supported Specifications

- OpenAPI 3.0.x (full validation)
- OpenAPI 3.1.x (syntax validation only - swagger-parser limitation)
- Swagger 2.0 (full validation)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Open command palette |
| `F12` | Go to definition |
| `Ctrl+Click` | Navigate to `$ref` target |
| `Ctrl+S` | Save file |
| `Ctrl+O` | Open file |

## Contributing

Contributions are welcome. Please read the [contributing guidelines](CONTRIBUTING.md) before submitting a pull request.

## Licence

[MIT](LICENSE)
