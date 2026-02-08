import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import {
  offsetToPosition,
  buildLineIndex,
  offsetToPositionFast,
  buildYamlSourceMap,
  buildJsonSourceMap,
  extractPositionFromError,
  getPathAtLine,
} from './source-map';

describe('offsetToPosition', () => {
  it('returns line 1, column 1 for offset 0', () => {
    expect(offsetToPosition('hello\nworld', 0)).toEqual({ line: 1, column: 1 });
  });

  it('calculates position within the first line', () => {
    expect(offsetToPosition('hello\nworld', 3)).toEqual({ line: 1, column: 4 });
  });

  it('calculates position at the start of the second line', () => {
    expect(offsetToPosition('hello\nworld', 6)).toEqual({ line: 2, column: 1 });
  });

  it('calculates position within the second line', () => {
    expect(offsetToPosition('hello\nworld', 8)).toEqual({ line: 2, column: 3 });
  });

  it('handles empty content', () => {
    expect(offsetToPosition('', 0)).toEqual({ line: 1, column: 1 });
  });
});

describe('buildLineIndex', () => {
  it('returns [0] for empty content', () => {
    expect(buildLineIndex('')).toEqual([0]);
  });

  it('returns [0] for single line without newline', () => {
    expect(buildLineIndex('hello')).toEqual([0]);
  });

  it('builds correct index for multi-line content', () => {
    const content = 'line1\nline2\nline3';
    expect(buildLineIndex(content)).toEqual([0, 6, 12]);
  });

  it('handles trailing newline', () => {
    const content = 'line1\nline2\n';
    expect(buildLineIndex(content)).toEqual([0, 6, 12]);
  });
});

describe('offsetToPositionFast', () => {
  it('calculates position correctly using line index', () => {
    const lineStarts = [0, 6, 12];
    expect(offsetToPositionFast(0, lineStarts)).toEqual({ line: 1, column: 1 });
    expect(offsetToPositionFast(3, lineStarts)).toEqual({ line: 1, column: 4 });
    expect(offsetToPositionFast(6, lineStarts)).toEqual({ line: 2, column: 1 });
    expect(offsetToPositionFast(8, lineStarts)).toEqual({ line: 2, column: 3 });
    expect(offsetToPositionFast(12, lineStarts)).toEqual({ line: 3, column: 1 });
  });
});

describe('buildYamlSourceMap', () => {
  it('maps top-level keys', () => {
    const yaml = `openapi: "3.0.0"
info:
  title: Test API
  version: "1.0.0"`;
    const doc = YAML.parseDocument(yaml, { keepSourceTokens: true });
    const sourceMap = buildYamlSourceMap(doc);

    expect(sourceMap['openapi']).toBeDefined();
    expect(sourceMap['info']).toBeDefined();
  });

  it('maps nested keys', () => {
    const yaml = `openapi: "3.0.0"
info:
  title: Test API
paths:
  /users:
    get:
      summary: Get users`;
    const doc = YAML.parseDocument(yaml, { keepSourceTokens: true });
    const sourceMap = buildYamlSourceMap(doc);

    expect(sourceMap['paths']).toBeDefined();
    expect(sourceMap['paths./users']).toBeDefined();
  });

  it('handles empty document', () => {
    const doc = YAML.parseDocument('', { keepSourceTokens: true });
    const sourceMap = buildYamlSourceMap(doc);
    expect(sourceMap).toEqual({});
  });
});

describe('buildJsonSourceMap', () => {
  it('maps top-level keys', () => {
    const json = `{
  "openapi": "3.0.0",
  "info": {
    "title": "Test API"
  }
}`;
    const sourceMap = buildJsonSourceMap(json);

    // The JSON source map implementation captures keys - check that some keys exist
    expect(Object.keys(sourceMap).length).toBeGreaterThan(0);
  });

  it('maps nested keys', () => {
    const json = `{
  "paths": {
    "/users": {
      "get": {
        "summary": "Get users"
      }
    }
  }
}`;
    const sourceMap = buildJsonSourceMap(json);

    // Check that paths key is captured
    expect(Object.keys(sourceMap).some(k => k.startsWith('paths'))).toBe(true);
  });
});

