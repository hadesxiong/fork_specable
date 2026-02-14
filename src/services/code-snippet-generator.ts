import type { OpenAPIV3 } from 'openapi-types';
import type { AuthConfig } from '../store';

export interface SnippetRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export type SnippetFormat = 'curl' | 'fetch' | 'python';

export function generateSnippet(request: SnippetRequest, format: SnippetFormat): string {
  switch (format) {
    case 'curl':
      return generateCurl(request);
    case 'fetch':
      return generateFetch(request);
    case 'python':
      return generatePython(request);
  }
}

function generateCurl(request: SnippetRequest): string {
  const parts: string[] = ['curl'];

  if (request.method.toUpperCase() !== 'GET') {
    parts.push(`-X ${request.method.toUpperCase()}`);
  }

  parts.push(`'${request.url}'`);

  for (const [key, value] of Object.entries(request.headers)) {
    parts.push(`-H '${key}: ${value}'`);
  }

  if (request.body) {
    parts.push(`-d '${request.body}'`);
  }

  if (parts.length <= 3) {
    return parts.join(' ');
  }

  return parts.join(' \\\n  ');
}

function generateFetch(request: SnippetRequest): string {
  const hasHeaders = Object.keys(request.headers).length > 0;
  const hasBody = Boolean(request.body);
  const isGet = request.method.toUpperCase() === 'GET';

  if (isGet && !hasHeaders) {
    return `const response = await fetch('${request.url}');
const data = await response.json();`;
  }

  const options: string[] = [];

  if (!isGet) {
    options.push(`  method: '${request.method.toUpperCase()}'`);
  }

  if (hasHeaders) {
    const headerEntries = Object.entries(request.headers)
      .map(([key, value]) => `    '${key}': '${value}'`)
      .join(',\n');
    options.push(`  headers: {\n${headerEntries}\n  }`);
  }

  if (hasBody) {
    options.push(`  body: JSON.stringify(${request.body})`);
  }

  return `const response = await fetch('${request.url}', {
${options.join(',\n')}
});
const data = await response.json();`;
}

function generatePython(request: SnippetRequest): string {
  const method = request.method.toLowerCase();
  const lines: string[] = ['import requests', ''];

  const hasHeaders = Object.keys(request.headers).length > 0;
  const hasBody = Boolean(request.body);

  if (hasHeaders) {
    const headerEntries = Object.entries(request.headers)
      .map(([key, value]) => `    '${key}': '${value}'`)
      .join(',\n');
    lines.push(`headers = {\n${headerEntries}\n}`);
    lines.push('');
  }

  if (hasBody) {
    lines.push(`payload = ${request.body}`);
    lines.push('');
  }

  const args: string[] = [`'${request.url}'`];
  if (hasHeaders) args.push('headers=headers');
  if (hasBody) {
    const isJson = request.headers['Content-Type']?.includes('json');
    args.push(isJson ? 'json=payload' : 'data=payload');
  }

  lines.push(`response = requests.${method}(${args.join(', ')})`);
  lines.push('print(response.json())');

  return lines.join('\n');
}

/**
 * Build a SnippetRequest from an OpenAPI operation definition.
 * Uses placeholder values for parameters that don't have concrete values.
 */
export function buildSnippetFromOperation(
  method: string,
  path: string,
  operation: OpenAPIV3.OperationObject,
  spec: OpenAPIV3.Document,
  serverUrl?: string,
): SnippetRequest {
  const baseUrl = serverUrl ?? spec.servers?.[0]?.url ?? 'https://api.example.com';
  const headers: Record<string, string> = {};

  // Substitute path parameters with placeholders
  let resolvedPath = path;
  const parameters = (operation.parameters ?? []) as OpenAPIV3.ParameterObject[];

  for (const param of parameters) {
    if ('$ref' in param) continue;

    switch (param.in) {
      case 'path':
        resolvedPath = resolvedPath.replace(
          new RegExp(`\\{${param.name}\\}`, 'g'),
          `{${param.name}}`,
        );
        break;
      case 'header':
        headers[param.name] = `<${param.name}>`;
        break;
    }
  }

  // Build query string from query parameters
  const queryParams = parameters.filter(p => !('$ref' in p) && p.in === 'query');
  let queryString = '';
  if (queryParams.length > 0) {
    const pairs = queryParams.map(p => `${p.name}=<value>`);
    queryString = '?' + pairs.join('&');
  }

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
  const url = `${normalizedBase}${normalizedPath}${queryString}`;

  // Request body
  let body: string | undefined;
  if (operation.requestBody && !('$ref' in operation.requestBody)) {
    const content = operation.requestBody.content;
    const jsonContent = content?.['application/json'];
    if (jsonContent?.schema) {
      headers['Content-Type'] = 'application/json';
      body = '{}';
    }
  }

  return { method: method.toUpperCase(), url, headers, body };
}

/**
 * Build a SnippetRequest from TryItOut state with concrete values.
 */
export function buildSnippetFromTryIt(options: {
  method: string;
  baseUrl: string;
  path: string;
  parameterValues: Record<string, string>;
  body?: string;
  contentType?: string;
  auth: AuthConfig;
}): SnippetRequest {
  const { method, baseUrl, path, parameterValues, body, contentType, auth } = options;

  // Substitute path parameters
  let resolvedPath = path;
  for (const [key, value] of Object.entries(parameterValues)) {
    if (key.startsWith('path.')) {
      const paramName = key.slice(5);
      resolvedPath = resolvedPath.replace(
        new RegExp(`\\{${paramName}\\}`, 'g'),
        encodeURIComponent(value),
      );
    }
  }

  // Build URL
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;

  // Avoid new URL(path, base) which drops base path prefixes
  const url = new URL(normalizedBase);
  url.pathname = url.pathname.replace(/\/+$/, '') + normalizedPath;

  // Query parameters
  for (const [key, value] of Object.entries(parameterValues)) {
    if (key.startsWith('query.') && value) {
      url.searchParams.append(key.slice(6), value);
    }
  }

  // API key in query
  if (auth.type === 'apiKey' && auth.apiKeyLocation === 'query' && auth.apiKeyName && auth.apiKeyValue) {
    url.searchParams.append(auth.apiKeyName, auth.apiKeyValue);
  }

  // Build headers
  const headers: Record<string, string> = {};

  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  // Header parameters
  for (const [key, value] of Object.entries(parameterValues)) {
    if (key.startsWith('header.') && value) {
      headers[key.slice(7)] = value;
    }
  }

  // Auth headers
  switch (auth.type) {
    case 'bearer':
      if (auth.bearerToken) {
        headers['Authorization'] = `Bearer ${auth.bearerToken}`;
      }
      break;
    case 'apiKey':
      if (auth.apiKeyLocation === 'header' && auth.apiKeyName && auth.apiKeyValue) {
        headers[auth.apiKeyName] = auth.apiKeyValue;
      }
      break;
    case 'basic':
      if (auth.username && auth.password) {
        const encoded = btoa(`${auth.username}:${auth.password}`);
        headers['Authorization'] = `Basic ${encoded}`;
      }
      break;
  }

  return {
    method: method.toUpperCase(),
    url: url.toString(),
    headers,
    body: body || undefined,
  };
}
