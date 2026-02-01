/**
 * Checks if an error is an AbortError (user cancelled operation).
 * This covers both DOMException AbortError and generic Error with name 'AbortError'.
 */
export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }
  return false;
}
