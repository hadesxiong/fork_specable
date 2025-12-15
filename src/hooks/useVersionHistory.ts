import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '../store';
import { getVersionHistoryDB } from '../services/version-history-db';

const MAX_SNAPSHOTS = 50;

export function useVersionHistory() {
  const file = useEditorStore((state) => state.file);
  const setVersionHistory = useEditorStore((state) => state.setVersionHistory);
  const addSnapshot = useEditorStore((state) => state.addSnapshot);
  const setHistoryLoading = useEditorStore((state) => state.setHistoryLoading);
  const showToast = useEditorStore((state) => state.showToast);

  const dbRef = useRef(getVersionHistoryDB());

  // Load history when file changes
  useEffect(() => {
    if (!file?.id) {
      setVersionHistory([]);
      return;
    }

    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        await dbRef.current.init();
        const snapshots = await dbRef.current.getSnapshots(file.id);
        setVersionHistory(snapshots);
      } catch (error) {
        console.error('Failed to load version history:', error);
        setVersionHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    loadHistory();
  }, [file?.id, setVersionHistory, setHistoryLoading]);

  // Create snapshot function (manual only)
  const createSnapshot = useCallback(async (label?: string) => {
    if (!file?.id || !file?.content) return null;

    try {
      await dbRef.current.init();
      const snapshot = await dbRef.current.saveSnapshot(
        file.id,
        file.name,
        file.content,
        label
      );

      if (snapshot) {
        addSnapshot(snapshot);
        showToast('success', 'Snapshot created');
        // Prune old snapshots
        await dbRef.current.pruneOldSnapshots(file.id, MAX_SNAPSHOTS);
      } else {
        showToast('info', 'Content unchanged since last snapshot');
      }

      return snapshot;
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      showToast('error', 'Failed to create snapshot');
      return null;
    }
  }, [file?.id, file?.name, file?.content, addSnapshot, showToast]);

  // Delete snapshot
  const deleteSnapshot = useCallback(async (id: string) => {
    const removeSnapshot = useEditorStore.getState().removeSnapshot;

    try {
      await dbRef.current.init();
      await dbRef.current.deleteSnapshot(id);
      removeSnapshot(id);
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
    }
  }, []);

  // Restore snapshot
  const restoreSnapshot = useCallback(async (id: string) => {
    const updateContent = useEditorStore.getState().updateContent;

    try {
      await dbRef.current.init();
      const snapshot = await dbRef.current.getSnapshot(id);

      if (snapshot) {
        updateContent(snapshot.content);
      }
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
    }
  }, []);

  // Update snapshot label
  const updateSnapshotLabel = useCallback(async (id: string, label: string | undefined) => {
    const { versionHistory, setVersionHistory } = useEditorStore.getState();

    try {
      await dbRef.current.init();
      await dbRef.current.updateSnapshotLabel(id, label);

      // Update in store
      const updated = versionHistory.map((s) =>
        s.id === id ? { ...s, label } : s
      );
      setVersionHistory(updated);
    } catch (error) {
      console.error('Failed to update snapshot label:', error);
    }
  }, []);

  return {
    createSnapshot,
    deleteSnapshot,
    restoreSnapshot,
    updateSnapshotLabel,
  };
}
