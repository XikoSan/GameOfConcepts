import { useEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { getSupabaseClient } from '../lib/supabaseClient';
import { finishGoogleAuth, googleAuthEnabled, startGoogleAuth, type GoogleAuthAction } from '../lib/googleAuth';

export function useGoogleAccount(onReturn: (changedAccount: boolean, showOnline: boolean) => void) {
  const [ready, setReady] = useState(!googleAuthEnabled);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const actionRunning = useRef(false);

  useEffect(() => {
    if (!googleAuthEnabled) return;

    let disposed = false;
    let listener: PluginListenerHandle | undefined;

    const finish = async (url: string) => {
      if (disposed) return;
      const result = await finishGoogleAuth(url);
      if (!result || disposed) return;
      setError(result.error ?? '');
      onReturn(!result.error && result.action === 'sign-in', true);
    };

    const listen = async () => {
      if (!Capacitor.isNativePlatform()) {
        if (!disposed) await finish(window.location.href);
        return;
      }

      const subscription = await NativeApp.addListener('appUrlOpen', ({ url }) => { void finish(url); });
      if (disposed) {
        void subscription.remove();
        return;
      }
      listener = subscription;
      const launch = await NativeApp.getLaunchUrl();
      if (launch?.url) await finish(launch.url);
    };

    // Register before reading the cold-start link. A Strict Mode remount must
    // not consume the pending attempt before the live listener is installed.
    void Promise.resolve().then(listen)
      .catch(() => {
        if (!disposed) setError('Не удалось подключить вход через Google.');
      })
      .finally(() => {
        if (!disposed) setReady(true);
      });
    return () => {
      disposed = true;
      void listener?.remove();
    };
  }, [onReturn]);

  const run = async (operation: () => Promise<string | undefined>) => {
    if (actionRunning.current) return;
    actionRunning.current = true;
    setBusy(true);
    setError('');
    try {
      setError(await operation() ?? '');
    } finally {
      actionRunning.current = false;
      setBusy(false);
    }
  };

  return {
    enabled: googleAuthEnabled,
    ready,
    busy: busy || !ready,
    error,
    signIn: (action: GoogleAuthAction) => run(() => startGoogleAuth(action)),
    signOut: () => run(async () => {
      try {
        const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
        if (!error) {
          onReturn(true, false);
          return;
        }
      } catch { /* Preserve the visible account on a failed sign-out. */ }
      return 'Не удалось выйти из аккаунта. Попробуйте ещё раз.';
    }),
  };
}
