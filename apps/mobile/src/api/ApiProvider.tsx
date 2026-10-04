import { createContext, useContext, type ReactNode } from 'react';
import type { TendrilApi } from './types';

const ApiContext = createContext<TendrilApi | null>(null);

export function ApiProvider({ api, children }: { api: TendrilApi; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): TendrilApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside ApiProvider');
  return api;
}
