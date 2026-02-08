import YAML from 'yaml';
import type { SourceMap, SourcePosition } from '../workers/types';

/**
 * Converts a character offset to a line/column position.
 */
export function offsetToPosition(content: string, offset: number): SourcePosition {
  const lines = content.slice(0, offset).split('\n');
  return {
    line: lines.length,
    column: (lines[lines.length - 1]?.length ?? 0) + 1,
  };
}

/**
 * Builds an index of line start offsets for efficient position lookups.
 */
export function buildLineIndex(content: string): number[] {
  const lineStarts: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      lineStarts.push(i + 1);
    }
  }
  return lineStarts;
}

/**
 * Converts a character offset to a line/column position using a pre-built line index.
 */
export function offsetToPositionFast(offset: number, lineStarts: number[]): SourcePosition {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (lineStarts[mid] <= offset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return {
    line: low + 1,
    column: offset - lineStarts[low] + 1,
  };
}

/**
 * Builds a source map from a YAML document.
 */
export function buildYamlSourceMap(doc: YAML.Document): SourceMap {
  const sourceMap: SourceMap = {};
  const content = doc.toString();
  const lineStarts = buildLineIndex(content);
  const maxDepth = 4;

  const visit = (node: unknown, path: string[], depth: number) => {
    if (!node || typeof node !== 'object' || depth > maxDepth) return;

    const yamlNode = node as YAML.YAMLMap | YAML.YAMLSeq | YAML.Scalar | YAML.Pair;

    if ('range' in yamlNode && yamlNode.range) {
      const [start] = yamlNode.range;
      const pos = offsetToPositionFast(start, lineStarts);
      sourceMap[path.join('.')] = pos;
    }

    if (yamlNode instanceof YAML.YAMLMap || (yamlNode && 'items' in yamlNode && Array.isArray(yamlNode.items))) {
      const items = 'items' in yamlNode ? yamlNode.items : [];
      for (const item of items) {
        if (item && typeof item === 'object' && 'key' in item && 'value' in item) {
          const pair = item as YAML.Pair;
          const keyValue = pair.key;
          const key = keyValue && typeof keyValue === 'object' && 'value' in keyValue
            ? String(keyValue.value)
            : String(keyValue);
          visit(pair.value, [...path, key], depth + 1);
        }
      }
    }

    if (yamlNode instanceof YAML.YAMLSeq || (yamlNode && 'items' in yamlNode && Array.isArray(yamlNode.items) && !('key' in yamlNode))) {
      const items = 'items' in yamlNode ? yamlNode.items : [];
      const limit = Math.min(items.length, 100);
      for (let i = 0; i < limit; i++) {
        visit(items[i], [...path, String(i)], depth + 1);
      }
    }
  };

  visit(doc.contents, [], 0);
  return sourceMap;
}

/**
 * Builds a source map from JSON content.
 */
export function buildJsonSourceMap(content: string): SourceMap {
  const sourceMap: SourceMap = {};
  const lines = content.split('\n');

  const currentPath: string[] = [];
  let inString = false;
  let keyBuffer = '';
  let collectingKey = false;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    for (let col = 0; col < line.length; col++) {
      const char = line[col];

      if (char === '"' && (col === 0 || line[col - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          collectingKey = true;
          keyBuffer = '';
        } else {
          inString = false;
          if (collectingKey && keyBuffer) {
            currentPath.push(keyBuffer);
            sourceMap[currentPath.join('.')] = { line: lineNum + 1, column: col + 1 };
          }
          collectingKey = false;
        }
      } else if (inString && collectingKey) {
        keyBuffer += char;
      } else if (char === ':' && !inString) {
        collectingKey = false;
      } else if (char === ',' && !inString) {
        if (currentPath.length > 0) currentPath.pop();
      } else if ((char === '}' || char === ']') && !inString) {
        if (currentPath.length > 0) currentPath.pop();
      }
    }
  }

  return sourceMap;
}

/**
 * Find the source map path that contains the given line number.
 * Returns the deepest (most specific) path whose start line is <= the given line.
 */
export function getPathAtLine(sourceMap: SourceMap, line: number): string | null {
  const entries: [number, string][] = [];

  for (const [path, position] of Object.entries(sourceMap)) {
    entries.push([position.line, path]);
  }

  // Sort by line ascending; for equal lines, longer paths (more specific) come last
  entries.sort((a, b) => a[0] - b[0] || a[1].length - b[1].length);

  // Binary search for the last entry with line <= target
  let low = 0;
  let high = entries.length - 1;
  let result: string | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (entries[mid][0] <= line) {
      result = entries[mid][1];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

/**
 * Extracts a position from an error message that contains a JSON pointer path.
 */
export function extractPositionFromError(message: string, sourceMap: SourceMap): SourcePosition {
  const pathMatch = message.match(/at #\/([^\s]+)/);
  if (pathMatch) {
    const path = pathMatch[1]
      .replace(/~1/g, '/')
      .replace(/~0/g, '~')
      .replace(/\//g, '.');

    if (sourceMap[path]) {
      return sourceMap[path];
    }

    const parts = path.split('.');
    while (parts.length > 0) {
      parts.pop();
      const parentPath = parts.join('.');
      if (sourceMap[parentPath]) {
        return sourceMap[parentPath];
      }
    }
  }

  return { line: 1, column: 1 };
}
