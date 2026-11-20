import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { getSupabaseClient } from './supabaseClient';

export const googleAuthEnabled = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true';
const androidCallback = 'com.xikosan.gameofconcepts://auth/callback';
const pendingKey = 'game:google-auth';
const attemptLifetime = 15 * 60 * 1000;
const callbackParams = ['auth', 'code', 'error', 'error_code', 'error_description'];

export type GoogleAuthAction = 'sign-in' | 'link';
type Attempt = { action: GoogleAuthAction; startedAt: number };
type CallbackResult = { action: GoogleAuthAction; error?: string };

function webCallback() {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set('auth', 'google');
  return url;
}

function webWindow() {
  // GameViewport serves the game inside a same-origin frame. Google needs a
  // top-level navigation, and the return code appears in both browsing contexts.
  try {
    const top = window.top;
    if (top?.location.origin === window.location.origin) return top;
  } catch { /* A third-party embedding page cannot be accessed. */ }
  return window;
}

function readCallback(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;

  if (Capacitor.isNativePlatform()) {
    const expected = new URL(androidCallback);
    return url.protocol === expected.protocol && url.host === expected.host &&
      url.pathname === expected.pathname ? url : null;
  }

  const expected = webCallback();
  return url.origin === expected.origin && url.pathname === expected.pathname &&
    url.searchParams.get('auth') === 'google' ? url : null;
}

export function googleAuthError(errorCode?: string | null) {
  switch (errorCode) {
    case 'identity_already_exists':
    case 'email_exists':
      return 'Этот Google-аккаунт уже используется в игре. Вы можете войти в него отдельно. Гостевые партии останутся в текущей сессии до смены аккаунта.';
    case 'access_denied':
      return 'Вход через Google отменён.';
    default:
      return 'Не удалось войти через Google. Проверьте соединение и попробуйте ещё раз.';
  }
}

export async function startGoogleAuth(action: GoogleAuthAction) {
  const options = {
    redirectTo: Capacitor.isNativePlatform() ? androidCallback : webCallback().href,
    skipBrowserRedirect: true,
    queryParams: { prompt: 'select_account' },
  };
  const request = { provider: 'google' as const, options };

  try {
    const auth = getSupabaseClient().auth;
    if (action === 'link') {
      const { data, error } = await auth.getSession();
      if (error || !data.session?.user.is_anonymous) {
        return 'Гостевая сессия недоступна. Откройте онлайн-игру и попробуйте ещё раз.';
      }
    }
    const { data, error } = action === 'link'
      ? await auth.linkIdentity(request)
      : await auth.signInWithOAuth(request);
    if (error) return googleAuthError(error.code);
    if (!data.url || new URL(data.url).protocol !== 'https:') return googleAuthError();

    const attempt: Attempt = { action, startedAt: Date.now() };
    window.localStorage.setItem(pendingKey, JSON.stringify(attempt));
    if (Capacitor.isNativePlatform()) await Browser.open({ url: data.url });
    else webWindow().location.assign(data.url);
  } catch {
    return googleAuthError();
  }
}

export async function finishGoogleAuth(value: string): Promise<CallbackResult | null> {
  const url = readCallback(value);
  if (!url) return null;

  if (!Capacitor.isNativePlatform()) {
    for (const view of new Set([window, webWindow()])) {
      const cleanUrl = new URL(view.location.href);
      if (cleanUrl.searchParams.get('auth') !== 'google') continue;
      for (const key of callbackParams) cleanUrl.searchParams.delete(key);
      view.history.replaceState(view.history.state, '', cleanUrl);
    }
  }

  let attempt: Attempt | null;
  try {
    attempt = JSON.parse(window.localStorage.getItem(pendingKey) ?? 'null');
    window.localStorage.removeItem(pendingKey);
  } catch {
    return null;
  }

  if (!attempt || (attempt.action !== 'link' && attempt.action !== 'sign-in') ||
      !(Date.now() - attempt.startedAt <= attemptLifetime)) return null;

  const { action } = attempt;
  const errorCode = url.searchParams.get('error_code') ?? url.searchParams.get('error');
  if (errorCode) return { action, error: googleAuthError(errorCode) };

  const code = url.searchParams.get('code');
  if (!code) return { action, error: googleAuthError() };
  try {
    const { error } = await getSupabaseClient().auth.exchangeCodeForSession(code);
    return error ? { action, error: googleAuthError(error.code) } : { action };
  } catch {
    return { action, error: googleAuthError() };
  }
}
