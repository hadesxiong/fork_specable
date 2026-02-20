import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface MarkdownProps {
  children: string
  className?: string
}

const components: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-purple-400 hover:text-purple-400 underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code
          className={`block p-2 bg-zinc-800 rounded text-zinc-200 overflow-x-auto ${className ?? ''}`}
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300 text-[0.9em]"
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-2 text-sm font-mono">{children}</pre>
  ),
  p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => (
    <strong className="font-bold text-zinc-200">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 pl-3 border-l-2 border-zinc-600 text-zinc-400 italic">
      {children}
    </blockquote>
  ),
  h1: ({ children }) => (
    <h1 className="text-sm font-bold text-zinc-200 mt-3 mb-1 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-zinc-200 mt-2 mb-1 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-medium text-zinc-300 mt-2 mb-1 first:mt-0">
      {children}
    </h3>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-zinc-800">{children}</thead>,
  th: ({ children }) => (
    <th className="px-2 py-1 text-left font-medium text-zinc-300 border border-zinc-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1 text-zinc-400 border border-zinc-700">
      {children}
    </td>
  ),
  hr: () => <hr className="my-2 border-zinc-700" />,
  del: ({ children }) => (
    <del className="line-through text-zinc-500">{children}</del>
  ),
  input: ({ checked, disabled }) => (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      className="mr-1 accent-purple-500"
      readOnly
    />
  ),
}

export function Markdown({ children, className = '' }: MarkdownProps) {
  if (!className) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    )
  }
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
