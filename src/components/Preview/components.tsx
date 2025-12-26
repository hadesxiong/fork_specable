import { useState, useCallback, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Lock, Key, Copy, Check } from 'lucide-react';
import type { OpenAPIV3 } from 'openapi-types';
import { Markdown } from './Markdown';
import {
  resolveRef,
  isRef,
  getSchemaType,
  getConstraints,
  formatConstraints,
  getRefName,
  getComposition,
  getDiscriminatorValue,
  isRecursiveRef,
  schemaToTypeScript,
  type SchemaObject,
  type CompositionInfo,
  type DiscriminatorInfo,
} from './schema-utils';

// Location badge colours
const LOCATION_STYLES: Record<string, { bg: string; text: string }> = {
  path: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  query: { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  header: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  cookie: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
};

interface CollapsibleSectionProps {
  title: string;
  defaultExpanded?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  defaultExpanded = true,
  badge,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="mt-3">
      <button
        type="button"
        className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3 h-3" aria-hidden="true" />
        )}
        {title}
        {badge}
      </button>
      {expanded && <div className="mt-2">{children}</div>}
    </div>
  );
}

interface TypeBadgeProps {
  type: string;
}

export function TypeBadge({ type }: TypeBadgeProps) {
  return (
    <span className="text-xs text-zinc-500 font-mono">
      {type}
    </span>
  );
}

interface ParameterLocationProps {
  location: string;
}

