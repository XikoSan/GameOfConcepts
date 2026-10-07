import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { readMusic, writeMusic } from '../services/musicStorage';
import type { CustomMusic } from '../services/musicStorage';

interface Track { id: string; title: string; src: string; custom?: boolean }
const builtInTracks: Track[] = [
  { id: 'music-for-manatees', title: 'Music for Manatees', src: '/music/music-for-manatees.mp3' },
  { id: 'clean-soul', title: 'Clean Soul', src: '/music/clean-soul.mp3' },
  { id: 'dreams-become-real', title: 'Dreams Become Real', src: '/music/dreams-become-real.mp3' },
];
function preference(key: string, fallback: string) {
  try { return localStorage.getItem(`music:${key}`) ?? fallback; } catch { return fallback; }
}

export function useBackgroundMusic(audioRef: RefObject<HTMLAudioElement | null>) {
  const objectUrls = useRef(new Set<string>());
  const [tracks, setTracks] = useState(builtInTracks);
  const [selected, setSelected] = useState(builtInTracks[0].id);
  const [volume, setVolume] = useState(() => {
    const value = Number(preference('volume', '0.25'));
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.25;
  });
  const [playing, setPlaying] = useState(() => Capacitor.isNativePlatform());
  const [foreground, setForeground] = useState(() => !document.hidden);
  useEffect(() => {
    let disposed = false;
    let nativeActive = true;
    const update = () => setForeground(nativeActive && !document.hidden);
    document.addEventListener('visibilitychange', update);
    const listener = Capacitor.isNativePlatform() ? NativeApp.addListener('appStateChange', ({ isActive }) => {
      nativeActive = isActive;
      if (!disposed) update();
    }) : null;
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', update);
      void listener?.then(handle => handle.remove());
    };
  }, []);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeTrack = tracks.find(track => track.id === selected) ?? tracks[0];

  useEffect(() => {
    let disposed = false;
    const urls = objectUrls.current;
    void readMusic().then(saved => {
      if (disposed) return;
      const custom = saved.filter(record => record.file || record.url).map(record => {
        const src = record.file ? URL.createObjectURL(record.file) : record.url!;
        if (record.file) urls.add(src);
        return { id: record.id, title: record.title, src, custom: true };
      });
      setTracks([...builtInTracks, ...custom]);
    }).catch(() => {
      if (!disposed) setError('Не удалось открыть хранилище музыки. Новые треки можно добавить на текущую сессию.');
    }).finally(() => { if (!disposed) setReady(true); });
    return () => { disposed = true; urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    try { localStorage.setItem('music:volume', String(volume)); } catch { /* Storage is optional. */ }
  }, [volume, audioRef]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem('music:track', activeTrack.id); } catch { /* Storage is optional. */ }
  }, [activeTrack.id, ready]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let obsolete = false;
    if (playing && foreground) {
      void audio.play().catch((reason: DOMException) => {
        if (obsolete) return;
        setPlaying(false);
        setLoading(false);
        setError(reason.name === 'NotAllowedError'
          ? 'Нажмите «Воспроизвести», чтобы разрешить музыку в браузере.'
          : 'Не удалось воспроизвести трек. Проверьте формат файла или прямую ссылку на аудио.');
      });
    } else audio.pause();
    return () => { obsolete = true; audio.pause(); };
  }, [playing, foreground, activeTrack.src, audioRef]);

  function select(id: string) { setError(''); setLoading(playing); setSelected(id); }
  function skip(offset: number) {
    const index = tracks.findIndex(track => track.id === activeTrack.id);
    select(tracks[(index + offset + tracks.length) % tracks.length].id);
  }
  const start = useCallback(() => { setError(''); setPlaying(true); }, []);
  function toggle() { setError(''); setLoading(!playing); setPlaying(value => !value); }
  async function add(records: CustomMusic[]) {
    setBusy(true); setError('');
    const added: Track[] = [];
    let unsaved = false;
    try {
      for (const record of records) {
        try { await writeMusic(record); } catch { unsaved = true; }
        const src = record.file ? URL.createObjectURL(record.file) : record.url!;
        if (record.file) objectUrls.current.add(src);
        added.push({ id: record.id, title: record.title, src, custom: true });
      }
      setTracks(previous => [...previous, ...added]);
      if (added[0]) { setSelected(added[0].id); setLoading(playing); }
      if (unsaved) setError('Треки добавлены на текущую сессию: в хранилище браузера недостаточно места или оно недоступно.');
    } finally { setBusy(false); }
  }
  async function addFiles(files: File[]) {
    const supported = files.filter(file => file.size > 0 && (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|oga|opus|m4a|aac|flac|webm)$/i.test(file.name)));
    if (!supported.length) { setError('Выберите аудиофайл: MP3, OGG, WAV или другой поддерживаемый браузером формат.'); return; }
    await add(supported.map(file => ({ id: crypto.randomUUID(), title: file.name.replace(/\.[^.]+$/, ''), file })));
    if (supported.length !== files.length) setError('Добавлены аудиофайлы. Пустые файлы и файлы других типов пропущены.');
  }
  async function addUrl(value: string) {
    try {
      const url = new URL(value.trim());
      if (!['http:', 'https:'].includes(url.protocol)) throw Error('protocol');
      if (location.protocol === 'https:' && url.protocol !== 'https:') {
        setError('Для этой страницы нужна защищённая ссылка на аудио, начинающаяся с https://.'); return false;
      }
      const title = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || url.hostname);
      await add([{ id: crypto.randomUUID(), title, url: url.href }]);
      return true;
    } catch { setError('Введите полную прямую ссылку на аудио: https://…'); return false; }
  }
  async function remove() {
    if (!activeTrack.custom) return;
    setBusy(true);
    try {
      await writeMusic(activeTrack.id);
      setPlaying(false); setLoading(false); setSelected(builtInTracks[0].id);
      setTracks(previous => previous.filter(track => track.id !== activeTrack.id));
      if (objectUrls.current.delete(activeTrack.src)) URL.revokeObjectURL(activeTrack.src);
      setError('');
    } catch { setError('Не удалось удалить трек из хранилища браузера.'); }
    finally { setBusy(false); }
  }
  function failed() {
    setPlaying(false); setLoading(false);
    setError('Трек недоступен или формат не поддерживается. Для ссылки нужен сам аудиофайл, а не страница музыкального сервиса.');
  }
  return { tracks, activeTrack, volume, setVolume, playing, loading, ready, busy, error, select, skip, toggle, start, addFiles, addUrl, remove, failed, loaded: () => setLoading(false) };
}
