import { useState } from 'react';
import packageInfo from '../../package.json';
import './FeedbackForm.css';

const recipient = 'xikomiqaelyan@gmail.com';

// mailto opens a draft in the player's mail app; only that app can confirm delivery.
export function FeedbackForm() {
  const [description, setDescription] = useState('');
  const [reply, setReply] = useState('');
  const [message, setMessage] = useState('');
  const report = () => `Игра понятий ${packageInfo.version}\n\n${description.trim()}\n\nПочта для ответа: ${reply.trim() || 'не указана'}\nЭкран: ${window.innerWidth} × ${window.innerHeight}\nСистема: ${navigator.userAgent}\nПолучатель: ${recipient}`;
  const valid = () => {
    if (description.trim().length < 10) { setMessage('Опишите проблему чуть подробнее — хотя бы 10 символов.'); return false; }
    return true;
  };
  function email() {
    if (!valid()) return;
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(`Игра понятий ${packageInfo.version}: отзыв`)}&body=${encodeURIComponent(report())}`;
    setMessage('Откроется почтовое приложение с готовым текстом. Отправьте письмо в нём. Если приложение не открылось, скопируйте отчёт.');
  }
  return <div className="feedback-form">
    <p>Что произошло и что вы ожидали? Если можете, укажите действия, после которых появилась ошибка.</p>
    <label>Описание<textarea maxLength={4000} rows={5} value={description} onChange={event => setDescription(event.target.value)} /></label>
    <label>Почта для ответа (необязательно)<input type="email" maxLength={254} value={reply} onChange={event => setReply(event.target.value)} /></label>
    <small>К отчёту добавятся версия игры, размер экрана и сведения о браузере. Получатель: {recipient}.</small>
    <div className="feedback-actions">
      <button type="button" onClick={email}>Открыть письмо</button>
      <button type="button" onClick={async () => { if (!valid()) return; try { await navigator.clipboard.writeText(report()); setMessage('Отчёт скопирован. Его можно вставить в письмо.'); } catch { setMessage('Буфер обмена недоступен. Скопируйте описание вручную.'); } }}>Скопировать отчёт</button>
    </div>
    <p role="status">{message}</p>
  </div>;
}
