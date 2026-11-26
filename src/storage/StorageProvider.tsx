import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getStorageSetup, onStorageReset, type StorageMode, type StorageSetup } from './detect';
import type { Storage, StorageInfo } from './types';
import { useOutsideChanges } from './useOutsideChanges';

const StorageContext = createContext<StorageSetup | null>(null);

interface StorageProviderProps {
  children: ReactNode;
  /** Use this adapter instead of detecting one (tests, demos). */
  storage?: Storage;
  /** Mode reported for an injected `storage`. Default `local`. */
  mode?: StorageMode;
  /** Rendered while the mode is being detected. */
  fallback?: ReactNode;
}

/** Detects the storage mode once and provides the adapter to the tree. Re-creates it after `resetStorage()`. */
export function StorageProvider({ children, storage, mode = 'local', fallback = null }: StorageProviderProps) {
  const [detected, setDetected] = useState<StorageSetup | null>(null);

  useEffect(() => {
    if (storage) return;
    let active = true;
    const load = () => {
      getStorageSetup().then((setup) => {
        if (active) setDetected(setup);
      });
    };
    load();
    const off = onStorageReset(load);
    return () => {
      active = false;
      off();
    };
  }, [storage]);

  const value = storage ? { storage, mode, needsSetup: false } : detected;
  if (!value) return <>{fallback}</>;
  return (
    <StorageContext.Provider value={value}>
      <OutsideChangesWatcher />
      {children}
    </StorageContext.Provider>
  );
}

/** Re-reads the UI when the content folder is changed by another tool (local mode; see useOutsideChanges). */
function OutsideChangesWatcher() {
  const storage = useStorage();
  const info = useStorageInfo();
  useOutsideChanges(storage, info?.watchIntervalMs);
  return null;
}

/** Full setup: `{ storage, mode, needsSetup }`. */
export function useStorageSetup(): StorageSetup {
  const value = useContext(StorageContext);
  if (!value) throw new Error('useStorageSetup() must be used inside <StorageProvider>');
  return value;
}

/** The active storage adapter. */
export function useStorage(): Storage {
  return useStorageSetup().storage;
}

/** `storage.info()` of the active adapter; null while loading or when it failed. */
export function useStorageInfo(): StorageInfo | null {
  const storage = useStorage();
  const [info, setInfo] = useState<StorageInfo | null>(null);
  useEffect(() => {
    let active = true;
    setInfo(null);
    storage.info().then(
      (result) => active && setInfo(result),
      () => active && setInfo(null),
    );
    return () => {
      active = false;
    };
  }, [storage]);
  return info;
}
