import type { OpenAPIV3 } from 'openapi-types'

export type SchemaObject = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject

export interface ResolvedSchema {
  schema: OpenAPIV3.SchemaObject
  name?: string
}

/**
 * Resolve a $ref to its actual schema object.
 * Returns the schema and optionally the referenced name (e.g., "Pet" from "#/components/schemas/Pet")
 */
export function resolveRef(
  ref: SchemaObject | undefined,
  spec: OpenAPIV3.Document,
): ResolvedSchema | null {
  if (!ref) return null

  if (!isRef(ref)) {
    return { schema: ref }
  }

  const refPath = ref.$ref
  if (!refPath.startsWith('#/')) {
    return null
  }

  const pathParts = refPath.slice(2).split('/')
  let current: unknown = spec

  for (const part of pathParts) {
    if (current && typeof current === 'object') {
      const decoded = part.replace(/~1/g, '/').replace(/~0/g, '~')
      current = (current as Record<string, unknown>)[decoded]
    } else {
      return null
    }
  }

  if (!current || typeof current !== 'object') {
    return null
  }

  const name = pathParts[pathParts.length - 1]
  return { schema: current as OpenAPIV3.SchemaObject, name }
}

/**
 * Check if a schema is a $ref
 */
export function isRef(
  schema: SchemaObject,
): schema is OpenAPIV3.ReferenceObject {
  return '$ref' in schema
}

/**
 * Get the display type for a schema, including format.
 * E.g., "string (uuid)", "integer", "array<Pet>"
 */
export function getSchemaType(
  schema: SchemaObject | undefined,
  spec: OpenAPIV3.Document,
): string {
  if (!schema) return 'unknown'

  if (isRef(schema)) {
    const resolved = resolveRef(schema, spec)
    if (resolved?.name) {
      return resolved.name
    }
    return getSchemaType(resolved?.schema, spec)
  }

  if (schema.type === 'array' && schema.items) {
    const itemType = getSchemaType(schema.items as SchemaObject, spec)
    return `array<${itemType}>`
  }

  if (schema.allOf) {
    const types = schema.allOf.map((s) =>
      getSchemaType(s as SchemaObject, spec),
    )
    return types.join(' & ')
  }

  if (schema.oneOf) {
    const types = schema.oneOf.map((s) =>
      getSchemaType(s as SchemaObject, spec),
    )
    return types.join(' | ')
  }

  if (schema.anyOf) {
    const types = schema.anyOf.map((s) =>
      getSchemaType(s as SchemaObject, spec),
    )
    return types.join(' | ')
  }

  const baseType = schema.type ?? 'object'
  if (schema.format) {
    return `${baseType} (${schema.format})`
  }

  return baseType as string
}

/**
 * Check if a schema uses composition (oneOf, anyOf, allOf)
 */
export function hasComposition(schema: OpenAPIV3.SchemaObject): boolean {
  return Boolean(schema.oneOf || schema.anyOf || schema.allOf)
}

export interface DiscriminatorInfo {
  propertyName: string
  mapping?: Record<string, string>
}

export interface CompositionInfo {
  type: 'oneOf' | 'anyOf' | 'allOf'
  variants: SchemaObject[]
  discriminator?: DiscriminatorInfo
}

/**
 * Get the composition type, variants, and discriminator from a schema
 */
export function getComposition(
  schema: OpenAPIV3.SchemaObject,
): CompositionInfo | null {
  const discriminator = schema.discriminator
    ? {
        propertyName: schema.discriminator.propertyName,
        mapping: schema.discriminator.mapping,
      }
    : undefined

  if (schema.oneOf) {
    return {
      type: 'oneOf',
      variants: schema.oneOf as SchemaObject[],
      discriminator,
    }
  }
  if (schema.anyOf) {
    return {
      type: 'anyOf',
      variants: schema.anyOf as SchemaObject[],
      discriminator,
    }
  }
  if (schema.allOf) {
    return {
      type: 'allOf',
      variants: schema.allOf as SchemaObject[],
      discriminator,
    }
  }
  return null
}

/**
 * Get the discriminator value for a variant based on the mapping.
 * Returns the key that maps to this variant's $ref, or undefined if not found.
 */
export function getDiscriminatorValue(
  variant: SchemaObject,
  discriminator: DiscriminatorInfo | undefined,
): string | undefined {
  if (!discriminator?.mapping || !isRef(variant)) return undefined

  const variantRef = variant.$ref
  for (const [value, ref] of Object.entries(discriminator.mapping)) {
    if (ref === variantRef) {
      return value
    }
  }
  return undefined
}

