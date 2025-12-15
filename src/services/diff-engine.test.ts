import { describe, it, expect } from 'vitest';
import type { OpenAPIV3 } from 'openapi-types';
import { computeDiff, filterDiffChanges, generateChangelog } from './diff-engine';

describe('diff-engine', () => {
  describe('computeDiff', () => {
    const baseSpec: OpenAPIV3.Document = {
      openapi: '3.0.3',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users': {
          get: {
            responses: {
              '200': { description: 'OK' },
            },
          },
        },
      },
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        },
      },
    };

    it('detects no changes when specs are identical', () => {
      const result = computeDiff(baseSpec, baseSpec);
      expect(result.changes).toHaveLength(0);
      expect(result.summary.added).toBe(0);
      expect(result.summary.removed).toBe(0);
      expect(result.summary.modified).toBe(0);
    });

    it('detects added path as non-breaking', () => {
      const newSpec: OpenAPIV3.Document = {
        ...baseSpec,
        paths: {
          ...baseSpec.paths,
          '/posts': {
            get: {
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const result = computeDiff(baseSpec, newSpec);

      expect(result.summary.added).toBeGreaterThan(0);
      const addedPath = result.changes.find((c) => c.path.includes('/posts'));
      expect(addedPath?.breaking).toBe(false);
    });

    it('detects removed path as breaking', () => {
      const newSpec: OpenAPIV3.Document = {
        ...baseSpec,
        paths: {},
      };

      const result = computeDiff(baseSpec, newSpec);

      expect(result.summary.breaking).toBeGreaterThan(0);
      const removedPath = result.changes.find(
        (c) => c.path.includes('/users') && c.type === 'removed'
      );
      expect(removedPath?.breaking).toBe(true);
    });

    it('detects removed operation as breaking', () => {
      const newSpec: OpenAPIV3.Document = {
        ...baseSpec,
        paths: {
          '/users': {},
        },
      };

      const result = computeDiff(baseSpec, newSpec);

      const breakingChanges = result.changes.filter((c) => c.breaking);
      expect(breakingChanges.length).toBeGreaterThan(0);
    });

    it('detects removed schema property as breaking', () => {
      const newSpec: OpenAPIV3.Document = {
        ...baseSpec,
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
              },
            },
          },
        },
      };

      const result = computeDiff(baseSpec, newSpec);

      const breakingChange = result.changes.find(
        (c) => c.breaking && c.path.includes('name')
      );
      expect(breakingChange).toBeDefined();
      expect(breakingChange?.breakingReason).toContain('Removed schema property');
    });

    it('marks description changes as non-breaking', () => {
      const newSpec: OpenAPIV3.Document = {
        ...baseSpec,
        info: {
          ...baseSpec.info,
          description: 'New description',
        },
      };

      const result = computeDiff(baseSpec, newSpec);

      const descChange = result.changes.find((c) =>
        c.path.includes('description')
      );
      expect(descChange?.breaking).toBe(false);
    });

    it('provides correct summary counts', () => {
      const newSpec: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test API', version: '2.0.0' },
        paths: {
          '/posts': {
            get: { responses: { '200': { description: 'OK' } } },
          },
        },
        components: {
          schemas: {
            Post: { type: 'object' },
          },
        },
      };

      const result = computeDiff(baseSpec, newSpec);

      expect(result.summary.added).toBeGreaterThan(0);
      expect(result.summary.removed).toBeGreaterThan(0);
      expect(result.summary.breaking + result.summary.nonBreaking).toBe(
        result.changes.length
      );
    });
  });

  describe('filterDiffChanges', () => {
    const testChanges = [
      { path: 'a', type: 'added' as const, breaking: false },
      { path: 'b', type: 'removed' as const, breaking: true, breakingReason: 'Removed' },
      { path: 'c', type: 'modified' as const, breaking: false },
    ];

    it('returns all changes when filter is "all"', () => {
      const result = filterDiffChanges(testChanges, 'all');
      expect(result).toHaveLength(3);
    });

    it('filters to breaking changes only', () => {
      const result = filterDiffChanges(testChanges, 'breaking');
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('b');
    });

    it('filters to non-breaking changes only', () => {
      const result = filterDiffChanges(testChanges, 'non-breaking');
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.path)).toContain('a');
      expect(result.map((c) => c.path)).toContain('c');
    });
  });

  describe('generateChangelog', () => {
    it('generates markdown changelog', () => {
      const result = {
        changes: [
          { path: 'paths./users.get', type: 'removed' as const, breaking: true, breakingReason: 'Removed endpoint' },
          { path: 'paths./posts.get', type: 'added' as const, breaking: false },
          { path: 'info.description', type: 'modified' as const, breaking: false },
        ],
        summary: {
          added: 1,
          removed: 1,
          modified: 1,
          breaking: 1,
          nonBreaking: 2,
        },
      };

      const changelog = generateChangelog(result);

      expect(changelog).toContain('# API Changelog');
      expect(changelog).toContain('## Breaking Changes');
      expect(changelog).toContain('paths./users.get');
      expect(changelog).toContain('Removed endpoint');
      expect(changelog).toContain('## Added');
      expect(changelog).toContain('paths./posts.get');
      expect(changelog).toContain('## Modified');
      expect(changelog).toContain('info.description');
      expect(changelog).toContain('1 added, 1 removed, 1 modified (1 breaking)');
    });

    it('omits sections with no changes', () => {
      const result = {
        changes: [
          { path: 'paths./posts.get', type: 'added' as const, breaking: false },
        ],
        summary: {
          added: 1,
          removed: 0,
          modified: 0,
          breaking: 0,
          nonBreaking: 1,
        },
      };

      const changelog = generateChangelog(result);

      expect(changelog).toContain('## Added');
      expect(changelog).not.toContain('## Breaking Changes');
      expect(changelog).not.toContain('## Removed');
      expect(changelog).not.toContain('## Modified');
    });
  });
});
