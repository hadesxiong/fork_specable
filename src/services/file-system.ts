import type { EditorFile } from '../store';

export interface FileSystemService {
  openFile(): Promise<EditorFile | null>;
  saveFile(file: EditorFile): Promise<boolean>;
  saveFileAs(file: EditorFile): Promise<EditorFile | null>;
  isSupported(): boolean;
}

class NativeFileSystem implements FileSystemService {
  private fileHandles = new Map<string, FileSystemFileHandle>();

  isSupported(): boolean {
    return 'showOpenFilePicker' in window;
  }

  async openFile(): Promise<EditorFile | null> {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'OpenAPI Specifications',
            accept: {
              'application/x-yaml': ['.yaml', '.yml'],
              'application/json': ['.json'],
            },
          },
        ],
        multiple: false,
      });

      const file = await handle.getFile();
      const content = await file.text();
      const id = crypto.randomUUID();

      this.fileHandles.set(id, handle);

      return {
        id,
        name: file.name,
        content,
        path: file.name,
        isDirty: false,
        language: file.name.endsWith('.json') ? 'json' : 'yaml',
      };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      throw e;
    }
  }

  async saveFile(file: EditorFile): Promise<boolean> {
    const handle = this.fileHandles.get(file.id);

    if (!handle) {
      const newFile = await this.saveFileAs(file);
      return newFile !== null;
    }

    return this.writeToHandle(handle, file.content);
  }

  async saveFileAs(file: EditorFile): Promise<EditorFile | null> {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: file.name,
        types: [
          {
            description: 'OpenAPI Specifications',
            accept: {
              'application/x-yaml': ['.yaml', '.yml'],
              'application/json': ['.json'],
            },
          },
        ],
      });

      const success = await this.writeToHandle(handle, file.content);
      if (!success) return null;

      const savedFile = await handle.getFile();
      const newId = crypto.randomUUID();

      this.fileHandles.set(newId, handle);

      return {
        ...file,
        id: newId,
        name: savedFile.name,
        path: savedFile.name,
        isDirty: false,
        language: savedFile.name.endsWith('.json') ? 'json' : 'yaml',
      };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      throw e;
    }
  }

  private async writeToHandle(handle: FileSystemFileHandle, content: string): Promise<boolean> {
    try {
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (e) {
      console.error('Failed to save file:', e);
      return false;
    }
  }
}

class FallbackFileSystem implements FileSystemService {
  isSupported(): boolean {
    return true;
  }

  async openFile(): Promise<EditorFile | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.yaml,.yml,.json';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return resolve(null);

        const content = await file.text();
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          content,
          isDirty: false,
          language: file.name.endsWith('.json') ? 'json' : 'yaml',
        });
      };

      input.oncancel = () => resolve(null);

      input.click();
    });
  }

  async saveFile(file: EditorFile): Promise<boolean> {
    this.downloadFile(file.name, file.content);
    return true;
  }

  async saveFileAs(file: EditorFile): Promise<EditorFile | null> {
    const name = prompt('Save as:', file.name);
    if (!name) return null;

    this.downloadFile(name, file.content);

    return {
      ...file,
      id: crypto.randomUUID(),
      name,
      isDirty: false,
      language: name.endsWith('.json') ? 'json' : 'yaml',
    };
  }

  private downloadFile(name: string, content: string): void {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
}

let fileSystemInstance: FileSystemService | null = null;

export function getFileSystem(): FileSystemService {
  if (!fileSystemInstance) {
    if ('showOpenFilePicker' in window) {
      fileSystemInstance = new NativeFileSystem();
    } else {
      fileSystemInstance = new FallbackFileSystem();
    }
  }
  return fileSystemInstance;
}
