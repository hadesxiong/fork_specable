export function GraphLegend() {
  return (
    <div className="flex items-center justify-between gap-6 px-3 py-2 border-t border-zinc-800 bg-zinc-900/50 text-xs">
      <dl className="flex items-center gap-3">
        <dt className="text-zinc-500">Properties:</dt>
        <dd className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-red-500" aria-hidden="true" />
          <span className="text-zinc-400">Required</span>
        </dd>
        <dd className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-purple-500"
            aria-hidden="true"
          />
          <span className="text-zinc-400">Reference</span>
        </dd>
      </dl>

      <dl className="flex items-center gap-3">
        <dt className="text-zinc-500">Edges:</dt>
        <dd className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-purple-500" aria-hidden="true" />
          <span className="text-zinc-400">$ref</span>
        </dd>
        <dd className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-violet-500" aria-hidden="true" />
          <span className="text-zinc-400">allOf</span>
        </dd>
        <dd className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-amber-500" aria-hidden="true" />
          <span className="text-zinc-400">anyOf</span>
        </dd>
        <dd className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-pink-500" aria-hidden="true" />
          <span className="text-zinc-400">oneOf</span>
        </dd>
        <dd className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-cyan-500" aria-hidden="true" />
          <span className="text-zinc-400">items</span>
        </dd>
      </dl>
    </div>
  )
}
