import { useCallback } from 'react';
import { useEditorStore } from '../store';
import { getFileSystem } from '../services/file-system';
import { formatEditorContent } from '../utils/format';

function detectLanguage(filename: string, content: string): 'yaml' | 'json' {
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) return 'yaml';
  // Try to detect from content
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'yaml';
}

export function useFileSystem() {
  const setFile = useEditorStore((state) => state.setFile);
  const updateFileIdentity = useEditorStore((state) => state.updateFileIdentity);
  const file = useEditorStore((state) => state.file);

  const openFile = useCallback(async () => {
    const fs = getFileSystem();
    const newFile = await fs.openFile();
    if (newFile) {
      setFile(newFile);
    }
  }, [setFile]);

  const importFromFile = useCallback(async () => {
    // Use a regular file input to import without File System Access API handle
    return new Promise<boolean>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.yaml,.yml,.json';

      input.onchange = async () => {
        const selectedFile = input.files?.[0];
        if (!selectedFile) {
          resolve(false);
          return;
        }

        try {
          const content = await selectedFile.text();
          const language = detectLanguage(selectedFile.name, content);

          setFile({
            id: crypto.randomUUID(),
            name: `imported-${selectedFile.name}`,
            content,
            isDirty: false,
            language,
          });
          resolve(true);
        } catch (error) {
          console.error('Failed to import file:', error);
          resolve(false);
        }
      };

      input.oncancel = () => resolve(false);
      input.click();
    });
  }, [setFile]);

  const importFromUrl = useCallback(async (url?: string) => {
    const targetUrl = url ?? prompt('Enter URL to import OpenAPI specification:');
    if (!targetUrl) return false;

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      const urlPath = new URL(targetUrl).pathname;
      const filename = urlPath.split('/').pop() || 'imported-spec';
      const language = detectLanguage(filename, content);

      setFile({
        id: crypto.randomUUID(),
        name: `imported-${filename}${language === 'json' ? '.json' : '.yaml'}`,
        content,
        isDirty: false,
        language,
      });
      return true;
    } catch (error) {
      console.error('Failed to import from URL:', error);
      alert(`Failed to import from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }, [setFile]);

  const saveFile = useCallback(async () => {
    if (!file) return false;

    formatEditorContent();

    const currentFile = useEditorStore.getState().file;
    if (!currentFile) return false;

    const fs = getFileSystem();
    const savedFile = await fs.saveFile(currentFile);
    if (savedFile) {
      updateFileIdentity(savedFile);
    }
    return savedFile !== null;
  }, [file, updateFileIdentity]);

  const saveFileAs = useCallback(async () => {
    if (!file) return false;

    const fs = getFileSystem();
    const savedFile = await fs.saveFileAs(file);
    if (savedFile) {
      updateFileIdentity(savedFile);
    }
    return savedFile !== null;
  }, [file, updateFileIdentity]);

  const newFile = useCallback(() => {
    const defaultContent = `openapi: 3.0.3
info:
  title: New API
  version: 1.0.0
paths: {}
`;

    setFile({
      id: crypto.randomUUID(),
      name: 'untitled.yaml',
      content: defaultContent,
      isDirty: false,
      language: 'yaml',
    });
  }, [setFile]);

  const exportAsJson = useCallback(async () => {
    if (!file) return false;

    const fs = getFileSystem();
    return fs.exportAsJson(file.content, file.name);
  }, [file]);

  const exportAsYaml = useCallback(async () => {
    if (!file) return false;

    const fs = getFileSystem();
    return fs.exportAsYaml(file.content, file.name);
  }, [file]);

  return {
    openFile,
    importFromFile,
    importFromUrl,
    saveFile,
    saveFileAs,
    newFile,
    exportAsJson,
    exportAsYaml,
  };
}
