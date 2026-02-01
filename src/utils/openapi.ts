import type { OpenAPIV3 } from 'openapi-types';

/**
 * Extracts the schema name from a $ref path pointing to #/components/schemas/...
 * Returns null if the ref doesn't match the expected pattern.
 */
export function extractSchemaRefTarget(ref: string): string | null {
  const match = ref.match(/#\/components\/schemas\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Type guard to check if an object is an OpenAPI reference object.
 */
export function isReferenceObject(obj: unknown): obj is OpenAPIV3.ReferenceObject {
  return typeof obj === 'object' && obj !== null && '$ref' in obj;
}
