import type { OpenAPIV3 } from 'openapi-types';

export type SchemaObject = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;

export interface ResolvedSchema {
  schema: OpenAPIV3.SchemaObject;
  name?: string;
}

/**
 * Resolve a $ref to its actual schema object.
 * Returns the schema and optionally the referenced name (e.g., "Pet" from "#/components/schemas/Pet")
 */
export function resolveRef(
  ref: SchemaObject | undefined,
  spec: OpenAPIV3.Document
): ResolvedSchema | null {
  if (!ref) return null;

  if (!isRef(ref)) {
    return { schema: ref };
  }

  const refPath = ref.$ref;
  if (!refPath.startsWith('#/')) {
    return null;
  }

  const pathParts = refPath.slice(2).split('/');
  let current: unknown = spec;

  for (const part of pathParts) {
    if (current && typeof current === 'object') {
      const decoded = part.replace(/~1/g, '/').replace(/~0/g, '~');
      current = (current as Record<string, unknown>)[decoded];
    } else {
      return null;
    }
  }

  if (!current || typeof current !== 'object') {
    return null;
  }

  const name = pathParts[pathParts.length - 1];
  return { schema: current as OpenAPIV3.SchemaObject, name };
}

/**
 * Check if a schema is a $ref
 */
export function isRef(schema: SchemaObject): schema is OpenAPIV3.ReferenceObject {
  return '$ref' in schema;
}

/**
 * Get the display type for a schema, including format.
 * E.g., "string (uuid)", "integer", "array<Pet>"
 */
export function getSchemaType(
  schema: SchemaObject | undefined,
  spec: OpenAPIV3.Document
): string {
  if (!schema) return 'unknown';

  if (isRef(schema)) {
    const resolved = resolveRef(schema, spec);
    if (resolved?.name) {
      return resolved.name;
    }
    return getSchemaType(resolved?.schema, spec);
  }

  if (schema.type === 'array' && schema.items) {
    const itemType = getSchemaType(schema.items as SchemaObject, spec);
    return `array<${itemType}>`;
  }

  if (schema.allOf) {
    return 'allOf';
  }

  if (schema.oneOf) {
    return 'oneOf';
  }

  if (schema.anyOf) {
    return 'anyOf';
  }

  const baseType = schema.type ?? 'object';
  if (schema.format) {
    return `${baseType} (${schema.format})`;
  }

  return baseType as string;
}

/**
 * Extract constraints from a schema for display.
 */
export interface SchemaConstraints {
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

export function getConstraints(schema: OpenAPIV3.SchemaObject): SchemaConstraints {
  const constraints: SchemaConstraints = {};

  if (schema.minimum !== undefined) constraints.minimum = schema.minimum;
  if (schema.maximum !== undefined) constraints.maximum = schema.maximum;
  // In OpenAPI 3.0, exclusiveMinimum/Maximum are booleans. In 3.1, they're numbers.
  if (typeof schema.exclusiveMinimum === 'number') constraints.exclusiveMinimum = schema.exclusiveMinimum;
  if (typeof schema.exclusiveMaximum === 'number') constraints.exclusiveMaximum = schema.exclusiveMaximum;
  if (schema.minLength !== undefined) constraints.minLength = schema.minLength;
  if (schema.maxLength !== undefined) constraints.maxLength = schema.maxLength;
  if (schema.pattern !== undefined) constraints.pattern = schema.pattern;
  if (schema.enum !== undefined) constraints.enum = schema.enum;
  if (schema.default !== undefined) constraints.default = schema.default;
  if (schema.example !== undefined) constraints.example = schema.example;
  if (schema.minItems !== undefined) constraints.minItems = schema.minItems;
  if (schema.maxItems !== undefined) constraints.maxItems = schema.maxItems;
  if (schema.uniqueItems !== undefined) constraints.uniqueItems = schema.uniqueItems;

  return constraints;
}

/**
 * Format constraints for display as a string.
 */
export function formatConstraints(constraints: SchemaConstraints): string[] {
  const parts: string[] = [];

  if (constraints.minimum !== undefined) {
    parts.push(`min: ${constraints.minimum}`);
  }
  if (constraints.maximum !== undefined) {
    parts.push(`max: ${constraints.maximum}`);
  }
  if (constraints.exclusiveMinimum !== undefined) {
    parts.push(`> ${constraints.exclusiveMinimum}`);
  }
  if (constraints.exclusiveMaximum !== undefined) {
    parts.push(`< ${constraints.exclusiveMaximum}`);
  }
  if (constraints.minLength !== undefined) {
    parts.push(`minLen: ${constraints.minLength}`);
  }
  if (constraints.maxLength !== undefined) {
    parts.push(`maxLen: ${constraints.maxLength}`);
  }
  if (constraints.pattern !== undefined) {
    parts.push(`pattern: ${constraints.pattern}`);
  }
  if (constraints.minItems !== undefined) {
    parts.push(`minItems: ${constraints.minItems}`);
  }
  if (constraints.maxItems !== undefined) {
    parts.push(`maxItems: ${constraints.maxItems}`);
  }
  if (constraints.uniqueItems) {
    parts.push('unique');
  }
  if (constraints.default !== undefined) {
    parts.push(`default: ${JSON.stringify(constraints.default)}`);
  }

  return parts;
}

/**
 * Get the $ref name from a reference path.
 * E.g., "#/components/schemas/Pet" -> "Pet"
 */
export function getRefName(ref: OpenAPIV3.ReferenceObject): string {
  const parts = ref.$ref.split('/');
  return parts[parts.length - 1];
}