describe('extractPositionFromError', () => {
  it('extracts position from error with JSON pointer', () => {
    // ~1 decodes to / which then becomes ., so paths/~1users/get becomes paths..users.get
    const sourceMap = {
      'paths..users.get': { line: 10, column: 5 },
    };
    const message = 'Error at #/paths/~1users/get';
    const position = extractPositionFromError(message, sourceMap);
    expect(position).toEqual({ line: 10, column: 5 });
  });

  it('extracts position from error with simple path', () => {
    const sourceMap = {
      'components.schemas.Pet': { line: 20, column: 3 },
    };
    const message = 'Error at #/components/schemas/Pet';
    const position = extractPositionFromError(message, sourceMap);
    expect(position).toEqual({ line: 20, column: 3 });
  });

  it('falls back to parent path if exact path not found', () => {
    const sourceMap = {
      'paths': { line: 5, column: 1 },
    };
    const message = 'Error at #/paths/users/get/responses';
    const position = extractPositionFromError(message, sourceMap);
    expect(position).toEqual({ line: 5, column: 1 });
  });

  it('returns line 1, column 1 if no path found', () => {
    const sourceMap = {};
    const message = 'Some error without path';
    const position = extractPositionFromError(message, sourceMap);
    expect(position).toEqual({ line: 1, column: 1 });
  });

  it('decodes tilde escapes in JSON pointers', () => {
    // ~0 decodes to ~ and ~1 decodes to / which becomes .
    // So paths/~1users~0special becomes paths..users~special
    const sourceMap = {
      'paths..users~special': { line: 15, column: 3 },
    };
    const message = 'Error at #/paths/~1users~0special';
    const position = extractPositionFromError(message, sourceMap);
    expect(position).toEqual({ line: 15, column: 3 });
  });
});

describe('getPathAtLine', () => {
  const sourceMap = {
    'paths': { line: 5, column: 1 },
    'paths./users': { line: 6, column: 3 },
    'paths./users.get': { line: 7, column: 5 },
    'paths./users.post': { line: 15, column: 5 },
    'components': { line: 25, column: 1 },
    'components.schemas': { line: 26, column: 3 },
    'components.schemas.User': { line: 27, column: 5 },
    'components.schemas.Error': { line: 40, column: 5 },
  };

  it('returns null for empty source map', () => {
    expect(getPathAtLine({}, 1)).toBeNull();
  });

  it('returns null when line is before all entries', () => {
    expect(getPathAtLine(sourceMap, 1)).toBeNull();
  });

  it('returns exact match', () => {
    expect(getPathAtLine(sourceMap, 7)).toBe('paths./users.get');
  });

  it('returns the most specific path for a line between entries', () => {
    // Line 10 is between paths./users.get (line 7) and paths./users.post (line 15)
    expect(getPathAtLine(sourceMap, 10)).toBe('paths./users.get');
  });

  it('returns deepest path when multiple entries share the same line', () => {
    // If we add an entry at the same line, the longer (more specific) path should win
    const mapWithSameLine = {
      'paths': { line: 5, column: 1 },
      'paths./users': { line: 5, column: 3 },
    };
    expect(getPathAtLine(mapWithSameLine, 5)).toBe('paths./users');
  });

  it('returns last entry for lines past the end', () => {
    expect(getPathAtLine(sourceMap, 100)).toBe('components.schemas.Error');
  });

  it('returns the correct path at section boundaries', () => {
    // Line 25 is exactly at "components"
    expect(getPathAtLine(sourceMap, 25)).toBe('components');
    // Line 27 is exactly at "components.schemas.User"
    expect(getPathAtLine(sourceMap, 27)).toBe('components.schemas.User');
  });
});
