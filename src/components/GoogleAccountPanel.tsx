import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { useGoogleAccount } from '../hooks/useGoogleAccount';

type Props = {
  user: User | null | undefined;
  account: ReturnType<typeof useGoogleAccount>;
  settings?: boolean;
};

export function GoogleAccountPanel({ user, account, settings = false }: Props) {
  const [confirmation, setConfirmation] = useState<'sign-in' | 'sign-out' | null>(null);
  const guest = user?.is_anonymous === true;
  const signedIn = Boolean(user && !guest);

  if (!account.enabled) return null;

  return (
    <section className="google-account-panel" aria-label="Игровой аккаунт">
      <div>
        <strong>{signedIn ? 'Вход через Google выполнен' : 'Игровой аккаунт'}</strong>
        {signedIn && settings && user?.email && <p>{user.email}</p>}
        {!signedIn && <p>Войдите через Google, чтобы вернуться в онлайн-партию на другом устройстве. Играть можно и гостем.</p>}
      </div>
      {account.error && <p role="alert">{account.error}</p>}
      {user === undefined && <p role="status">Проверяем сессию…</p>}
      {confirmation && (
        <p>{confirmation === 'sign-in'
          ? 'При смене аккаунта партии текущего гостя не будут перенесены. Чтобы сохранить их, привяжите свободный Google-аккаунт к этой сессии.'
          : 'Вы выйдете из аккаунта на этом устройстве. Войдите снова через тот же Google-аккаунт, чтобы вернуться в свои онлайн-партии.'}</p>
      )}
      <div className="google-account-actions">
        {confirmation ? (
          <>
            <button type="button" disabled={account.busy} onClick={() => {
              setConfirmation(null);
              if (confirmation === 'sign-out') void account.signOut();
              else void account.signIn('sign-in');
            }}>{confirmation === 'sign-out' ? 'Выйти из аккаунта' : 'Сменить аккаунт'}</button>
            <button type="button" disabled={account.busy} onClick={() => setConfirmation(null)}>Отмена</button>
          </>
        ) : signedIn ? (
          settings && <button type="button" disabled={account.busy} onClick={() => setConfirmation('sign-out')}>Выйти</button>
        ) : user !== undefined && (
          <>
            <button type="button" disabled={account.busy} onClick={() => { void account.signIn(guest ? 'link' : 'sign-in'); }}>
              {guest ? 'Привязать Google' : 'Войти через Google'}
            </button>
            {guest && (
              <button type="button" disabled={account.busy} onClick={() => setConfirmation('sign-in')}>
                Войти в существующий аккаунт
              </button>
            )}
          </>
        )}
      </div>
      {settings && signedIn && (
        <a href="https://game-of-concepts.vercel.app/privacy.html#delete-account" target="_blank" rel="noreferrer">
          Запросить удаление аккаунта
        </a>
      )}
    </section>
  );
}
