import type { AuthConfig, TryItResponse } from '../../store';
import { isAbortError } from '../../utils/errors';

interface ExecuteRequestOptions {
  method: string;
  baseUrl: string;
  path: string;
  parameterValues: Record<string, string>;
  body?: string;
  contentType?: string;
  auth: AuthConfig;
}

export async function executeRequest(options: ExecuteRequestOptions): Promise<TryItResponse> {
  const { method, baseUrl, path, parameterValues, body, contentType, auth } = options;

  const startTime = performance.now();

  try {
    // Build URL with path parameters substituted
    const url = buildUrl(baseUrl, path, parameterValues, auth);

    // Build headers
    const headers = buildHeaders(contentType, parameterValues, auth);

    // Build request options
    const requestOptions: RequestInit = {
      method: method.toUpperCase(),
      headers,
      // Only include body for methods that support it
      ...(body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && { body }),
    };

    // Execute fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Math.round(performance.now() - startTime);

      // Read response body
      const responseBody = await response.text();

      // Collect headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        responseTimeMs: responseTime,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);

    // Detect CORS errors
    const isCorsError = isCorsRelatedError(error);

    // Detect timeout
    const isTimeout = isAbortError(error);

    return {
      status: 0,
      statusText: isTimeout ? 'Timeout' : 'Network Error',
      headers: {},
      body: '',
      responseTimeMs: responseTime,
      error: isTimeout
        ? 'Request timed out after 30 seconds'
        : error instanceof Error
          ? error.message
          : 'Unknown error',
      isCorsError,
    };
  }
}

function buildUrl(
  baseUrl: string,
  path: string,
  parameterValues: Record<string, string>,
  auth: AuthConfig
): string {
  // Substitute path parameters
  let resolvedPath = path;
  for (const [key, value] of Object.entries(parameterValues)) {
    if (key.startsWith('path.')) {
      const paramName = key.slice(5);
      resolvedPath = resolvedPath.replace(
        new RegExp(`\\{${paramName}\\}`, 'g'),
        encodeURIComponent(value)
      );
    }
  }

  // Ensure baseUrl doesn't have trailing slash and path has leading slash
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;

  // Build URL
  const url = new URL(normalizedPath, normalizedBase);

  // Add query parameters
  for (const [key, value] of Object.entries(parameterValues)) {
    if (key.startsWith('query.') && value) {
      const paramName = key.slice(6);
      url.searchParams.append(paramName, value);
    }
  }

  // Add API key to query if configured
  if (auth.type === 'apiKey' && auth.apiKeyLocation === 'query' && auth.apiKeyName && auth.apiKeyValue) {
    url.searchParams.append(auth.apiKeyName, auth.apiKeyValue);
  }

  return url.toString();
}

function buildHeaders(
  contentType: string | undefined,
  parameterValues: Record<string, string>,
  auth: AuthConfig
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Content-Type
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  // Header parameters
  for (const [key, value] of Object.entries(parameterValues)) {
    if (key.startsWith('header.') && value) {
      const headerName = key.slice(7);
      headers[headerName] = value;
    }
  }

  // Authentication headers
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

  return headers;
}

function isCorsRelatedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // Common CORS error indicators
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error') ||
    message.includes('cors') ||
    message.includes('cross-origin') ||
    message.includes('access-control-allow-origin')
  );
}
