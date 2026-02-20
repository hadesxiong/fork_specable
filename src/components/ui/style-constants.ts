import type { LucideIcon } from 'lucide-react'
import { AlertCircle, AlertTriangle, Info } from 'lucide-react'

/**
 * HTTP method styling for badges and labels.
 * Used in DocumentationView and OutlineView.
 */
export const METHOD_STYLES: Record<string, { bg: string; text: string }> = {
  get: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  post: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  put: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  patch: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  delete: { bg: 'bg-red-500/15', text: 'text-red-400' },
  options: { bg: 'bg-zinc-500/15', text: 'text-zinc-400' },
  head: { bg: 'bg-zinc-500/15', text: 'text-zinc-400' },
}

/**
 * Text-only method colours for compact displays (e.g., outline view).
 */
export const METHOD_TEXT_COLOURS: Record<string, string> = {
  get: 'text-emerald-400',
  post: 'text-purple-400',
  put: 'text-amber-400',
  patch: 'text-yellow-400',
  delete: 'text-red-400',
  options: 'text-zinc-500',
  head: 'text-zinc-500',
}

/**
 * Parameter location badge styling.
 * Used in preview components for path/query/header/cookie parameters.
 */
export const LOCATION_STYLES: Record<string, { bg: string; text: string }> = {
  path: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  query: { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  header: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  cookie: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
}

/**
 * Diagnostic severity icons.
 */
export const SEVERITY_ICONS: Record<'error' | 'warning' | 'info', LucideIcon> =
  {
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  }

/**
 * Diagnostic severity text colours.
 */
export const SEVERITY_COLOURS: Record<'error' | 'warning' | 'info', string> = {
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-purple-400',
}