export function ParameterLocation({ location }: ParameterLocationProps) {
  const style = LOCATION_STYLES[location] ?? { bg: 'bg-zinc-800', text: 'text-zinc-500' };
  return (
    <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${style.bg} ${style.text}`}>
      {location}
    </span>
  );
}

interface CopyAsTypeScriptProps {
  schema: SchemaObject;
  spec: OpenAPIV3.Document;
  name?: string;
}

export function CopyAsTypeScript({ schema, spec, name }: CopyAsTypeScriptProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const typescript = schemaToTypeScript(schema, spec, { name });
    navigator.clipboard.writeText(typescript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [schema, spec, name]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
      aria-label="Copy as TypeScript"
      title="Copy as TypeScript"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

interface ParameterRowProps {
  param: OpenAPIV3.ParameterObject;
  spec: OpenAPIV3.Document;
}

export function ParameterRow({ param, spec }: ParameterRowProps) {
  const schema = param.schema as SchemaObject | undefined;
  const type = getSchemaType(schema, spec);
  const constraints = schema && !isRef(schema) ? getConstraints(schema) : {};
  const constraintStrings = formatConstraints(constraints);

  return (
    <div className="py-2 border-b border-zinc-800 last:border-b-0">
      <div className="flex items-start gap-2">
        <ParameterLocation location={param.in} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-zinc-200">
              {param.name}
              {param.required && <span className="text-red-500">*</span>}
            </span>
            <TypeBadge type={type} />
            {param.deprecated && (
              <span className="px-1 py-0.5 bg-red-900/50 text-red-400 text-xs rounded">
                deprecated
              </span>
            )}
          </div>
          {param.description && (
            <div className="text-xs text-zinc-400 mt-1">
              <Markdown>{param.description}</Markdown>
            </div>
          )}
          {constraintStrings.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {constraintStrings.map((c, i) => (
                <span key={i} className="text-xs text-zinc-500">{c}</span>
              ))}
            </div>
          )}
          {constraints.enum && (
            <div className="mt-1 flex flex-wrap gap-1">
              {constraints.enum.map((v, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded font-mono">
                  {String(v)}
                </span>
              ))}
            </div>
          )}
          {constraints.example !== undefined && (
            <div className="mt-1 text-xs text-zinc-500">
              Example: <code className="text-zinc-400">{JSON.stringify(constraints.example)}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SchemaDisplayProps {
  schema: SchemaObject;
  spec: OpenAPIV3.Document;
  name?: string;
  depth?: number;
  maxDepth?: number;
}

export function SchemaDisplay({
  schema,
  spec,
  name,
  depth = 0,
  maxDepth = 5,
}: SchemaDisplayProps) {
  if (depth > maxDepth) {
    return <span className="text-xs text-zinc-500">...</span>;
  }

  if (isRef(schema)) {
    const refName = getRefName(schema);
    const resolved = resolveRef(schema, spec);
    if (resolved) {
      return (
        <SchemaDisplay
          schema={resolved.schema}
          spec={spec}
          name={refName}
          depth={depth}
          maxDepth={maxDepth}
        />
      );
    }
    return <span className="text-xs text-zinc-500">{refName}</span>;
  }

  const schemaObj = schema;
  const composition = getComposition(schemaObj);
  const properties = schemaObj.properties ?? {};
  const required = schemaObj.required ?? [];
  const propertyEntries = Object.entries(properties);

  if (propertyEntries.length === 0 && !schemaObj.type && !composition) {
    return null;
  }

  return (
    <div className={`${depth > 0 ? 'ml-3 pl-3 border-l border-zinc-700' : ''}`}>
      {name && (
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium text-zinc-300 text-sm">{name}</span>
          <span className="text-xs text-zinc-500">
            {composition ? composition.type : (schemaObj.type ?? 'object')}
          </span>
        </div>
      )}
      {schemaObj.description && (
        <div className="text-xs text-zinc-400 mb-2">
          <Markdown>{schemaObj.description}</Markdown>
        </div>
      )}
      {composition && (
        <CompositionDisplay
          composition={composition}
          spec={spec}
          depth={depth}
          maxDepth={maxDepth}
        />
      )}
      {propertyEntries.length > 0 && (
        <div className="space-y-1">
          {propertyEntries.map(([propName, propSchema]) => (
            <PropertyRow
              key={propName}
              name={propName}
              schema={propSchema as SchemaObject}
              required={required.includes(propName)}
              spec={spec}
              depth={depth}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
      {schemaObj.type === 'array' && schemaObj.items && (
        <div className="mt-1">
          <span className="text-xs text-zinc-500">items: </span>
          <SchemaDisplay
            schema={schemaObj.items as SchemaObject}
            spec={spec}
            depth={depth + 1}
            maxDepth={maxDepth}
          />
        </div>
      )}
    </div>
  );
}

interface PropertyRowProps {
  name: string;
  schema: SchemaObject;
  required: boolean;
  spec: OpenAPIV3.Document;
  depth: number;
  maxDepth: number;
}

function PropertyRow({ name, schema, required, spec, depth, maxDepth }: PropertyRowProps) {
  const type = getSchemaType(schema, spec);
  const isObject = !isRef(schema) && (schema.type === 'object' || schema.properties);
  const isArray = !isRef(schema) && schema.type === 'array';
  const hasCompositionSchema = !isRef(schema) && getComposition(schema) !== null;
  const [expanded, setExpanded] = useState(false);

  const showExpandButton = (isObject || isArray || hasCompositionSchema) && depth < maxDepth;

  // Extract readOnly/writeOnly and const from schema
  const schemaObj = isRef(schema) ? null : schema;
  const isReadOnly = schemaObj?.readOnly;
  const isWriteOnly = schemaObj?.writeOnly;
  const constValue = schemaObj && 'const' in schemaObj ? schemaObj.const : undefined;

  return (
    <div>
      <div className="flex items-center gap-2 py-1">
        {showExpandButton ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 hover:bg-zinc-700 rounded"
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${name}` : `Expand ${name}`}
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-zinc-500" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-3 h-3 text-zinc-500" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="font-mono text-xs text-zinc-300">
          {name}
          {required && <span className="text-red-500">*</span>}
        </span>
        <TypeBadge type={type} />
        {constValue !== undefined && (
          <span className="px-1 py-0.5 bg-emerald-900/30 text-emerald-400 text-xs rounded font-mono">
            = {JSON.stringify(constValue)}
          </span>
        )}
        {isReadOnly && (
          <span className="px-1 py-0.5 bg-zinc-700 text-zinc-400 text-xs rounded">
            read-only
          </span>
        )}
        {isWriteOnly && (
          <span className="px-1 py-0.5 bg-zinc-700 text-zinc-400 text-xs rounded">
            write-only
          </span>
        )}
      </div>
      {!isRef(schema) && schema.description && (
        <div className="ml-6 text-xs text-zinc-500">
          <Markdown>{schema.description}</Markdown>
        </div>
      )}
      {expanded && showExpandButton && (
        <div className="ml-4">
          <SchemaDisplay
            schema={schema}
            spec={spec}
            depth={depth + 1}
            maxDepth={maxDepth}
          />
        </div>
      )}
    </div>
  );
}

