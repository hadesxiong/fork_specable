import { describe, it, expect } from 'vitest'
import { extractExtensions } from './extension-utils'

describe('extractExtensions', () => {
  it('extracts boolean true extensions', () => {
    const result = extractExtensions({ 'x-internal': true })
    expect(result).toEqual([
      { key: 'x-internal', label: 'internal', value: true },
    ])
  })

  it('skips boolean false extensions', () => {
    const result = extractExtensions({ 'x-internal': false })
    expect(result).toEqual([])
  })

  it('extracts string extensions', () => {
    const result = extractExtensions({ 'x-stability': 'experimental' })
    expect(result).toEqual([
      { key: 'x-stability', label: 'stability', value: 'experimental' },
    ])
  })

  it('skips empty string extensions', () => {
    const result = extractExtensions({ 'x-note': '' })
    expect(result).toEqual([])
  })

  it('extracts number extensions', () => {
    const result = extractExtensions({ 'x-rate-limit': 100 })
    expect(result).toEqual([
      { key: 'x-rate-limit', label: 'rate-limit', value: 100 },
    ])
  })

  it('skips object and array values', () => {
    const result = extractExtensions({
      'x-obj': { foo: 'bar' },
      'x-arr': [1, 2, 3],
    })
    expect(result).toEqual([])
  })

  it('skips null and undefined values', () => {
    const result = extractExtensions({
      'x-null': null,
      'x-undef': undefined,
    })
    expect(result).toEqual([])
  })

  it('ignores non x- prefixed keys', () => {
    const result = extractExtensions({
      summary: 'A summary',
      description: 'A description',
      'x-beta': true,
    })
    expect(result).toEqual([{ key: 'x-beta', label: 'beta', value: true }])
  })

  it('returns empty array for objects with no extensions', () => {
    const result = extractExtensions({ summary: 'test', operationId: 'foo' })
    expect(result).toEqual([])
  })

  it('returns empty array for empty objects', () => {
    const result = extractExtensions({})
    expect(result).toEqual([])
  })

  it('extracts multiple extensions preserving order', () => {
    const result = extractExtensions({
      'x-internal': true,
      'x-stability': 'beta',
      'x-rate-limit': 50,
    })
    expect(result).toHaveLength(3)
    expect(result[0].label).toBe('internal')
    expect(result[1].label).toBe('stability')
    expect(result[2].label).toBe('rate-limit')
  })
})
