import type { OpenAPIV3 } from 'openapi-types';
import { diff as deepDiff, type Diff } from 'deep-diff';
import type { DiffChange, DiffResult, DiffSummary, DiffChangeType } from '../store';

type DiffKind = 'N' | 'D' | 'E' | 'A';

function diffKindToChangeType(kind: DiffKind): DiffChangeType {
  switch (kind) {
    case 'N':
      return 'added';
    case 'D':
      return 'removed';
    case 'E':
    case 'A':
      return 'modified';
  }
}

function pathToString(path: (string | number)[] | undefined): string {
  if (!path) return '';
  return path.join('.');
}

function isSchemaReferenced(spec: OpenAPIV3.Document, schemaName: string): boolean {
  const refPattern = `#/components/schemas/${schemaName}`;
  const specString = JSON.stringify(spec);
  return specString.includes(refPattern);
}

interface BreakingChangeRule {
  pattern: RegExp;
  check: (
    change: Diff<unknown, unknown>,
    oldSpec: OpenAPIV3.Document,
    newSpec: OpenAPIV3.Document
  ) => { breaking: boolean; reason?: string };
}

const breakingChangeRules: BreakingChangeRule[] = [
  {
    pattern: /^paths\.([^.]+)$/,
    check: (change) => {
      if (change.kind === 'D') {
        return { breaking: true, reason: 'Removed endpoint path' };
      }
      return { breaking: false };
    },
  },
  {
    pattern: /^paths\.([^.]+)\.(get|post|put|patch|delete|options|head|trace)$/,
    check: (change) => {
      if (change.kind === 'D') {
        return { breaking: true, reason: 'Removed operation' };
      }
      return { breaking: false };
    },
  },
  {
    pattern: /^paths\.([^.]+)\.(get|post|put|patch|delete|options|head|trace)\.parameters\.(\d+)$/,
    check: (change, _oldSpec, newSpec) => {
      if (change.kind === 'N' && change.path) {
        const pathParts = change.path;
        const pathKey = pathParts[1] as string;
        const method = pathParts[2] as string;
        const paramIndex = pathParts[4] as number;

        const pathItem = newSpec.paths?.[pathKey];
        if (!pathItem) return { breaking: false };

        const operation = pathItem[method as keyof OpenAPIV3.PathItemObject] as
          | OpenAPIV3.OperationObject
          | undefined;
        if (!operation?.parameters) return { breaking: false };

        const param = operation.parameters[paramIndex];
        if (param && !('$ref' in param) && param.required) {
          return { breaking: true, reason: `Added required parameter: ${param.name}` };
        }
      }
      return { breaking: false };
    },
  },
  {
    pattern: /^paths\.([^.]+)\.(get|post|put|patch|delete|options|head|trace)\.responses\.(2\d{2}|default)$/,
    check: (change) => {
      if (change.kind === 'D') {
        return { breaking: true, reason: 'Removed success response' };
      }
      return { breaking: false };
    },
  },
  {
    pattern: /^components\.schemas\.([^.]+)$/,
    check: (change, oldSpec) => {
      if (change.kind === 'D' && change.path) {
        const schemaName = change.path[2] as string;
        if (isSchemaReferenced(oldSpec, schemaName)) {
          return { breaking: true, reason: 'Removed referenced schema' };
        }
      }
      return { breaking: false };
    },
  },
  {
    pattern: /^paths\.([^.]+)\.(get|post|put|patch|delete|options|head|trace)\.parameters\.(\d+)\.schema\.type$/,
    check: (change) => {
      if (change.kind === 'E') {
        return { breaking: true, reason: `Changed parameter type from ${change.lhs} to ${change.rhs}` };
      }
      return { breaking: false };
    },
  },
  {
    pattern: /^components\.schemas\.([^.]+)\.properties\.([^.]+)$/,
    check: (change) => {
      if (change.kind === 'D') {
        return { breaking: true, reason: 'Removed schema property' };
      }
      return { breaking: false };
    },
  },
  {
    pattern: /^components\.schemas\.([^.]+)\.required$/,
    check: (change) => {
      if (change.kind === 'A' && change.item?.kind === 'N') {
        return { breaking: true, reason: `Made property required: ${change.item.rhs}` };
      }
      return { breaking: false };
    },
  },
];

function checkBreakingChange(
  change: Diff<unknown, unknown>,
  oldSpec: OpenAPIV3.Document,
  newSpec: OpenAPIV3.Document
): { breaking: boolean; reason?: string } {
  const path = pathToString(change.path);

  for (const rule of breakingChangeRules) {
    if (rule.pattern.test(path)) {
      const result = rule.check(change, oldSpec, newSpec);
      if (result.breaking) {
        return result;
      }
    }
  }

  return { breaking: false };
}

