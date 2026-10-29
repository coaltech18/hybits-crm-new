import { useEffect, useState } from 'react';

/**
 * Runs `loader` whenever it changes (wrap it in useCallback with the filter
 * deps). Each tab owns its loading state, and a response that arrives after
 * the filters changed or the tab unmounted is dropped, so a slow, stale
 * request can never overwrite newer data or raise an error on another tab.
 * A tab's error stays up while it reloads and clears only when a load
 * succeeds or the tab unmounts.
 */
export function useReportLoader<T>(
  loader: () => Promise<T>,
  initial: T,
  setError: (error: string | null) => void
) {
  const [empty] = useState(initial);
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loader()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setData(empty);
        setError(err instanceof Error ? err.message : 'Failed to load report');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loader, empty, setError]);

  // The error belongs to the mounted tab: drop it on unmount so it never
  // shows on the next tab.
  useEffect(() => () => setError(null), [setError]);

  return { data, loading };
}
