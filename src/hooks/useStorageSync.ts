import { useEffect } from 'react';
import { useEditorStore, type EditorFile } from '../store';

const STORAGE_KEY = 'specable-editor';

export function useStorageSync() {
  const setFile = useEditorStore((state) => state.setFile);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;

      try {
        const parsed = JSON.parse(event.newValue);
        const newFile = parsed.state?.file as EditorFile | undefined;

        if (newFile) {
          setFile(newFile);
        }
      } catch {
        // Ignore parse errors
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [setFile]);
}
