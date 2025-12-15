import { describe, it, expect } from 'vitest';
import type { OpenAPIV3 } from 'openapi-types';
import { buildGraphData, filterGraphData } from './graph-builder';

describe('graph-builder', () => {
  describe('buildGraphData', () => {
    it('creates nodes for all schemas', () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            User: { type: 'object', properties: { id: { type: 'integer' } } },
            Post: { type: 'object', properties: { title: { type: 'string' } } },
          },
        },
      };

      const result = buildGraphData(spec);

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.find((n) => n.id === 'User')).toBeDefined();
      expect(result.nodes.find((n) => n.id === 'Post')).toBeDefined();
    });

    it('creates edges for $ref references', () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                posts: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Post' },
                },
              },
            },
            Post: { type: 'object', properties: { title: { type: 'string' } } },
          },
        },
      };

      const result = buildGraphData(spec);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toEqual({
        source: 'User',
        target: 'Post',
        type: 'items',
        sourceProperty: 'posts',
      });
    });

    it('creates edges for allOf composition', () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            Base: { type: 'object', properties: { id: { type: 'integer' } } },
            Extended: {
              allOf: [
                { $ref: '#/components/schemas/Base' },
                { type: 'object', properties: { name: { type: 'string' } } },
              ],
            },
          },
        },
      };

      const result = buildGraphData(spec);

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toEqual({
        source: 'Extended',
        target: 'Base',
        type: 'allOf',
      });
    });

    it('creates edges for oneOf/anyOf composition', () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            Cat: { type: 'object', properties: { meow: { type: 'boolean' } } },
            Dog: { type: 'object', properties: { bark: { type: 'boolean' } } },
            Pet: {
              oneOf: [
                { $ref: '#/components/schemas/Cat' },
                { $ref: '#/components/schemas/Dog' },
              ],
            },
          },
        },
      };

      const result = buildGraphData(spec);

      expect(result.edges).toHaveLength(2);
      expect(result.edges).toContainEqual({
        source: 'Pet',
        target: 'Cat',
        type: 'oneOf',
      });
      expect(result.edges).toContainEqual({
        source: 'Pet',
        target: 'Dog',
        type: 'oneOf',
      });
    });

    it('marks referenced schemas correctly', () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                post: { $ref: '#/components/schemas/Post' },
              },
            },
            Post: { type: 'object' },
            Orphan: { type: 'object' },
          },
        },
      };

      const result = buildGraphData(spec);

      const userNode = result.nodes.find((n) => n.id === 'User');
      const postNode = result.nodes.find((n) => n.id === 'Post');
      const orphanNode = result.nodes.find((n) => n.id === 'Orphan');

      expect(userNode?.referenced).toBe(false);
      expect(postNode?.referenced).toBe(true);
      expect(orphanNode?.referenced).toBe(false);
    });

    it('includes endpoints when requested', () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            User: { type: 'object' },
          },
        },
      };

      const result = buildGraphData(spec, true);

      expect(result.nodes).toHaveLength(2);
      const endpointNode = result.nodes.find((n) => n.type === 'endpoint');
      expect(endpointNode).toBeDefined();
      expect(endpointNode?.label).toBe('GET /users');

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe('/users.GET');
      expect(result.edges[0].target).toBe('User');
    });

    it('sets correct jsonPath for nodes', () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            User: { type: 'object' },
          },
        },
      };

      const result = buildGraphData(spec);

      expect(result.nodes[0].jsonPath).toBe('components.schemas.User');
    });

    it('extracts schema properties with types and required flags', () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            User: {
              type: 'object',
              required: ['id', 'email'],
              properties: {
                id: { type: 'integer' },
                email: { type: 'string' },
                name: { type: 'string' },
                posts: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Post' },
                },
                role: { $ref: '#/components/schemas/Role' },
              },
            },
            Post: { type: 'object' },
            Role: { type: 'string', enum: ['admin', 'user'] },
          },
        },
      };

      const result = buildGraphData(spec);
      const userNode = result.nodes.find((n) => n.id === 'User');

      expect(userNode?.properties).toBeDefined();
      expect(userNode?.properties).toHaveLength(5);

      const idProp = userNode?.properties?.find((p) => p.name === 'id');
      expect(idProp?.type).toBe('integer');
      expect(idProp?.required).toBe(true);

      const nameProp = userNode?.properties?.find((p) => p.name === 'name');
      expect(nameProp?.required).toBe(false);

      const postsProp = userNode?.properties?.find((p) => p.name === 'posts');
      expect(postsProp?.type).toBe('Post[]');
      expect(postsProp?.refTarget).toBe('Post');

      const roleProp = userNode?.properties?.find((p) => p.name === 'role');
      expect(roleProp?.type).toBe('Role');
      expect(roleProp?.refTarget).toBe('Role');
    });
  });

  describe('filterGraphData', () => {
    const testData = {
      nodes: [
        { id: 'A', type: 'schema' as const, label: 'A', jsonPath: 'a', referenced: true },
        { id: 'B', type: 'schema' as const, label: 'B', jsonPath: 'b', referenced: false },
        { id: 'C', type: 'endpoint' as const, label: 'C', jsonPath: 'c', referenced: true },
      ],
      edges: [
        { source: 'C', target: 'A', type: 'ref' as const },
      ],
    };

    it('returns all data when filter is "all"', () => {
      const result = filterGraphData(testData, 'all');
      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(1);
    });

    it('filters to referenced schemas only', () => {
      const result = filterGraphData(testData, 'referenced');
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.map((n) => n.id)).toContain('A');
      expect(result.nodes.map((n) => n.id)).toContain('C');
      expect(result.nodes.map((n) => n.id)).not.toContain('B');
    });

    it('filters to orphaned schemas only', () => {
      const result = filterGraphData(testData, 'orphaned');
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.map((n) => n.id)).toContain('B');
      expect(result.nodes.map((n) => n.id)).toContain('C');
      expect(result.nodes.map((n) => n.id)).not.toContain('A');
    });

    it('removes edges when nodes are filtered out', () => {
      const result = filterGraphData(testData, 'orphaned');
      expect(result.edges).toHaveLength(0);
    });
  });
});
