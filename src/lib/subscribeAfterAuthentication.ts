export interface AuthenticatedSubscription {
  unsubscribe: () => void;
}

// Keep cancellation synchronous even while authentication is still pending.
export function subscribeAfterAuthentication(
  authenticate: () => Promise<void>,
  subscribe: () => AuthenticatedSubscription,
  onError: (error: unknown) => void,
): AuthenticatedSubscription {
  let cancelled = false;
  let subscription: AuthenticatedSubscription | undefined;
  void (async () => {
    try {
      await authenticate();
      if (!cancelled) subscription = subscribe();
    } catch (error) {
      if (!cancelled) onError(error);
    }
  })();
  return {
    unsubscribe: () => {
      if (cancelled) return;
      cancelled = true;
      subscription?.unsubscribe();
    },
  };
}
