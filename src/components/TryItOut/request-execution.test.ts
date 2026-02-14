import { describe, it, expect } from 'vitest';
import { buildUrl } from './request-execution';

const noAuth = {
  type: 'none' as const,
  bearerToken: '',
  apiKeyName: '',
  apiKeyValue: '',
  apiKeyLocation: 'header' as const,
  basicUsername: '',
  basicPassword: '',
  username: '',
  password: '',
};

describe('buildUrl', () => {
  it('preserves server path prefix', () => {
    const result = buildUrl('https://api.example.com/v1', '/books', {}, noAuth);
    expect(result).toBe('https://api.example.com/v1/books');
  });

  it('works without a path prefix', () => {
    const result = buildUrl('https://api.example.com', '/books', {}, noAuth);
    expect(result).toBe('https://api.example.com/books');
  });

  it('strips trailing slash from base URL', () => {
    const result = buildUrl('https://api.example.com/v1/', '/books', {}, noAuth);
    expect(result).toBe('https://api.example.com/v1/books');
  });

  it('adds leading slash to path if missing', () => {
    const result = buildUrl('https://api.example.com/v1', 'books', {}, noAuth);
    expect(result).toBe('https://api.example.com/v1/books');
  });

  it('substitutes path parameters', () => {
    const result = buildUrl(
      'https://api.example.com',
      '/books/{bookId}',
      { 'path.bookId': '42' },
      noAuth,
    );
    expect(result).toBe('https://api.example.com/books/42');
  });

  it('encodes path parameter values', () => {
    const result = buildUrl(
      'https://api.example.com',
      '/search/{query}',
      { 'path.query': 'hello world' },
      noAuth,
    );
    expect(result).toBe('https://api.example.com/search/hello%20world');
  });

  it('appends query parameters', () => {
    const result = buildUrl(
      'https://api.example.com',
      '/books',
      { 'query.limit': '10', 'query.offset': '20' },
      noAuth,
    );
    expect(result).toContain('/books?');
    expect(result).toContain('limit=10');
    expect(result).toContain('offset=20');
  });

  it('appends API key as query parameter when configured', () => {
    const auth = {
      ...noAuth,
      type: 'apiKey' as const,
      apiKeyName: 'key',
      apiKeyValue: 'secret',
      apiKeyLocation: 'query' as const,
    };
    const result = buildUrl('https://api.example.com', '/books', {}, auth);
    expect(result).toContain('key=secret');
  });

  it('handles deep path prefixes', () => {
    const result = buildUrl('https://api.example.com/api/v2/rest', '/users', {}, noAuth);
    expect(result).toBe('https://api.example.com/api/v2/rest/users');
  });
});
