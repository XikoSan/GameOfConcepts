import { useSyncExternalStore } from 'react';
import { useCompactTable } from './useCompactTable';

const query = '(pointer: fine) and (hover: hover)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const getSnapshot = () => window.matchMedia(query).matches;

export function useDesktopStatistics() {
  const compact = useCompactTable();
  const finePointer = useSyncExternalStore(subscribe, getSnapshot, () => false);
  return !compact && finePointer;
}
