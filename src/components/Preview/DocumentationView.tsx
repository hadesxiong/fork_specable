import { useCallback, useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEditorStore } from '../../store';
import type { OpenAPIV3 } from 'openapi-types';
import {
  CollapsibleSection,
  ParameterRow,
  RequestBodySection,
  ResponseSection,
  SecuritySection,
  SchemaDisplay,
} from './components';
import { Markdown } from './Markdown';
import { getComposition, resolveRef, type SchemaObject } from './schema-utils';

const METHOD_STYLES: Record<string, { bg: string; text: string }> = {
  get: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  post: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  put: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  patch: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  delete: { bg: 'bg-red-500/15', text: 'text-red-400' },
  options: { bg: 'bg-zinc-500/15', text: 'text-zinc-400' },
  head: { bg: 'bg-zinc-500/15', text: 'text-zinc-400' },
};

export function DocumentationView() {
  const parsedSpec = useEditorStore((state) => state.parsedSpec);
  const sourceMap = useEditorStore((state) => state.sourceMap);
  const goToLine = useEditorStore((state) => state.goToLine);
  const [filter, setFilter] = useState('');
  const [headerExpanded, setHeaderExpanded] = useState(true);

  const navigateToPath = useCallback((path: string) => {
    const position = sourceMap[path];
    if (position) {
      goToLine(position.line, position.column);
    }
  }, [sourceMap, goToLine]);

  const filteredPaths = useMemo(() => {
    if (!parsedSpec?.paths) return [];
    const entries = Object.entries(parsedSpec.paths);
    if (!filter) return entries;

    const lowerFilter = filter.toLowerCase();
    return entries.filter(([path, pathItem]) => {
      if (path.toLowerCase().includes(lowerFilter)) return true;

      const item = pathItem as OpenAPIV3.PathItemObject;
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;
      for (const method of methods) {
        const operation = (item as Record<string, unknown>)[method] as OpenAPIV3.OperationObject | undefined;
        if (operation) {
          if (operation.summary?.toLowerCase().includes(lowerFilter)) return true;
          if (operation.description?.toLowerCase().includes(lowerFilter)) return true;
          if (operation.operationId?.toLowerCase().includes(lowerFilter)) return true;
        }
      }
      return false;
    });
  }, [parsedSpec?.paths, filter]);

  const filteredSchemas = useMemo(() => {
    if (!parsedSpec?.components?.schemas) return [];
    const entries = Object.entries(parsedSpec.components.schemas);
    if (!filter) return entries;

    const lowerFilter = filter.toLowerCase();
    return entries.filter(([name, schema]) => {
      if (name.toLowerCase().includes(lowerFilter)) return true;
      const schemaObj = schema as OpenAPIV3.SchemaObject;
      if (schemaObj.description?.toLowerCase().includes(lowerFilter)) return true;
      return false;
    });
  }, [parsedSpec?.components?.schemas, filter]);

  if (!parsedSpec) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950 text-zinc-500">
        No valid specification to preview
      </div>
    );
  }

  const hasResults = filteredPaths.length > 0 || filteredSchemas.length > 0;

  const hasHeaderContent = parsedSpec.info.description || parsedSpec.servers?.[0];

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <header className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-medium text-zinc-100 tracking-tight">
            {parsedSpec.info.title}
          </h1>
          {hasHeaderContent && (
            <button
              onClick={() => setHeaderExpanded(!headerExpanded)}
              className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors shrink-0"
              aria-label={headerExpanded ? 'Collapse header' : 'Expand header'}
              aria-expanded={headerExpanded}
            >
              {headerExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {headerExpanded && (
          <>
            {parsedSpec.info.description && (
              <div className="mt-2 text-sm text-zinc-400 leading-relaxed">
                <Markdown>{parsedSpec.info.description}</Markdown>
              </div>
            )}
            <div className="flex gap-4 mt-3 text-xs">
              <span className="text-purple-400">
                v{parsedSpec.info.version}
              </span>
              {parsedSpec.servers?.[0] && (
                <span className="text-zinc-500 font-mono">
                  {parsedSpec.servers[0].url}
                </span>
              )}
            </div>
          </>
        )}

        {!headerExpanded && (
          <span className="text-xs text-purple-400 mt-1 block">
            v{parsedSpec.info.version}
          </span>
        )}

        <div className="mt-3">
          <input
            type="text"
            placeholder="Filter endpoints and schemas..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500"
            aria-label="Filter preview"
          />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasResults && filter && (
          <div className="text-center text-zinc-600 py-8">
            No matches found for "{filter}"
          </div>
        )}

        {/* Endpoints */}
        {filteredPaths.map(([path, pathItem]) => (
          <PathSection
            key={path}
            path={path}
            pathItem={pathItem as OpenAPIV3.PathItemObject}
            spec={parsedSpec}
            onNavigate={navigateToPath}
          />
        ))}

        {/* Schemas */}
        {filteredSchemas.length > 0 && (
          <div className="mt-8">
            <h2 className="text-base font-medium text-zinc-200 mb-4 pb-2 border-b border-zinc-800">
              Schemas ({filteredSchemas.length})
            </h2>
            <div className="space-y-3">
              {filteredSchemas.map(([name, schema]) => (
                <SchemaCard
                  key={name}
                  name={name}
                  schema={schema as OpenAPIV3.SchemaObject}
                  spec={parsedSpec}
                  onNavigate={() => navigateToPath(`components.schemas.${name}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PathSection({
  path,
  pathItem,
  spec,
  onNavigate,
}: {
  path: string;
  pathItem: OpenAPIV3.PathItemObject;
  spec: OpenAPIV3.Document;
  onNavigate: (path: string) => void;
}) {
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

  const operations = methods
    .filter((method) => (pathItem as Record<string, unknown>)[method])
    .map((method) => ({
      method,
      operation: (pathItem as Record<string, unknown>)[method] as OpenAPIV3.OperationObject,
    }));

  if (operations.length === 0) return null;

  return (
    <div className="rounded border border-zinc-700 overflow-hidden">
      {operations.map(({ method, operation }) => (
        <OperationCard
          key={method}
          method={method}
          path={path}
          operation={operation}
          spec={spec}
          onNavigate={() => onNavigate(`paths.${path}.${method}`)}
        />
      ))}
    </div>
  );
}

function OperationCard({
  method,
  path,
  operation,
  spec,
  onNavigate,
}: {
  method: string;
  path: string;
  operation: OpenAPIV3.OperationObject;
  spec: OpenAPIV3.Document;
  onNavigate: () => void;
}) {
  const style = METHOD_STYLES[method] ?? METHOD_STYLES.get;

  // Resolve parameter $refs
  const parameters = useMemo(() => {
    if (!operation.parameters) return [];
    return operation.parameters
      .map((param) => {
        if ('$ref' in param) {
          const resolved = resolveRef(param as SchemaObject, spec);
          return resolved?.schema as OpenAPIV3.ParameterObject | undefined;
        }
        return param as OpenAPIV3.ParameterObject;
      })
      .filter((p): p is OpenAPIV3.ParameterObject => p !== undefined);
  }, [operation.parameters, spec]);

  const hasParameters = parameters.length > 0;

  return (
    <div
      className={`p-3 border-b border-zinc-800 last:border-b-0 ${
        operation.deprecated ? 'opacity-60' : ''
      }`}
    >
      <div
        className="cursor-pointer hover:bg-zinc-800/50 -m-3 p-3 transition-colors"
        onClick={onNavigate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigate();
          }
        }}
      >
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${style.bg} ${style.text}`}>
            {method}
          </span>
          <code className="text-sm text-zinc-200 font-mono">
            {path}
          </code>
          {operation.deprecated && (
            <span className="px-1.5 py-0.5 bg-red-900/50 text-red-400 text-xs rounded">
              Deprecated
            </span>
          )}
        </div>

        {operation.summary && (
          <p className="mt-2 text-sm text-zinc-200">
            {operation.summary}
          </p>
        )}

        {operation.description && (
          <div className="mt-1 text-xs text-zinc-400">
            <Markdown>{operation.description}</Markdown>
          </div>
        )}
      </div>

      {/* Parameters */}
      {hasParameters && (
        <CollapsibleSection
          title="Parameters"
          defaultExpanded={parameters.length <= 3}
          badge={
            <span className="ml-2 px-1.5 py-0.5 bg-zinc-700 text-zinc-400 text-xs rounded">
              {parameters.length}
            </span>
          }
        >
          <div className="bg-zinc-800/50 rounded p-2">
            {parameters.map((param) => (
              <ParameterRow key={`${param.in}-${param.name}`} param={param} spec={spec} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Request Body */}
      {operation.requestBody && (
        <RequestBodySection
          requestBody={operation.requestBody as OpenAPIV3.RequestBodyObject}
          spec={spec}
        />
      )}

      {/* Responses */}
      {operation.responses && (
        <ResponseSection responses={operation.responses} spec={spec} />
      )}

      {/* Security */}
      {operation.security && operation.security.length > 0 && (
        <SecuritySection
          security={operation.security}
          securitySchemes={spec.components?.securitySchemes}
          spec={spec}
        />
      )}
    </div>
  );
}

function SchemaCard({
  name,
  schema,
  spec,
  onNavigate,
}: {
  name: string;
  schema: OpenAPIV3.SchemaObject;
  spec: OpenAPIV3.Document;
  onNavigate: () => void;
}) {
  const properties = schema.properties ? Object.entries(schema.properties) : [];
  const required = schema.required ?? [];
  const composition = getComposition(schema);
  const schemaType = composition
    ? composition.type
    : (schema.type ?? 'object');

  return (
    <div className="rounded border border-zinc-700 overflow-hidden">
      <div
        className="p-3 cursor-pointer hover:bg-zinc-800 transition-colors"
        onClick={onNavigate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigate();
          }
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-200">{name}</span>
          <span className="text-xs text-zinc-500">
            {schemaType}
          </span>
        </div>

        {schema.description && (
          <div className="mt-1 text-xs text-zinc-400">
            <Markdown>{schema.description}</Markdown>
          </div>
        )}
      </div>

      {(properties.length > 0 || composition) && (
        <div className="border-t border-zinc-700 p-3 bg-zinc-800/30">
          {composition && (
            <SchemaDisplay
              schema={schema as SchemaObject}
              spec={spec}
              depth={0}
              maxDepth={3}
            />
          )}
          {properties.length > 0 && !composition && (
            <>
              <div className="text-xs text-zinc-500 mb-2">Properties ({properties.length})</div>
              <div className="space-y-2">
                {properties.map(([propName, propSchema]) => {
                  const propObj = propSchema as OpenAPIV3.SchemaObject;
                  const isRequired = required.includes(propName);
                  const type = getPropertyType(propObj, spec);

                  return (
                    <div key={propName} className="flex items-start gap-2">
                      <span className="font-mono text-xs text-zinc-300 shrink-0">
                        {propName}
                        {isRequired && <span className="text-red-500">*</span>}
                      </span>
                      <span className="text-xs text-zinc-500">{type}</span>
                      {propObj.description && (
                        <span className="text-xs text-zinc-400 flex-1">
                          {propObj.description}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function getPropertyType(schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject, spec: OpenAPIV3.Document): string {
  if ('$ref' in schema) {
    const refPath = schema.$ref;
    const parts = refPath.split('/');
    return parts[parts.length - 1];
  }

  if (schema.type === 'array' && schema.items) {
    const itemType = getPropertyType(schema.items as OpenAPIV3.SchemaObject, spec);
    return `array<${itemType}>`;
  }

  if (schema.allOf) {
    const types = schema.allOf.map((s) => getPropertyType(s as OpenAPIV3.SchemaObject, spec));
    return types.join(' & ');
  }

  if (schema.oneOf) {
    const types = schema.oneOf.map((s) => getPropertyType(s as OpenAPIV3.SchemaObject, spec));
    return types.join(' | ');
  }

  if (schema.anyOf) {
    const types = schema.anyOf.map((s) => getPropertyType(s as OpenAPIV3.SchemaObject, spec));
    return types.join(' | ');
  }

  const baseType = schema.type ?? 'object';
  if (schema.format) {
    return `${baseType} (${schema.format})`;
  }

  return baseType as string;
}
