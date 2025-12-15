import { useMemo } from 'react';

interface HistoryDiffProps {
  oldContent: string;
  newContent: string;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

function computeLineDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Simple LCS-based diff
  const lcs = computeLCS(oldLines, newLines);
  const result: DiffLine[] = [];

  let oldIndex = 0;
  let newIndex = 0;
  let lcsIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (lcsIndex < lcs.length && oldIndex < oldLines.length && oldLines[oldIndex] === lcs[lcsIndex]) {
      // Check if this line is also in new content at the right position
      if (newIndex < newLines.length && newLines[newIndex] === lcs[lcsIndex]) {
        result.push({
          type: 'unchanged',
          content: oldLines[oldIndex],
          oldLineNumber: oldIndex + 1,
          newLineNumber: newIndex + 1,
        });
        oldIndex++;
        newIndex++;
        lcsIndex++;
      } else {
        // New line was added
        result.push({
          type: 'added',
          content: newLines[newIndex],
          newLineNumber: newIndex + 1,
        });
        newIndex++;
      }
    } else if (oldIndex < oldLines.length && (lcsIndex >= lcs.length || oldLines[oldIndex] !== lcs[lcsIndex])) {
      // Old line was removed
      result.push({
        type: 'removed',
        content: oldLines[oldIndex],
        oldLineNumber: oldIndex + 1,
      });
      oldIndex++;
    } else if (newIndex < newLines.length) {
      // New line was added
      result.push({
        type: 'added',
        content: newLines[newIndex],
        newLineNumber: newIndex + 1,
      });
      newIndex++;
    }
  }

  return result;
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // Create DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

export function HistoryDiff({ oldContent, newContent }: HistoryDiffProps) {
  const diffLines = useMemo(
    () => computeLineDiff(oldContent, newContent),
    [oldContent, newContent]
  );

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const line of diffLines) {
      if (line.type === 'added') added++;
      else if (line.type === 'removed') removed++;
    }
    return { added, removed };
  }, [diffLines]);

  if (oldContent === newContent) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        No changes from this version
      </div>
    );
  }

  return (
    <div className="font-mono text-xs">
      {/* Stats bar */}
      <div className="px-3 py-1.5 bg-zinc-900/50 text-zinc-400 flex gap-4 border-b border-zinc-800">
        <span className="text-emerald-400">+{stats.added} added</span>
        <span className="text-red-400">-{stats.removed} removed</span>
      </div>

      {/* Diff content */}
      <div className="overflow-auto">
        {diffLines.map((line, index) => (
          <div
            key={index}
            className={`flex ${
              line.type === 'added'
                ? 'bg-emerald-500/10'
                : line.type === 'removed'
                ? 'bg-red-500/10'
                : ''
            }`}
          >
            {/* Line number columns */}
            <div className="w-10 flex-shrink-0 text-right pr-2 text-zinc-600 select-none border-r border-zinc-800">
              {line.oldLineNumber || ''}
            </div>
            <div className="w-10 flex-shrink-0 text-right pr-2 text-zinc-600 select-none border-r border-zinc-800">
              {line.newLineNumber || ''}
            </div>

            {/* Change indicator */}
            <div className="w-6 flex-shrink-0 text-center select-none">
              {line.type === 'added' && <span className="text-emerald-400">+</span>}
              {line.type === 'removed' && <span className="text-red-400">-</span>}
            </div>

            {/* Content */}
            <div
              className={`flex-1 px-2 whitespace-pre ${
                line.type === 'added'
                  ? 'text-emerald-300'
                  : line.type === 'removed'
                  ? 'text-red-300'
                  : 'text-zinc-400'
              }`}
            >
              {line.content || '\u00A0'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
