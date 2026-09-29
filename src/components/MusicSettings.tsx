import { useState } from 'react';
import type { useBackgroundMusic } from '../hooks/useBackgroundMusic';
import './MusicSettings.css';

export function MusicControls({ music }: { music: ReturnType<typeof useBackgroundMusic> }) {
  const controls = [
    { label: 'Предыдущий трек', action: () => music.skip(-1), path: 'M6 5v14M19 5l-10 7 10 7Z' },
    { label: music.playing ? 'Пауза' : 'Воспроизвести', action: music.toggle, path: music.playing ? 'M8 5v14M16 5v14' : 'm8 5 11 7-11 7Z' },
    { label: 'Следующий трек', action: () => music.skip(1), path: 'M18 5v14M5 5l10 7-10 7Z' },
  ];
  return <div className="music-controls" role="group" aria-label="Управление музыкой">
    {controls.map(control => <button key={control.label} type="button" aria-label={control.label} title={control.label} onClick={control.action} disabled={!music.ready}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={control.path} /></svg>
    </button>)}
  </div>;
}

export function MusicSettings({ music }: { music: ReturnType<typeof useBackgroundMusic> }) {
  const [url, setUrl] = useState('');
  return <section className="music-settings" aria-labelledby="music-title">
    <div className="music-main-row">
    <label id="music-title" htmlFor="music-track">Музыка</label>
    <select id="music-track" value={music.activeTrack.id} onChange={event => music.select(event.target.value)} disabled={!music.ready || music.busy}>
      {music.tracks.map(track => <option key={track.id} value={track.id}>{track.title}{track.custom ? ' · свой трек' : ''}</option>)}
    </select>
    <div className="music-volume"><label htmlFor="music-volume" title="Громкость">♪</label><input id="music-volume" aria-label="Громкость" type="range" min="0" max="100" value={Math.round(music.volume * 100)} onChange={event => music.setVolume(Number(event.target.value) / 100)} /><output htmlFor="music-volume">{Math.round(music.volume * 100)}%</output></div>
    </div>
    {music.loading && <p role="status">Загрузка аудио…</p>}
    <details className="music-custom"><summary>Своя музыка</summary>
      <label htmlFor="music-files">Добавить аудиофайлы</label>
      <input id="music-files" type="file" accept="audio/*,.mp3,.wav,.ogg,.opus,.m4a,.aac,.flac" multiple disabled={!music.ready || music.busy} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (files.length) void music.addFiles(files); }} />
      <label htmlFor="music-url">Прямая ссылка на аудио</label>
      <form className="music-url" onSubmit={event => { event.preventDefault(); void music.addUrl(url).then(added => { if (added) setUrl(''); }); }}>
        <input id="music-url" type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com/music.mp3" required />
        <button type="submit" disabled={!music.ready || music.busy}>Добавить</button>
      </form>
      <p>Файлы сохраняются только в этом браузере. Ссылки должны вести на аудиофайл, а не на страницу YouTube или Spotify.</p>
      {music.activeTrack.custom && <button type="button" disabled={music.busy} onClick={() => void music.remove()}>Удалить выбранный трек</button>}
    </details>
    {music.error && <p className="music-error" role="alert">{music.error}</p>}
    <details className="music-attribution"><summary>Авторы музыки</summary><p className="music-credits">Встроенная музыка: <a href="https://incompetech.com/" target="_blank" rel="noreferrer">Kevin MacLeod</a> — Clean Soul, Dreams Become Real, Music for Manatees. <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Аудио перекодировано.</p></details>
  </section>;
}
