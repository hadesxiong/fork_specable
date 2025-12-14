import { describe, it, expect } from 'vitest';
import type { OpenAPIV3 } from 'openapi-types';
import {
  getSchemaType,
  getComposition,
  hasComposition,
  resolveRef,
  isRef,
} from './schema-utils';

const createSpec = (schemas: Record<string, OpenAPIV3.SchemaObject> = {}): OpenAPIV3.Document => ({
  openapi: '3.0.3',
  info: { title: 'Test', version: '1.0.0' },
  paths: {},
  components: { schemas },
});

describe('getSchemaType', () => {
  it('returns primitive types', () => {
    const spec = createSpec();
    expect(getSchemaType({ type: 'string' }, spec)).toBe('string');
    expect(getSchemaType({ type: 'integer' }, spec)).toBe('integer');
    expect(getSchemaType({ type: 'boolean' }, spec)).toBe('boolean');
  });

  it('includes format in type string', () => {
    const spec = createSpec();
    expect(getSchemaType({ type: 'string', format: 'uuid' }, spec)).toBe('string (uuid)');
    expect(getSchemaType({ type: 'integer', format: 'int64' }, spec)).toBe('integer (int64)');
  });

  it('handles array types', () => {
    const spec = createSpec();
    expect(getSchemaType({ type: 'array', items: { type: 'string' } }, spec)).toBe('array<string>');
  });

  it('handles $ref by returning the schema name', () => {
    const spec = createSpec({ User: { type: 'object' } });
    expect(getSchemaType({ $ref: '#/components/schemas/User' }, spec)).toBe('User');
  });

  it('handles oneOf with pipe-separated types', () => {
    const spec = createSpec({
      Cat: { type: 'object' },
      Dog: { type: 'object' },
    });
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [
        { $ref: '#/components/schemas/Cat' },
        { $ref: '#/components/schemas/Dog' },
      ],
    };
    expect(getSchemaType(schema, spec)).toBe('Cat | Dog');
  });

  it('handles anyOf with pipe-separated types', () => {
    const spec = createSpec();
    const schema: OpenAPIV3.SchemaObject = {
      anyOf: [
        { type: 'string' },
        { type: 'integer' },
      ],
    };
    expect(getSchemaType(schema, spec)).toBe('string | integer');
  });

  it('handles allOf with ampersand-separated types', () => {
    const spec = createSpec({
      Base: { type: 'object' },
      Extra: { type: 'object' },
    });
    const schema: OpenAPIV3.SchemaObject = {
      allOf: [
        { $ref: '#/components/schemas/Base' },
        { $ref: '#/components/schemas/Extra' },
      ],
    };
    expect(getSchemaType(schema, spec)).toBe('Base & Extra');
  });

  it('handles nested array with oneOf', () => {
    const spec = createSpec({
      Cat: { type: 'object' },
      Dog: { type: 'object' },
    });
    const schema: OpenAPIV3.SchemaObject = {
      type: 'array',
      items: {
        oneOf: [
          { $ref: '#/components/schemas/Cat' },
          { $ref: '#/components/schemas/Dog' },
        ],
      },
    };
    expect(getSchemaType(schema, spec)).toBe('array<Cat | Dog>');
  });
});

describe('getComposition', () => {
  it('returns null for schemas without composition', () => {
    expect(getComposition({ type: 'object' })).toBeNull();
    expect(getComposition({ type: 'string' })).toBeNull();
  });

  it('extracts oneOf composition', () => {
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [{ type: 'string' }, { type: 'integer' }],
    };
    const result = getComposition(schema);
    expect(result).toEqual({
      type: 'oneOf',
      variants: [{ type: 'string' }, { type: 'integer' }],
    });
  });

  it('extracts anyOf composition', () => {
    const schema: OpenAPIV3.SchemaObject = {
      anyOf: [{ type: 'boolean' }],
    };
    const result = getComposition(schema);
    expect(result).toEqual({
      type: 'anyOf',
      variants: [{ type: 'boolean' }],
    });
  });

  it('extracts allOf composition', () => {
    const schema: OpenAPIV3.SchemaObject = {
      allOf: [{ type: 'object' }],
    };
    const result = getComposition(schema);
    expect(result).toEqual({
      type: 'allOf',
      variants: [{ type: 'object' }],
    });
  });

  it('prioritises oneOf over anyOf and allOf', () => {
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [{ type: 'string' }],
      anyOf: [{ type: 'integer' }],
      allOf: [{ type: 'boolean' }],
    };
    const result = getComposition(schema);
    expect(result?.type).toBe('oneOf');
  });
});

describe('hasComposition', () => {
  it('returns false for simple schemas', () => {
    expect(hasComposition({ type: 'string' })).toBe(false);
    expect(hasComposition({ type: 'object', properties: {} })).toBe(false);
  });

  it('returns true for oneOf', () => {
    expect(hasComposition({ oneOf: [{ type: 'string' }] })).toBe(true);
  });

  it('returns true for anyOf', () => {
    expect(hasComposition({ anyOf: [{ type: 'string' }] })).toBe(true);
  });

  it('returns true for allOf', () => {
    expect(hasComposition({ allOf: [{ type: 'string' }] })).toBe(true);
  });
});

describe('resolveRef', () => {
  it('returns null for non-existent refs', () => {
    const spec = createSpec();
    expect(resolveRef({ $ref: '#/components/schemas/Missing' }, spec)).toBeNull();
  });

  it('resolves schema refs correctly', () => {
    const spec = createSpec({ User: { type: 'object', properties: { id: { type: 'integer' } } } });
    const result = resolveRef({ $ref: '#/components/schemas/User' }, spec);
    expect(result).toEqual({
      schema: { type: 'object', properties: { id: { type: 'integer' } } },
      name: 'User',
    });
  });

  it('returns schema directly if not a ref', () => {
    const spec = createSpec();
    const schema: OpenAPIV3.SchemaObject = { type: 'string' };
    expect(resolveRef(schema, spec)).toEqual({ schema });
  });
});

describe('isRef', () => {
  it('identifies reference objects', () => {
    expect(isRef({ $ref: '#/components/schemas/User' })).toBe(true);
  });

  it('identifies non-reference objects', () => {
    expect(isRef({ type: 'string' })).toBe(false);
    expect(isRef({ type: 'object', properties: {} })).toBe(false);
  });
});
