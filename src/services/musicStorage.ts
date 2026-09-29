export interface CustomMusic {
  id: string;
  title: string;
  file?: Blob;
  url?: string;
}

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('game-of-concepts-music', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('tracks', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readMusic(): Promise<CustomMusic[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readonly');
    const request = tx.objectStore('tracks').getAll();
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function writeMusic(track: CustomMusic | string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    if (typeof track === 'string') tx.objectStore('tracks').delete(track);
    else tx.objectStore('tracks').put(track);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