/**
 * Extract constraints from a schema for display.
 */
export interface SchemaConstraints {
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  enum?: unknown[]
  const?: unknown
  default?: unknown
  example?: unknown
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  readOnly?: boolean
  writeOnly?: boolean
}

export function getConstraints(
  schema: OpenAPIV3.SchemaObject,
): SchemaConstraints {
  const constraints: SchemaConstraints = {}

  if (schema.minimum !== undefined) constraints.minimum = schema.minimum
  if (schema.maximum !== undefined) constraints.maximum = schema.maximum
  // In OpenAPI 3.0, exclusiveMinimum/Maximum are booleans. In 3.1, they're numbers.
  if (typeof schema.exclusiveMinimum === 'number')
    constraints.exclusiveMinimum = schema.exclusiveMinimum
  if (typeof schema.exclusiveMaximum === 'number')
    constraints.exclusiveMaximum = schema.exclusiveMaximum
  if (schema.minLength !== undefined) constraints.minLength = schema.minLength
  if (schema.maxLength !== undefined) constraints.maxLength = schema.maxLength
  if (schema.pattern !== undefined) constraints.pattern = schema.pattern
  if (schema.enum !== undefined) constraints.enum = schema.enum
  // OpenAPI 3.1 supports const (JSON Schema)
  if ('const' in schema && schema.const !== undefined)
    constraints.const = schema.const
  if (schema.default !== undefined) constraints.default = schema.default
  if (schema.example !== undefined) constraints.example = schema.example
  if (schema.minItems !== undefined) constraints.minItems = schema.minItems
  if (schema.maxItems !== undefined) constraints.maxItems = schema.maxItems
  if (schema.uniqueItems !== undefined)
    constraints.uniqueItems = schema.uniqueItems
  if (schema.readOnly) constraints.readOnly = true
  if (schema.writeOnly) constraints.writeOnly = true

  return constraints
}

/**
 * Format constraints for display as a string.
 */
export function formatConstraints(constraints: SchemaConstraints): string[] {
  const parts: string[] = []

  if (constraints.minimum !== undefined) {
    parts.push(`min: ${constraints.minimum}`)
  }
  if (constraints.maximum !== undefined) {
    parts.push(`max: ${constraints.maximum}`)
  }
  if (constraints.exclusiveMinimum !== undefined) {
    parts.push(`> ${constraints.exclusiveMinimum}`)
  }
  if (constraints.exclusiveMaximum !== undefined) {
    parts.push(`< ${constraints.exclusiveMaximum}`)
  }
  if (constraints.minLength !== undefined) {
    parts.push(`minLen: ${constraints.minLength}`)
  }
  if (constraints.maxLength !== undefined) {
    parts.push(`maxLen: ${constraints.maxLength}`)
  }
  if (constraints.pattern !== undefined) {
    parts.push(`pattern: ${constraints.pattern}`)
  }
  if (constraints.minItems !== undefined) {
    parts.push(`minItems: ${constraints.minItems}`)
  }
  if (constraints.maxItems !== undefined) {
    parts.push(`maxItems: ${constraints.maxItems}`)
  }
  if (constraints.uniqueItems) {
    parts.push('unique')
  }
  if (constraints.default !== undefined) {
    parts.push(`default: ${JSON.stringify(constraints.default)}`)
  }

  return parts
}

/**
 * Get the $ref name from a reference path.
 * E.g., "#/components/schemas/Pet" -> "Pet"
 */
export function getRefName(ref: OpenAPIV3.ReferenceObject): string {
  const parts = ref.$ref.split('/')
  return parts[parts.length - 1]
}

/**
 * Check if a schema contains a recursive reference to a given schema name.
 * Used to detect self-referencing schemas like FilterGroup.
 */
export function isRecursiveRef(
  schema: SchemaObject,
  ancestorRefs: Set<string>,
): boolean {
  if (isRef(schema)) {
    return ancestorRefs.has(schema.$ref)
  }
  return false
}

/**
 * Collect all $ref paths from a schema and its nested structures.
 * Useful for detecting circular references.
 */
