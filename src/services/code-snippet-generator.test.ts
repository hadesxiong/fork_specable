import { describe, it, expect } from 'vitest';
import type { OpenAPIV3 } from 'openapi-types';
import { generateSnippet, buildSnippetFromOperation, type SnippetRequest } from './code-snippet-generator';

describe('generateSnippet', () => {
  const baseRequest: SnippetRequest = {
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: {},
  };

  describe('cURL', () => {
    it('generates a simple GET request', () => {
      const result = generateSnippet(baseRequest, 'curl');
      expect(result).toBe("curl 'https://api.example.com/users'");
    });

    it('includes method for non-GET requests', () => {
      const result = generateSnippet({ ...baseRequest, method: 'POST' }, 'curl');
      expect(result).toContain('-X POST');
    });

    it('includes headers', () => {
      const request: SnippetRequest = {
        ...baseRequest,
        headers: { 'Authorization': 'Bearer token123', 'Content-Type': 'application/json' },
      };
      const result = generateSnippet(request, 'curl');
      expect(result).toContain("-H 'Authorization: Bearer token123'");
      expect(result).toContain("-H 'Content-Type: application/json'");
    });

    it('includes request body', () => {
      const request: SnippetRequest = {
        ...baseRequest,
        method: 'POST',
        body: '{"name":"test"}',
        headers: { 'Content-Type': 'application/json' },
      };
      const result = generateSnippet(request, 'curl');
      expect(result).toContain("-d '{\"name\":\"test\"}'");
    });
  });

  describe('fetch', () => {
    it('generates a simple GET request', () => {
      const result = generateSnippet(baseRequest, 'fetch');
      expect(result).toContain("fetch('https://api.example.com/users')");
      expect(result).toContain('await response.json()');
    });

    it('includes method and headers for POST', () => {
      const request: SnippetRequest = {
        ...baseRequest,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"test"}',
      };
      const result = generateSnippet(request, 'fetch');
      expect(result).toContain("method: 'POST'");
      expect(result).toContain("'Content-Type': 'application/json'");
      expect(result).toContain('body: JSON.stringify(');
    });
  });

  describe('python', () => {
    it('generates a simple GET request', () => {
      const result = generateSnippet(baseRequest, 'python');
      expect(result).toContain('import requests');
      expect(result).toContain("requests.get('https://api.example.com/users')");
    });

    it('uses json= for JSON content type', () => {
      const request: SnippetRequest = {
        ...baseRequest,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"test"}',
      };
      const result = generateSnippet(request, 'python');
      expect(result).toContain('json=payload');
      expect(result).not.toContain('data=payload');
    });

    it('uses data= for non-JSON content type', () => {
      const request: SnippetRequest = {
        ...baseRequest,
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'hello',
      };
      const result = generateSnippet(request, 'python');
      expect(result).toContain('data=payload');
    });
  });
});

describe('buildSnippetFromOperation', () => {
  const spec = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    servers: [{ url: 'https://api.test.com' }],
    paths: {},
  } as unknown as OpenAPIV3.Document;

  it('uses the first server URL', () => {
    const operation = { parameters: [], responses: {} } as unknown as OpenAPIV3.OperationObject;
    const result = buildSnippetFromOperation('GET', '/users', operation, spec);
    expect(result.url).toBe('https://api.test.com/users');
  });

  it('preserves path parameter placeholders', () => {
    const operation = {
      parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {},
    } as unknown as OpenAPIV3.OperationObject;
    const result = buildSnippetFromOperation('GET', '/users/{userId}', operation, spec);
    expect(result.url).toContain('{userId}');
  });

  it('appends query parameters as placeholders', () => {
    const operation = {
      parameters: [
        { name: 'limit', in: 'query', schema: { type: 'integer' } },
        { name: 'offset', in: 'query', schema: { type: 'integer' } },
      ],
      responses: {},
    } as unknown as OpenAPIV3.OperationObject;
    const result = buildSnippetFromOperation('GET', '/users', operation, spec);
    expect(result.url).toContain('limit=<value>');
    expect(result.url).toContain('offset=<value>');
  });

  it('adds header parameters as placeholders', () => {
    const operation = {
      parameters: [{ name: 'X-Request-ID', in: 'header', schema: { type: 'string' } }],
      responses: {},
    } as unknown as OpenAPIV3.OperationObject;
    const result = buildSnippetFromOperation('GET', '/users', operation, spec);
    expect(result.headers['X-Request-ID']).toBe('<X-Request-ID>');
  });

  it('falls back to default URL when no servers', () => {
    const noServerSpec = { ...spec, servers: undefined } as unknown as OpenAPIV3.Document;
    const operation = { parameters: [], responses: {} } as unknown as OpenAPIV3.OperationObject;
    const result = buildSnippetFromOperation('GET', '/users', operation, noServerSpec);
    expect(result.url).toContain('api.example.com');
  });
});
