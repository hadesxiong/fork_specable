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

const MAX_DIFF_LINES = 5000;

/**
 * Myers diff algorithm -- O(nd) time where d is the edit distance.
 * Returns an edit script as an array of operations.
 */
function myersDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const n = oldLines.length;
  const m = newLines.length;
  const max = n + m;

  // V stores the furthest-reaching endpoint for each diagonal k
  const v = new Int32Array(2 * max + 1);
  const offset = max;

  // Trace stores V snapshots for backtracking
  const trace: Int32Array[] = [];

  outer: for (let d = 0; d <= max; d++) {
    const snapshot = new Int32Array(v);
    trace.push(snapshot);

    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[k - 1 + offset] < v[k + 1 + offset])) {
        x = v[k + 1 + offset]; // move down (insert)
      } else {
        x = v[k - 1 + offset] + 1; // move right (delete)
      }

      let y = x - k;

      // Follow diagonal (matching lines)
      while (x < n && y < m && oldLines[x] === newLines[y]) {
        x++;
        y++;
      }

      v[k + offset] = x;

      if (x >= n && y >= m) {
        break outer;
      }
    }
  }

  // Backtrack to build the edit script
  const edits: Array<'keep' | 'insert' | 'delete'> = [];
  let x = n;
  let y = m;

  for (let d = trace.length - 1; d > 0; d--) {
    const prev = trace[d - 1];
    const k = x - y;

    let prevK: number;
    if (k === -d || (k !== d && prev[k - 1 + offset] < prev[k + 1 + offset])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = prev[prevK + offset];
    const prevY = prevX - prevK;

    // Diagonal moves (matching lines)
    while (x > prevX && y > prevY) {
      edits.push('keep');
      x--;
      y--;
    }

    if (x === prevX) {
      edits.push('insert');
      y--;
    } else {
      edits.push('delete');
      x--;
    }
  }

  // Remaining diagonal at d=0
  while (x > 0 && y > 0) {
    edits.push('keep');
    x--;
    y--;
  }

  edits.reverse();

  // Convert edits to DiffLines
  const result: DiffLine[] = [];
  let oldIdx = 0;
  let newIdx = 0;

  for (const edit of edits) {
    switch (edit) {
      case 'keep':
        result.push({
          type: 'unchanged',
          content: oldLines[oldIdx],
          oldLineNumber: oldIdx + 1,
          newLineNumber: newIdx + 1,
        });
        oldIdx++;
        newIdx++;
        break;
      case 'delete':
        result.push({
          type: 'removed',
          content: oldLines[oldIdx],
          oldLineNumber: oldIdx + 1,
        });
        oldIdx++;
        break;
      case 'insert':
        result.push({
          type: 'added',
          content: newLines[newIdx],
          newLineNumber: newIdx + 1,
        });
        newIdx++;
        break;
    }
  }

  return result;
}

function computeLineDiff(oldContent: string, newContent: string): DiffLine[] | null {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  if (oldLines.length + newLines.length > MAX_DIFF_LINES) {
    return null;
  }

  return myersDiff(oldLines, newLines);
}

export function HistoryDiff({ oldContent, newContent }: HistoryDiffProps) {
  const diffLines = useMemo(
    () => computeLineDiff(oldContent, newContent),
    [oldContent, newContent]
  );

  const stats = useMemo(() => {
    if (!diffLines) return null;
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

  if (!diffLines) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm p-4 text-center">
        Diff too large to display inline ({oldContent.split('\n').length} + {newContent.split('\n').length} lines)
      </div>
    );
  }

  return (
    <div className="font-mono text-xs">
      {/* Stats bar */}
      {stats && (
        <div className="px-3 py-1.5 bg-zinc-900/50 text-zinc-400 flex gap-4 border-b border-zinc-800">
          <span className="text-emerald-400">+{stats.added} added</span>
          <span className="text-red-400">-{stats.removed} removed</span>
        </div>
      )}

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
