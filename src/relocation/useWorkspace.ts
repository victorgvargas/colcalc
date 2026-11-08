import { createContext, useContext } from 'react';
import type { Workspace } from './model';

type Store = { workspace: Workspace; save: (value: Workspace) => boolean; error: string };
export const WorkspaceContext = createContext<Store | null>(null);
export function useWorkspace() {
  const store = useContext(WorkspaceContext);
  if (!store) throw new Error('WorkspaceProvider is required');
  return store;
}
