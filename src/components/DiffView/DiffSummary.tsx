import type { DiffSummary as DiffSummaryType } from '../../store';

interface DiffSummaryProps {
  summary: DiffSummaryType;
}

export function DiffSummary({ summary }: DiffSummaryProps) {
  return (
    <div className="flex items-center gap-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Changes:</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-xs text-zinc-300">{summary.added} added</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-xs text-zinc-300">{summary.removed} removed</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-yellow-500" />
        <span className="text-xs text-zinc-300">{summary.modified} modified</span>
      </div>

      <div className="h-4 w-px bg-zinc-700" />

      {summary.breaking > 0 ? (
        <div className="flex items-center gap-1.5 text-amber-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-xs font-medium">{summary.breaking} breaking</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-green-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-xs">No breaking changes</span>
        </div>
      )}
    </div>
  );
}
