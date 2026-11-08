import { useEffect, useState, type ReactNode } from 'react';
import { WorkspaceContext } from './useWorkspace';
import { readWorkspace, STORAGE_KEY, type Workspace } from './model';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState(() => {
    try { return readWorkspace(localStorage.getItem(STORAGE_KEY)); }
    catch { return readWorkspace(null); }
  });
  const [error, setError] = useState('');
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setWorkspace(readWorkspace(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  function save(value: Workspace) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      setWorkspace(value);
      setError('');
      return true;
    } catch {
      setError('Your browser could not save this change. Free some storage or allow site storage, then try again.');
      return false;
    }
  }
  return <WorkspaceContext.Provider value={{ workspace, save, error }}>{children}</WorkspaceContext.Provider>;
}
