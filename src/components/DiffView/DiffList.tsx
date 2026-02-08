import type { DiffChange } from "../../store";

interface DiffListProps {
  changes: DiffChange[];
  onChangeClick: (jsonPath: string) => void;
}

const TYPE_STYLES = {
  added: {
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/30",
    text: "text-emerald-400",
    icon: "+",
  },
  removed: {
    bg: "bg-red-400/10",
    border: "border-red-400/30",
    text: "text-red-400",
    icon: "-",
  },
  modified: {
    bg: "bg-amber-400/10",
    border: "border-amber-400/30",
    text: "text-amber-400",
    icon: "~",
  },
};

export function DiffList({ changes, onChangeClick }: DiffListProps) {
  return (
    <div className="space-y-2">
      {changes.map((change, index) => {
        const style = TYPE_STYLES[change.type];

        return (
          <div
            key={`${change.path}-${index}`}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-zinc-800/50 ${style.bg} ${style.border}`}
            onClick={() =>
              change.jsonPathNew && onChangeClick(change.jsonPathNew)
            }
          >
            <span className={`font-mono text-sm font-bold ${style.text}`}>
              {style.icon}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <code className="text-sm text-zinc-200 font-mono truncate">
                  {change.path}
                </code>
                {change.breaking && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    Breaking
                  </span>
                )}
              </div>

              {change.breakingReason && (
                <p className="text-xs text-amber-400/80 mt-1">
                  {change.breakingReason}
                </p>
              )}

              {change.type === "modified" && (
                <div className="mt-2 text-xs text-zinc-500">
                  <span className="line-through">
                    {formatValue(change.oldValue)}
                  </span>
                  <span className="mx-2">→</span>
                  <span className="text-zinc-300">
                    {formatValue(change.newValue)}
                  </span>
                </div>
              )}
            </div>

            <svg
              className="w-4 h-4 text-zinc-500 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
