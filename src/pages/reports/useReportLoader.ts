import { useEffect, useState } from 'react';

/**
 * Runs `loader` whenever it changes (wrap it in useCallback with the filter
 * deps). Each tab owns its loading state, and a response that arrives after
 * the filters changed or the tab unmounted is dropped, so a slow, stale
 * request can never overwrite newer data or raise an error on another tab.
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
    setError(null);

    loader()
      .then((result) => {
        if (!cancelled) setData(result);
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

  return { data, loading };
}
