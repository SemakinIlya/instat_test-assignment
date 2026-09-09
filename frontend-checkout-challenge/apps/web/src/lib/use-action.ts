import { useCallback, useState } from 'react';
import { reportError } from '@/api';

export function useActionError() {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      reportError(cause, setError);
    }
  }, []);
  return { error, setError, run };
}
