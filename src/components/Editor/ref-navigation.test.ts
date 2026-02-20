import { describe, it, expect } from 'vitest'

/**
 * Tests for $ref path conversion utilities.
 * The actual navigation is tested through integration tests as it requires CodeMirror.
 */

function refPathToSourceMapKey(refPath: string): string {
  return refPath.slice(2).replace(/\//g, '.')
}

describe('refPathToSourceMapKey', () => {
  it('converts simple component reference', () => {
    expect(refPathToSourceMapKey('#/components/schemas/Pet')).toBe(
      'components.schemas.Pet',
    )
  })

  it('converts nested reference', () => {
    expect(
      refPathToSourceMapKey('#/components/schemas/Order/properties/id'),
    ).toBe('components.schemas.Order.properties.id')
  })

  it('converts path reference', () => {
    expect(refPathToSourceMapKey('#/paths/~1users/get')).toBe(
      'paths.~1users.get',
    )
  })

  it('handles root reference', () => {
    expect(refPathToSourceMapKey('#/')).toBe('')
  })

  it('handles single segment', () => {
    expect(refPathToSourceMapKey('#/info')).toBe('info')
  })
})

describe('$ref pattern matching', () => {
  const REF_PATTERN = /\$ref:\s*['"]?(#\/[^'"}\s]+)['"]?/g

  it('matches YAML-style $ref with double quotes', () => {
    const text = '$ref: "#/components/schemas/Pet"'
    REF_PATTERN.lastIndex = 0
    const match = REF_PATTERN.exec(text)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('#/components/schemas/Pet')
  })

  it('matches YAML-style $ref with single quotes', () => {
    const text = "$ref: '#/components/schemas/Pet'"
    REF_PATTERN.lastIndex = 0
    const match = REF_PATTERN.exec(text)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('#/components/schemas/Pet')
  })

  it('matches YAML-style $ref without quotes', () => {
    const text = '$ref: #/components/schemas/Pet'
    REF_PATTERN.lastIndex = 0
    const match = REF_PATTERN.exec(text)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('#/components/schemas/Pet')
  })

  it('finds multiple refs in a line', () => {
    const text =
      'items: { $ref: "#/components/schemas/Pet" } other: { $ref: "#/components/schemas/Order" }'
    const matches: string[] = []
    let match
    REF_PATTERN.lastIndex = 0
    while ((match = REF_PATTERN.exec(text)) !== null) {
      matches.push(match[1])
    }
    expect(matches).toEqual([
      '#/components/schemas/Pet',
      '#/components/schemas/Order',
    ])
  })

  it('handles $ref with escaped characters in path', () => {
    // The curly braces in the path stop the match since } is excluded in the pattern
    const text = '$ref: "#/paths/~1users/get"'
    REF_PATTERN.lastIndex = 0
    const match = REF_PATTERN.exec(text)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('#/paths/~1users/get')
  })
})
