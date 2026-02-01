import * as yaml from 'yaml';

/**
 * Detects whether content is JSON or YAML based on filename and content.
 */
export function detectLanguage(filename: string, content: string): 'yaml' | 'json' {
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) return 'yaml';
  // Try to detect from content
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'yaml';
}

/**
 * Parses content as JSON or YAML, auto-detecting the format.
 */
export function parseContent(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(content);
  }
  return yaml.parse(content);
}

/**
 * Stringifies content to JSON format.
 */
export function stringifyAsJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Stringifies content to YAML format.
 */
export function stringifyAsYaml(data: unknown): string {
  return yaml.stringify(data);
}
