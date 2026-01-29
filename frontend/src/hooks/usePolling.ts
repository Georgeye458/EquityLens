import { useEffect, useRef, useCallback } from 'react';

interface UsePollingOptions {
  interval?: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

export function usePolling(
  callback: () => Promise<boolean>, // Return true to stop polling
  options: UsePollingOptions = {}
) {
  const { interval = 3000, enabled = true, onError } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const stopPolling = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return;
    }

    const poll = async () => {
      try {
        const shouldStop = await callbackRef.current();
        if (shouldStop) {
          stopPolling();
          return;
        }
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }

      timeoutRef.current = setTimeout(poll, interval);
    };

    // Start polling
    poll();

    return stopPolling;
  }, [enabled, interval, onError, stopPolling]);

  return { stopPolling };
}