interface CompositionDisplayProps {
  composition: CompositionInfo;
  spec: OpenAPIV3.Document;
  depth: number;
  maxDepth: number;
  ancestorRefs?: Set<string>;
}

const COMPOSITION_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  oneOf: { bg: 'bg-amber-900/20', border: 'border-amber-800/50', text: 'text-amber-400', label: 'One of' },
  anyOf: { bg: 'bg-cyan-900/20', border: 'border-cyan-800/50', text: 'text-cyan-400', label: 'Any of' },
  allOf: { bg: 'bg-violet-900/20', border: 'border-violet-800/50', text: 'text-violet-400', label: 'All of' },
};

function CompositionDisplay({ composition, spec, depth, maxDepth, ancestorRefs = new Set() }: CompositionDisplayProps) {
  const style = COMPOSITION_STYLES[composition.type];
  const { discriminator } = composition;

  return (
    <div className="space-y-2 mb-2">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${style.text}`}>
          {style.label}:
        </span>
        {discriminator && (
          <span className="px-1.5 py-0.5 bg-zinc-700 text-zinc-300 text-xs rounded font-mono">
            {discriminator.propertyName}
          </span>
        )}
      </div>
      {composition.variants.map((variant, index) => (
        <CompositionVariant
          key={index}
          variant={variant}
          index={index}
          style={style}
          spec={spec}
          depth={depth}
          maxDepth={maxDepth}
          discriminator={discriminator}
          ancestorRefs={ancestorRefs}
        />
      ))}
    </div>
  );
}

interface CompositionVariantProps {
  variant: SchemaObject;
  index: number;
  style: { bg: string; border: string; text: string };
  spec: OpenAPIV3.Document;
  depth: number;
  maxDepth: number;
  discriminator?: DiscriminatorInfo;
  ancestorRefs?: Set<string>;
}

function CompositionVariant({ variant, index, style, spec, depth, maxDepth, discriminator, ancestorRefs = new Set() }: CompositionVariantProps) {
  const variantType = getSchemaType(variant, spec);
  const resolved = isRef(variant) ? resolveRef(variant, spec) : null;
  const resolvedName = resolved?.name;
  const variantSchema = resolved?.schema ?? (isRef(variant) ? null : variant);

  // Check for recursive reference
  const isRecursive = isRecursiveRef(variant, ancestorRefs);

  // Get discriminator value if this variant is referenced
  const discriminatorValue = getDiscriminatorValue(variant, discriminator);

  // Track this ref for nested recursion detection
  const newAncestorRefs = new Set(ancestorRefs);
  if (isRef(variant)) {
    newAncestorRefs.add(variant.$ref);
  }

  const properties = variantSchema?.properties ? Object.entries(variantSchema.properties) : [];
  const required = variantSchema?.required ?? [];
  const nestedComposition = variantSchema ? getComposition(variantSchema) : null;
  const hasStructure = properties.length > 0 || nestedComposition;

  // Get const value from variant schema if present
  const constValue = variantSchema && 'const' in variantSchema ? variantSchema.const : undefined;

  return (
    <div className={`rounded border ${style.border} ${style.bg} overflow-hidden`}>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className={`px-1.5 py-0.5 text-xs rounded bg-zinc-800 ${style.text} font-medium`}>
          {index + 1}
        </span>
        <span className="text-xs text-zinc-200 font-mono font-medium">
          {resolvedName ?? variantType}
        </span>
        {discriminatorValue && (
          <span className="px-1.5 py-0.5 bg-emerald-900/30 text-emerald-400 text-xs rounded font-mono">
            = "{discriminatorValue}"
          </span>
        )}
        {constValue !== undefined && !discriminatorValue && (
          <span className="px-1.5 py-0.5 bg-emerald-900/30 text-emerald-400 text-xs rounded font-mono">
            = {JSON.stringify(constValue)}
          </span>
        )}
        {resolvedName && variantSchema?.type && (
          <span className="text-xs text-zinc-500">
            {variantSchema.type}
          </span>
        )}
        {isRecursive && (
          <span className="px-1.5 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded">
            recursive
          </span>
        )}
      </div>

      {variantSchema?.description && (
        <div className="px-2 pb-1.5 text-xs text-zinc-400">
          <Markdown>{variantSchema.description}</Markdown>
        </div>
      )}

      {hasStructure && depth < maxDepth && !isRecursive && (
        <div className="border-t border-zinc-700/50 px-2 py-2 bg-zinc-900/30">
          {nestedComposition && (
            <CompositionDisplay
              composition={nestedComposition}
              spec={spec}
              depth={depth + 1}
              maxDepth={maxDepth}
              ancestorRefs={newAncestorRefs}
            />
          )}
          {properties.length > 0 && (
            <div className="space-y-1">
              {properties.map(([propName, propSchema]) => (
                <PropertyRow
                  key={propName}
                  name={propName}
                  schema={propSchema as SchemaObject}
                  required={required.includes(propName)}
                  spec={spec}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface RequestBodySectionProps {
  requestBody: OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject;
  spec: OpenAPIV3.Document;
}

export function RequestBodySection({ requestBody, spec }: RequestBodySectionProps) {
  let body: OpenAPIV3.RequestBodyObject;

  if ('$ref' in requestBody) {
    const resolved = resolveRef(requestBody as SchemaObject, spec);
    if (!resolved) return null;
    body = resolved.schema as unknown as OpenAPIV3.RequestBodyObject;
  } else {
    body = requestBody;
  }

  const contentTypes = Object.keys(body.content ?? {});
  const [selectedType, setSelectedType] = useState(contentTypes[0] ?? 'application/json');

  const mediaType = body.content?.[selectedType];
  const schema = mediaType?.schema as SchemaObject | undefined;

  return (
    <CollapsibleSection
      title="Request Body"
      badge={body.required ? (
        <span className="px-1.5 py-0.5 bg-red-900/50 text-red-400 text-xs rounded ml-2">
          required
        </span>
      ) : undefined}
    >
      <div className="bg-zinc-800/50 rounded p-3">
        {body.description && (
          <div className="text-xs text-zinc-400 mb-2">
            <Markdown>{body.description}</Markdown>
          </div>
        )}
        {contentTypes.length > 1 && (
          <div className="flex gap-1 mb-2">
            {contentTypes.map((ct) => (
              <button
                key={ct}
                type="button"
                onClick={() => setSelectedType(ct)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  selectedType === ct
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {ct}
              </button>
            ))}
          </div>
        )}
        {contentTypes.length === 1 && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-zinc-500">{selectedType}</span>
            {schema && <CopyAsTypeScript schema={schema} spec={spec} name="RequestBody" />}
          </div>
        )}
        {contentTypes.length > 1 && schema && (
          <div className="flex items-center gap-2 mb-2">
            <CopyAsTypeScript schema={schema} spec={spec} name="RequestBody" />
          </div>
        )}
        {schema && <SchemaDisplay schema={schema} spec={spec} />}
      </div>
    </CollapsibleSection>
  );
}

interface ResponseSectionProps {
  responses: OpenAPIV3.ResponsesObject;
  spec: OpenAPIV3.Document;
}

export function ResponseSection({ responses, spec }: ResponseSectionProps) {
  const entries = Object.entries(responses);

  return (
    <CollapsibleSection title="Responses">
      <div className="space-y-2">
        {entries.map(([code, response]) => (
          <ResponseCard
            key={code}
            code={code}
            response={response as OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject}
            spec={spec}
          />
        ))}
      </div>
    </CollapsibleSection>
  );
}

interface ResponseCardProps {
  code: string;
  response: OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject;
  spec: OpenAPIV3.Document;
}

function ResponseCard({ code, response, spec }: ResponseCardProps) {
  let resp: OpenAPIV3.ResponseObject;

  if ('$ref' in response) {
    const resolved = resolveRef(response as SchemaObject, spec);
    if (!resolved) return null;
    resp = resolved.schema as unknown as OpenAPIV3.ResponseObject;
  } else {
    resp = response;
  }

  const isSuccess = code.startsWith('2');
  const isClientError = code.startsWith('4');
  const isServerError = code.startsWith('5');

  const codeStyle = isSuccess
    ? 'bg-emerald-900/50 text-emerald-400'
    : isClientError
    ? 'bg-yellow-900/50 text-yellow-400'
    : isServerError
    ? 'bg-red-900/50 text-red-400'
    : 'bg-zinc-800 text-zinc-500';

  const contentTypes = Object.keys(resp.content ?? {});
  const [selectedType, setSelectedType] = useState(contentTypes[0]);
  const mediaType = selectedType ? resp.content?.[selectedType] : undefined;
  const schema = mediaType?.schema as SchemaObject | undefined;

  const defaultExpanded = isSuccess;

  return (
    <div className="bg-zinc-800/50 rounded overflow-hidden">
      <ResponseHeader
        code={code}
        codeStyle={codeStyle}
        description={resp.description}
        defaultExpanded={defaultExpanded}
      >
        {contentTypes.length > 0 && (
          <div className="p-3 pt-0">
            {contentTypes.length > 1 && (
              <div className="flex gap-1 mb-2">
                {contentTypes.map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setSelectedType(ct)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      selectedType === ct
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {ct}
                  </button>
                ))}
              </div>
            )}
            {contentTypes.length === 1 && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-zinc-500">{selectedType}</span>
                {schema && <CopyAsTypeScript schema={schema} spec={spec} name={`Response${code}`} />}
              </div>
            )}
            {contentTypes.length > 1 && schema && (
              <div className="flex items-center gap-2 mb-2">
                <CopyAsTypeScript schema={schema} spec={spec} name={`Response${code}`} />
              </div>
            )}
            {schema && <SchemaDisplay schema={schema} spec={spec} />}
          </div>
        )}
      </ResponseHeader>
    </div>
  );
}

interface ResponseHeaderProps {
  code: string;
  codeStyle: string;
  description: string;
  defaultExpanded: boolean;
  children: ReactNode;
}

function ResponseHeader({ code, codeStyle, description, defaultExpanded, children }: ResponseHeaderProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasContent = children !== undefined && children !== null;

  return (
    <>
      <button
        type="button"
        className="w-full flex items-center gap-2 p-3 hover:bg-zinc-700/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {hasContent && (
          expanded ? (
            <ChevronDown className="w-3 h-3 text-zinc-500" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-3 h-3 text-zinc-500" aria-hidden="true" />
          )
        )}
        {!hasContent && <span className="w-3" />}
        <span className={`px-2 py-0.5 text-xs font-bold rounded ${codeStyle}`}>
          {code}
        </span>
        <span className="text-xs text-zinc-400 flex-1">{description}</span>
      </button>
      {expanded && hasContent && children}
    </>
  );
}

interface SecuritySectionProps {
  security?: OpenAPIV3.SecurityRequirementObject[];
  securitySchemes?: Record<string, OpenAPIV3.SecuritySchemeObject | OpenAPIV3.ReferenceObject>;
  spec: OpenAPIV3.Document;
}

export function SecuritySection({ security, securitySchemes, spec }: SecuritySectionProps) {
  if (!security || security.length === 0) return null;

  return (
    <CollapsibleSection title="Security">
      <div className="space-y-2">
        {security.map((req, index) => (
          <SecurityRequirement
            key={index}
            requirement={req}
            securitySchemes={securitySchemes}
            spec={spec}
          />
        ))}
      </div>
    </CollapsibleSection>
  );
}

interface SecurityRequirementProps {
  requirement: OpenAPIV3.SecurityRequirementObject;
  securitySchemes?: Record<string, OpenAPIV3.SecuritySchemeObject | OpenAPIV3.ReferenceObject>;
  spec: OpenAPIV3.Document;
}

function SecurityRequirement({ requirement, securitySchemes, spec }: SecurityRequirementProps) {
  const entries = Object.entries(requirement);

  if (entries.length === 0) {
    return (
      <div className="p-2 bg-zinc-800/50 rounded text-xs text-zinc-400">
        No authentication required
      </div>
    );
  }

  return (
    <div className="p-2 bg-zinc-800/50 rounded space-y-2">
      {entries.map(([schemeName, scopes]) => {
        const schemeRef = securitySchemes?.[schemeName];
        let scheme: OpenAPIV3.SecuritySchemeObject | undefined;

        if (schemeRef) {
          if ('$ref' in schemeRef) {
            const resolved = resolveRef(schemeRef as SchemaObject, spec);
            scheme = resolved?.schema as unknown as OpenAPIV3.SecuritySchemeObject;
          } else {
            scheme = schemeRef;
          }
        }

        return (
          <SecuritySchemeDisplay
            key={schemeName}
            name={schemeName}
            scheme={scheme}
            scopes={scopes}
          />
        );
      })}
    </div>
  );
}

interface SecuritySchemeDisplayProps {
  name: string;
  scheme?: OpenAPIV3.SecuritySchemeObject;
  scopes: string[];
}

function SecuritySchemeDisplay({ name, scheme, scopes }: SecuritySchemeDisplayProps) {
  const getSchemeIcon = () => {
    if (!scheme) return <Lock className="w-3 h-3" aria-hidden="true" />;

    switch (scheme.type) {
      case 'oauth2':
        return <Key className="w-3 h-3" aria-hidden="true" />;
      case 'apiKey':
        return <Key className="w-3 h-3" aria-hidden="true" />;
      default:
        return <Lock className="w-3 h-3" aria-hidden="true" />;
    }
  };

  const getSchemeTypeLabel = () => {
    if (!scheme) return 'Unknown';

    switch (scheme.type) {
      case 'http':
        return `HTTP ${(scheme as OpenAPIV3.HttpSecurityScheme).scheme}`;
      case 'apiKey':
        return `API Key (${(scheme as OpenAPIV3.ApiKeySecurityScheme).in})`;
      case 'oauth2':
        return 'OAuth2';
      case 'openIdConnect':
        return 'OpenID Connect';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="flex items-start gap-2">
      <span className="text-zinc-400 mt-0.5">{getSchemeIcon()}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-200 font-medium">{name}</span>
          <span className="text-xs text-zinc-500">({getSchemeTypeLabel()})</span>
        </div>
        {scheme?.description && (
          <div className="text-xs text-zinc-400 mt-0.5">
            <Markdown>{scheme.description}</Markdown>
          </div>
        )}
        {scopes.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="text-xs text-zinc-500">Scopes:</span>
            {scopes.map((scope) => (
              <span
                key={scope}
                className="px-1.5 py-0.5 bg-zinc-700 text-zinc-300 text-xs rounded font-mono"
              >
                {scope}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
