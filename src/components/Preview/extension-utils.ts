export interface ExtensionTag {
  key: string
  label: string
  value: unknown
}

export function extractExtensions(
  obj: Record<string, unknown>,
): ExtensionTag[] {
  return Object.entries(obj)
    .filter(([key, value]) => {
      if (!key.startsWith('x-')) return false
      if (value === null || value === undefined || value === false) return false
      if (value === '') return false
      if (typeof value === 'object') return false
      return true
    })
    .map(([key, value]) => ({
      key,
      label: key.slice(2),
      value,
    }))
}
