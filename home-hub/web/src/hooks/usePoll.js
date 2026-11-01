import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export function usePoll(url, intervalMs = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const result = await api.get(url);
      if (reqId.current === id) {
        setData(result);
        setError('');
      }
      return result;
    } catch (err) {
      if (reqId.current === id) setError(err.message);
      return null;
    } finally {
      if (reqId.current === id) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    refresh();
    return () => {
      reqId.current += 1;
    };
  }, [refresh]);

  useEffect(() => {
    if (!intervalMs) return undefined;
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { data, loading, error, refresh, setData };
}
