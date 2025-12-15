export function GraphLegend() {
  return (
    <div className="flex items-center justify-between gap-6 px-3 py-2 border-t border-zinc-800 bg-zinc-900/50 text-xs">
      <div className="flex items-center gap-3">
        <span className="text-zinc-500">Properties:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-red-500" />
          <span className="text-zinc-400">Required</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          <span className="text-zinc-400">Reference</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-zinc-500">Edges:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-purple-500" />
          <span className="text-zinc-400">$ref</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-violet-500" />
          <span className="text-zinc-400">allOf</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-amber-500" />
          <span className="text-zinc-400">anyOf</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-pink-500" />
          <span className="text-zinc-400">oneOf</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-cyan-500" />
          <span className="text-zinc-400">items</span>
        </div>
      </div>
    </div>
  );
}