function isNonBreakingPath(path: string): boolean {
  const nonBreakingPatterns = [
    /\.description$/,
    /\.summary$/,
    /\.examples?$/,
    /\.externalDocs$/,
    /\.deprecated$/,
    /^info\./,
    /^servers\./,
    /^tags\./,
    /^externalDocs\./,
  ];

  return nonBreakingPatterns.some((pattern) => pattern.test(path));
}

export function computeDiff(
  oldSpec: OpenAPIV3.Document,
  newSpec: OpenAPIV3.Document
): DiffResult {
  const differences = deepDiff(oldSpec, newSpec) ?? [];
  const changes: DiffChange[] = [];

  for (const diff of differences) {
    const path = pathToString(diff.path);
    const changeType = diffKindToChangeType(diff.kind);

    if (isNonBreakingPath(path)) {
      changes.push({
        path,
        type: changeType,
        breaking: false,
        oldValue: 'lhs' in diff ? diff.lhs : undefined,
        newValue: 'rhs' in diff ? diff.rhs : undefined,
        jsonPathOld: path,
        jsonPathNew: path,
      });
      continue;
    }

    const breakingResult = checkBreakingChange(diff, oldSpec, newSpec);

    changes.push({
      path,
      type: changeType,
      breaking: breakingResult.breaking,
      breakingReason: breakingResult.reason,
      oldValue: 'lhs' in diff ? diff.lhs : undefined,
      newValue: 'rhs' in diff ? diff.rhs : undefined,
      jsonPathOld: path,
      jsonPathNew: path,
    });
  }

  const consolidatedChanges = consolidateChanges(changes);

  const summary: DiffSummary = {
    added: consolidatedChanges.filter((c) => c.type === 'added').length,
    removed: consolidatedChanges.filter((c) => c.type === 'removed').length,
    modified: consolidatedChanges.filter((c) => c.type === 'modified').length,
    breaking: consolidatedChanges.filter((c) => c.breaking).length,
    nonBreaking: consolidatedChanges.filter((c) => !c.breaking).length,
  };

  return { changes: consolidatedChanges, summary };
}

function consolidateChanges(changes: DiffChange[]): DiffChange[] {
  const pathMap = new Map<string, DiffChange>();

  for (const change of changes) {
    const basePath = getBasePath(change.path);

    if (!pathMap.has(basePath)) {
      pathMap.set(basePath, change);
    } else {
      const existing = pathMap.get(basePath)!;
      if (change.breaking && !existing.breaking) {
        pathMap.set(basePath, change);
      }
    }
  }

  return Array.from(pathMap.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function getBasePath(path: string): string {
  const parts = path.split('.');

  if (path.startsWith('paths.')) {
    if (parts.length >= 3) {
      const method = parts[2];
      if (['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'].includes(method)) {
        return parts.slice(0, 3).join('.');
      }
    }
    return parts.slice(0, 2).join('.');
  }

  if (path.startsWith('components.schemas.')) {
    return parts.slice(0, 3).join('.');
  }

  return path;
}

export function filterDiffChanges(
  changes: DiffChange[],
  filter: 'all' | 'breaking' | 'non-breaking'
): DiffChange[] {
  if (filter === 'all') return changes;
  if (filter === 'breaking') return changes.filter((c) => c.breaking);
  return changes.filter((c) => !c.breaking);
}

export function generateChangelog(result: DiffResult): string {
  const lines: string[] = [];
  const now = new Date().toISOString().split('T')[0];

  lines.push(`# API Changelog - ${now}`);
  lines.push('');

  if (result.summary.breaking > 0) {
    lines.push('## Breaking Changes');
    lines.push('');
    for (const change of result.changes.filter((c) => c.breaking)) {
      const icon = change.type === 'removed' ? '- Removed' : '- Changed';
      lines.push(`${icon}: \`${change.path}\``);
      if (change.breakingReason) {
        lines.push(`  - ${change.breakingReason}`);
      }
    }
    lines.push('');
  }

  const addedChanges = result.changes.filter((c) => c.type === 'added' && !c.breaking);
  if (addedChanges.length > 0) {
    lines.push('## Added');
    lines.push('');
    for (const change of addedChanges) {
      lines.push(`- \`${change.path}\``);
    }
    lines.push('');
  }

  const modifiedChanges = result.changes.filter((c) => c.type === 'modified' && !c.breaking);
  if (modifiedChanges.length > 0) {
    lines.push('## Modified');
    lines.push('');
    for (const change of modifiedChanges) {
      lines.push(`- \`${change.path}\``);
    }
    lines.push('');
  }

  const removedChanges = result.changes.filter((c) => c.type === 'removed' && !c.breaking);
  if (removedChanges.length > 0) {
    lines.push('## Removed');
    lines.push('');
    for (const change of removedChanges) {
      lines.push(`- \`${change.path}\``);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Summary: ${result.summary.added} added, ${result.summary.removed} removed, ${result.summary.modified} modified (${result.summary.breaking} breaking)*`);

  return lines.join('\n');
}
