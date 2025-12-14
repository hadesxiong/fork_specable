import { useMemo, useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Globe, Box, Shield, Server } from 'lucide-react';
import { useEditorStore } from '../../store';
import type { OpenAPIV3 } from 'openapi-types';

interface OutlineNode {
  id: string;
  label: string;
  kind: 'paths' | 'path' | 'operation' | 'schemas' | 'schema' | 'security' | 'servers';
  children?: OutlineNode[];
  line?: number;
  method?: string;
  deprecated?: boolean;
}

const METHOD_COLOURS: Record<string, string> = {
  get: 'text-teal-400',
  post: 'text-blue-400',
  put: 'text-orange-400',
  patch: 'text-yellow-400',
  delete: 'text-red-500',
  options: 'text-zinc-600',
  head: 'text-zinc-600',
};

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  paths: Globe,
  schemas: Box,
  security: Shield,
  servers: Server,
};

export function OutlineView() {
  const parsedSpec = useEditorStore((state) => state.parsedSpec);
  const sourceMap = useEditorStore((state) => state.sourceMap);
  const goToLine = useEditorStore((state) => state.goToLine);

  const [expanded, setExpanded] = useState<Set<string>>(new Set(['paths', 'schemas']));
  const [filter, setFilter] = useState('');

  const outline = useMemo(() => {
    if (!parsedSpec) return [];
    return buildOutlineTree(parsedSpec, sourceMap);
  }, [parsedSpec, sourceMap]);

  const filteredOutline = useMemo(() => {
    if (!filter) return outline;
    return filterOutline(outline, filter.toLowerCase());
  }, [outline, filter]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleClick = useCallback((node: OutlineNode) => {
    if (node.children && node.children.length > 0) {
      toggleExpanded(node.id);
    }
    if (node.line) {
      goToLine(node.line);
    }
  }, [toggleExpanded, goToLine]);

  const renderNode = (node: OutlineNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const Icon = KIND_ICONS[node.kind] ?? Globe;

    return (
      <li
        key={node.id}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={false}
      >
        <div
          className={`
            flex items-center gap-1 px-2 py-1 cursor-pointer rounded
            hover:bg-zinc-800 transition-colors
            ${node.deprecated ? 'line-through opacity-60' : ''}
          `}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => handleClick(node)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick(node);
            }
          }}
          aria-label={node.method ? `${node.method.toUpperCase()} ${node.label}` : node.label}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 shrink-0 text-zinc-500" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0 text-zinc-500" aria-hidden="true" />
            )
          ) : (
            <span className="w-4 shrink-0" aria-hidden="true" />
          )}

          {node.method ? (
            <span className={`text-xs font-mono font-bold shrink-0 w-14 ${METHOD_COLOURS[node.method]}`} aria-hidden="true">
              {node.method.toUpperCase()}
            </span>
          ) : (
            <Icon className="w-4 h-4 shrink-0 text-zinc-500" aria-hidden="true" />
          )}

          <span className="text-sm text-zinc-200 truncate">
            {node.label}
          </span>
        </div>

        {hasChildren && isExpanded && (
          <ul role="group">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  if (!parsedSpec) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-900 text-zinc-400 text-sm">
        No valid specification
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      <div className="p-2 border-b border-zinc-700">
        <input
          type="text"
          placeholder="Filter outline..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          aria-label="Filter outline"
        />
      </div>
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Specification outline">
        {filteredOutline.length === 0 ? (
          <div className="px-4 py-2 text-sm text-zinc-500" role="status">
            {filter ? 'No matches found' : 'Empty specification'}
          </div>
        ) : (
          <ul role="tree" aria-label="Specification structure">
            {filteredOutline.map((node) => renderNode(node))}
          </ul>
        )}
      </nav>
    </div>
  );
}

function buildOutlineTree(spec: OpenAPIV3.Document, sourceMap: Record<string, { line: number; column: number }>): OutlineNode[] {
  const nodes: OutlineNode[] = [];

  // Paths section
  if (spec.paths && Object.keys(spec.paths).length > 0) {
    const pathNodes: OutlineNode[] = [];

    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem) continue;

      const operations: OutlineNode[] = [];
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

      for (const method of methods) {
        const operation = (pathItem as Record<string, unknown>)[method] as OpenAPIV3.OperationObject | undefined;
        if (operation) {
          const opPath = `paths.${pathKey}.${method}`;
          operations.push({
            id: `${pathKey}-${method}`,
            label: operation.summary || operation.operationId || pathKey,
            kind: 'operation',
            method,
            line: sourceMap[opPath]?.line,
            deprecated: operation.deprecated,
          });
        }
      }

      const pathPath = `paths.${pathKey}`;
      pathNodes.push({
        id: pathKey,
        label: pathKey,
        kind: 'path',
        children: operations.length > 0 ? operations : undefined,
        line: sourceMap[pathPath]?.line,
      });
    }

    nodes.push({
      id: 'paths',
      label: `Paths (${pathNodes.length})`,
      kind: 'paths',
      children: pathNodes,
    });
  }

  // Schemas section
  if (spec.components?.schemas && Object.keys(spec.components.schemas).length > 0) {
    const schemaNodes: OutlineNode[] = Object.entries(spec.components.schemas).map(([name, schema]) => {
      const schemaPath = `components.schemas.${name}`;
      return {
        id: `schema-${name}`,
        label: name,
        kind: 'schema' as const,
        line: sourceMap[schemaPath]?.line,
        deprecated: (schema as Record<string, unknown>).deprecated as boolean | undefined,
      };
    });

    nodes.push({
      id: 'schemas',
      label: `Schemas (${schemaNodes.length})`,
      kind: 'schemas',
      children: schemaNodes,
    });
  }

  // Security schemes
  if (spec.components?.securitySchemes && Object.keys(spec.components.securitySchemes).length > 0) {
    const securityNodes: OutlineNode[] = Object.keys(spec.components.securitySchemes).map((name) => {
      const secPath = `components.securitySchemes.${name}`;
      return {
        id: `security-${name}`,
        label: name,
        kind: 'security' as const,
        line: sourceMap[secPath]?.line,
      };
    });

    nodes.push({
      id: 'security',
      label: `Security (${securityNodes.length})`,
      kind: 'security',
      children: securityNodes,
    });
  }

  // Servers
  if (spec.servers && spec.servers.length > 0) {
    const serverNodes: OutlineNode[] = spec.servers.map((server, index) => {
      const serverPath = `servers.${index}`;
      return {
        id: `server-${index}`,
        label: server.url,
        kind: 'servers' as const,
        line: sourceMap[serverPath]?.line,
      };
    });

    nodes.push({
      id: 'servers',
      label: `Servers (${serverNodes.length})`,
      kind: 'servers',
      children: serverNodes,
    });
  }

  return nodes;
}

function filterOutline(nodes: OutlineNode[], query: string): OutlineNode[] {
  return nodes
    .map((node) => {
      if (node.children) {
        const filteredChildren = filterOutline(node.children, query);
        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
      }
      if (node.label.toLowerCase().includes(query)) {
        return node;
      }
      return null;
    })
    .filter((node): node is OutlineNode => node !== null);
}
