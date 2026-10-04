import { useSyncExternalStore } from 'react';

const query = '(max-width: 900px), (max-width: 1200px) and (max-height: 600px), (pointer: coarse) and (max-height: 600px)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
export function useCompactTable() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
