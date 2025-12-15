import { X } from "lucide-react";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEATURES = [
  {
    title: "Sub-100ms Validation",
    description:
      "Tiered validation pipeline with Web Workers keeps the UI responsive while validating syntax, schema, and linting rules in parallel.",
  },
  {
    title: "Keyboard-First Workflow",
    description:
      "Command palette (Ctrl+Shift+P), comprehensive shortcuts, and vim-inspired navigation for power users who live in their editors.",
  },
  {
    title: "$ref Navigation",
    description:
      "Go-to-definition (F12) and find-all-references across your entire specification. Click any $ref to jump to its target.",
  },
  {
    title: "Schema Graph Visualisation",
    description:
      "Interactive graph showing relationships between schemas - $ref, allOf, anyOf, oneOf connections at a glance.",
  },
  {
    title: "Breaking Change Detection",
    description:
      "Compare spec versions and identify breaking changes automatically. Export changelogs for API consumers.",
  },
  {
    title: "Local-First & Private",
    description:
      "Your specifications never leave your device. No accounts, no cloud uploads, works offline.",
  },
];

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-[640px] max-w-[90vw] max-h-[85vh] bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
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
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 max-h-[calc(85vh-65px)]">
          {/* Tagline */}
          <p className="text-lg text-zinc-300 mb-6">
            A fast, keyboard-driven OpenAPI editor for power users.
          </p>

          {/* Problem statement */}
          <div className="mb-8 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
            <p className="text-sm text-zinc-400 leading-relaxed">
              Existing OpenAPI editors fail developers through slow performance,
              missing power-user features, and primitive navigation for complex
              specs. Specable targets individual developers with{" "}
              <span className="text-purple-400">sub-100ms validation</span>,{" "}
              <span className="text-purple-400">keyboard-first workflows</span>,
              and{" "}
              <span className="text-purple-400">intelligent navigation</span>{" "}
              for massive specifications &mdash; all while remaining local-first
              and free.
            </p>
          </div>

          {/* Features grid */}
          <h3 className="text-xs font-medium text-purple-400 uppercase tracking-wide mb-4">
            Key Features
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-800"
              >
                <h4 className="text-sm font-medium text-zinc-200 mb-1">
                  {feature.title}
                </h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          {/* Tech stack */}
          <h3 className="text-xs font-medium text-purple-400 uppercase tracking-wide mb-3">
            Built With
          </h3>
          <div className="flex flex-wrap gap-2 mb-8">
            {[
              "React 19",
              "TypeScript",
              "CodeMirror 6",
              "Zustand",
              "Tailwind CSS",
              "Web Workers",
              "Vite",
            ].map((tech) => (
              <span
                key={tech}
                className="px-2 py-1 text-xs font-mono bg-zinc-800 text-zinc-400 rounded"
              >
                {tech}
              </span>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-500 text-center">
              Local-first. No accounts. No cloud. Your specs, your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
