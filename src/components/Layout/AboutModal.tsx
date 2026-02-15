import { X, ExternalLink } from "lucide-react";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEATURES = [
  {
    title: "Validation",
    description:
      "Syntax, schema, and linting validation using Web Workers. Supports OpenAPI 3.0.x and 2.0 (Swagger).",
  },
  {
    title: "Keyboard Shortcuts",
    description:
      "Command palette (Ctrl+Shift+P), go-to-line, find/replace, and code folding shortcuts.",
  },
  {
    title: "$ref Navigation",
    description:
      "Go-to-definition (F12) and click-to-navigate for $ref targets throughout the specification.",
  },
  {
    title: "Schema Graph",
    description:
      "Visualise relationships between schemas including $ref, allOf, anyOf, and oneOf connections.",
  },
  {
    title: "Diff View",
    description:
      "Compare two specifications and view changes. Breaking changes are flagged. Export as Markdown.",
  },
  {
    title: "Local Storage",
    description:
      "Files are edited locally and version history is stored in IndexedDB. Try It Out and URL imports make network requests from your browser.",
  },
];

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-[640px] max-w-[90vw] max-h-[85vh] bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="text-zinc-100 tracking-tight font-mono font-bold text-xl">
              SPECABLE
            </span>
            <span className="px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 rounded">
              v0.1.0
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Content */}
        <div className="overflow-y-auto p-6 max-h-[calc(85vh-65px)]">
          {/* Description */}
          <p className="text-sm text-zinc-400 mb-6">
            A browser-based OpenAPI specification editor with validation, documentation preview, and schema visualisation.
          </p>

          {/* Features grid */}
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">
            Features
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {FEATURES.map((feature) => (
              <li
                key={feature.title}
                className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-800"
              >
                <h4 className="text-sm font-medium text-zinc-200 mb-1">
                  {feature.title}
                </h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {feature.description}
                </p>
              </li>
            ))}
          </ul>

          {/* Tech stack */}
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
            Built With
          </h3>
          <ul className="flex flex-wrap gap-2 mb-8">
            {[
              "React 19",
              "TypeScript",
              "CodeMirror 6",
              "Zustand",
              "Tailwind CSS",
              "Web Workers",
              "Vite",
            ].map((tech) => (
              <li
                key={tech}
                className="px-2 py-1 text-xs font-mono bg-zinc-800 text-zinc-400 rounded"
              >
                {tech}
              </li>
            ))}
          </ul>

          <footer className="pt-4 border-t border-zinc-800 flex items-center justify-between">
            <p className="text-xs text-zinc-600">
              Files and version history are stored locally in your browser.
            </p>
            <a
              href="https://github.com/tiaanduplessis/specable"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          </footer>
        </div>
      </div>
    </div>
  );
}
