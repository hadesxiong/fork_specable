import { describe, it, expect } from 'vitest';
import type { OpenAPIV3 } from 'openapi-types';
import {
  getSchemaType,
  getComposition,
  hasComposition,
  resolveRef,
  isRef,
  getConstraints,
  getDiscriminatorValue,
  isRecursiveRef,
  collectRefs,
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

describe('getComposition with discriminator', () => {
  it('extracts discriminator from oneOf schema', () => {
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [
        { $ref: '#/components/schemas/Cat' },
        { $ref: '#/components/schemas/Dog' },
      ],
      discriminator: {
        propertyName: 'petType',
        mapping: {
          cat: '#/components/schemas/Cat',
          dog: '#/components/schemas/Dog',
        },
      },
    };
    const result = getComposition(schema);
    expect(result?.discriminator).toEqual({
      propertyName: 'petType',
      mapping: {
        cat: '#/components/schemas/Cat',
        dog: '#/components/schemas/Dog',
      },
    });
  });

  it('returns undefined discriminator when not present', () => {
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [{ type: 'string' }, { type: 'integer' }],
    };
    const result = getComposition(schema);
    expect(result?.discriminator).toBeUndefined();
  });
});

describe('getDiscriminatorValue', () => {
  it('returns discriminator value for matching ref', () => {
    const variant = { $ref: '#/components/schemas/CreditCard' };
    const discriminator = {
      propertyName: 'type',
      mapping: {
        credit_card: '#/components/schemas/CreditCard',
        bank_transfer: '#/components/schemas/BankTransfer',
      },
    };
    expect(getDiscriminatorValue(variant, discriminator)).toBe('credit_card');
  });

  it('returns undefined for non-matching ref', () => {
    const variant = { $ref: '#/components/schemas/Unknown' };
    const discriminator = {
      propertyName: 'type',
      mapping: {
        credit_card: '#/components/schemas/CreditCard',
      },
    };
    expect(getDiscriminatorValue(variant, discriminator)).toBeUndefined();
  });

  it('returns undefined when discriminator has no mapping', () => {
    const variant = { $ref: '#/components/schemas/CreditCard' };
    const discriminator = { propertyName: 'type' };
    expect(getDiscriminatorValue(variant, discriminator)).toBeUndefined();
  });

  it('returns undefined for non-ref schemas', () => {
    const variant: OpenAPIV3.SchemaObject = { type: 'string' };
    const discriminator = {
      propertyName: 'type',
      mapping: { str: '#/components/schemas/String' },
    };
    expect(getDiscriminatorValue(variant, discriminator)).toBeUndefined();
  });
});

describe('getConstraints', () => {
  it('extracts const value', () => {
    const schema = { type: 'string', const: 'credit_card' } as OpenAPIV3.SchemaObject;
    const constraints = getConstraints(schema);
    expect(constraints.const).toBe('credit_card');
  });

  it('extracts readOnly flag', () => {
    const schema: OpenAPIV3.SchemaObject = { type: 'string', readOnly: true };
    const constraints = getConstraints(schema);
    expect(constraints.readOnly).toBe(true);
  });

  it('extracts writeOnly flag', () => {
    const schema: OpenAPIV3.SchemaObject = { type: 'string', writeOnly: true };
    const constraints = getConstraints(schema);
    expect(constraints.writeOnly).toBe(true);
  });

  it('does not include readOnly when false', () => {
    const schema: OpenAPIV3.SchemaObject = { type: 'string', readOnly: false };
    const constraints = getConstraints(schema);
    expect(constraints.readOnly).toBeUndefined();
  });
});

describe('isRecursiveRef', () => {
  it('detects recursive reference', () => {
    const variant = { $ref: '#/components/schemas/FilterGroup' };
    const ancestors = new Set(['#/components/schemas/FilterGroup']);
    expect(isRecursiveRef(variant, ancestors)).toBe(true);
  });

  it('returns false for non-recursive reference', () => {
    const variant = { $ref: '#/components/schemas/TextFilter' };
    const ancestors = new Set(['#/components/schemas/FilterGroup']);
    expect(isRecursiveRef(variant, ancestors)).toBe(false);
  });

  it('returns false for non-ref schemas', () => {
    const variant: OpenAPIV3.SchemaObject = { type: 'string' };
    const ancestors = new Set(['#/components/schemas/FilterGroup']);
    expect(isRecursiveRef(variant, ancestors)).toBe(false);
  });
});

describe('collectRefs', () => {
  it('collects refs from properties', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/User' },
        address: { $ref: '#/components/schemas/Address' },
      },
    };
    const refs = collectRefs(schema);
    expect(refs).toEqual(new Set([
      '#/components/schemas/User',
      '#/components/schemas/Address',
    ]));
  });

  it('collects refs from array items', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'array',
      items: { $ref: '#/components/schemas/Item' },
    };
    const refs = collectRefs(schema);
    expect(refs).toEqual(new Set(['#/components/schemas/Item']));
  });

  it('collects refs from oneOf variants', () => {
    const schema: OpenAPIV3.SchemaObject = {
      oneOf: [
        { $ref: '#/components/schemas/Cat' },
        { $ref: '#/components/schemas/Dog' },
      ],
    };
    const refs = collectRefs(schema);
    expect(refs).toEqual(new Set([
      '#/components/schemas/Cat',
      '#/components/schemas/Dog',
    ]));
  });

  it('collects refs from additionalProperties', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      additionalProperties: { $ref: '#/components/schemas/Value' },
    };
    const refs = collectRefs(schema);
    expect(refs).toEqual(new Set(['#/components/schemas/Value']));
  });

  it('returns empty set for schema without refs', () => {
    const schema: OpenAPIV3.SchemaObject = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
    };
    const refs = collectRefs(schema);
    expect(refs.size).toBe(0);
  });
});
