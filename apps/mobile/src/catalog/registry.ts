import type { Scheme } from '@tendril/core';
import type { ReactElement } from 'react';

export interface FrameEntry {
  id: string;
  title: string;
  scheme?: Scheme;
  /** Status bar text colour: light over hero photos and dark screens. */
  statusBar?: 'dark' | 'light';
  render: () => ReactElement;
}

const frames = new Map<string, FrameEntry>();

export function registerFrame(entry: FrameEntry): void {
  // A second frame with the same id would silently replace the first; catch the typo in development.
  if (__DEV__ && frames.has(entry.id))
    throw new Error(`Catalog frame ${entry.id} is registered twice`);
  frames.set(entry.id, entry);
}
export function getFrame(id: string): FrameEntry | undefined {
  return frames.get(id);
}
export function listFrames(): FrameEntry[] {
  return [...frames.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}