export function collectRefs(schema: SchemaObject): Set<string> {
  const refs = new Set<string>()

  function walk(s: SchemaObject | undefined) {
    if (!s) return

    if (isRef(s)) {
      refs.add(s.$ref)
      return
    }

    if (s.properties) {
      for (const propSchema of Object.values(s.properties)) {
        walk(propSchema as SchemaObject)
      }
    }

    if (s.type === 'array' && s.items) {
      walk(s.items as SchemaObject)
    }

    if (s.additionalProperties && typeof s.additionalProperties === 'object') {
      walk(s.additionalProperties as SchemaObject)
    }

    const composition = getComposition(s)
    if (composition) {
      for (const variant of composition.variants) {
        walk(variant)
      }
    }
  }

  walk(schema)
  return refs
}

/**
 * Convert an OpenAPI schema to a TypeScript type/interface string.
 */
export function schemaToTypeScript(
  schema: SchemaObject,
  spec: OpenAPIV3.Document,
  options: { name?: string; inline?: boolean } = {},
): string {
  const { name, inline = false } = options

  function convertType(s: SchemaObject, indent = 0): string {
    const spaces = '  '.repeat(indent)

    if (isRef(s)) {
      return getRefName(s)
    }

    const schemaObj = s as OpenAPIV3.SchemaObject

    // Handle const
    if ('const' in schemaObj && schemaObj.const !== undefined) {
      return JSON.stringify(schemaObj.const)
    }

    // Handle enum
    if (schemaObj.enum) {
      return schemaObj.enum.map((v) => JSON.stringify(v)).join(' | ')
    }

    // Handle composition
    if (schemaObj.allOf) {
      const types = schemaObj.allOf.map((sub) =>
        convertType(sub as SchemaObject, indent),
      )
      return types.join(' & ')
    }
    if (schemaObj.oneOf) {
      const types = schemaObj.oneOf.map((sub) =>
        convertType(sub as SchemaObject, indent),
      )
      return types.join(' | ')
    }
    if (schemaObj.anyOf) {
      const types = schemaObj.anyOf.map((sub) =>
        convertType(sub as SchemaObject, indent),
      )
      return types.join(' | ')
    }

    // Handle array
    if (schemaObj.type === 'array') {
      if (schemaObj.items) {
        const itemType = convertType(schemaObj.items as SchemaObject, indent)
        // Wrap union types in parentheses for clarity
        if (itemType.includes(' | ') || itemType.includes(' & ')) {
          return `(${itemType})[]`
        }
        return `${itemType}[]`
      }
      return 'unknown[]'
    }

    // Handle object
    if (schemaObj.type === 'object' || schemaObj.properties) {
      const properties = schemaObj.properties ?? {}
      const required = new Set(schemaObj.required ?? [])
      const entries = Object.entries(properties)

      if (entries.length === 0) {
        if (schemaObj.additionalProperties) {
          const valueType =
            typeof schemaObj.additionalProperties === 'object'
              ? convertType(
                  schemaObj.additionalProperties as SchemaObject,
                  indent,
                )
              : 'unknown'
          return `Record<string, ${valueType}>`
        }
        return 'Record<string, unknown>'
      }

      const propLines = entries.map(([propName, propSchema]) => {
        const isRequired = required.has(propName)
        const propType = convertType(propSchema as SchemaObject, indent + 1)
        const safeName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(propName)
          ? propName
          : `'${propName}'`
        return `${spaces}  ${safeName}${isRequired ? '' : '?'}: ${propType};`
      })

      return `{\n${propLines.join('\n')}\n${spaces}}`
    }

    // Handle primitives
    const type = schemaObj.type as string | undefined
    switch (type) {
      case 'string':
        return 'string'
      case 'number':
      case 'integer':
        return 'number'
      case 'boolean':
        return 'boolean'
      case 'null':
        return 'null'
      default:
        return 'unknown'
    }
  }

  // Handle nullable (OpenAPI 3.0 style)
  function wrapNullable(
    typeStr: string,
    schemaObj: OpenAPIV3.SchemaObject,
  ): string {
    if (schemaObj.nullable) {
      return `${typeStr} | null`
    }
    return typeStr
  }

  const resolvedSchema = isRef(schema)
    ? resolveRef(schema, spec)?.schema
    : schema
  if (!resolvedSchema) {
    return 'type Unknown = unknown;'
  }

  let typeString = convertType(resolvedSchema)
  typeString = wrapNullable(typeString, resolvedSchema)

  if (inline || !name) {
    return typeString
  }

  // Use interface for object types, type alias otherwise
  const isObjectType = typeString.startsWith('{')
  if (isObjectType) {
    return `interface ${name} ${typeString}`
  }

  return `type ${name} = ${typeString};`
}
