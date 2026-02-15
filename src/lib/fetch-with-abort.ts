import { useRef, useEffect } from 'react';

export function fetchWithAbort(
  input: RequestInfo | URL,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<Response> {
  const controller = new AbortController();
  const signal = init?.signal || controller.signal;

  const promise = fetch(input, {
    ...init,
    signal,
  });

  return new Promise<Response>((resolve, reject) => {
    promise.then(resolve).catch((error) => {
      if (error.name === 'AbortError') {
        reject(new Error('Request aborted'));
      } else {
        reject(error);
      }
    });
  });
}

export function fetchWithCleanup(
  input: RequestInfo | URL,
  init?: RequestInit
): { promise: Promise<Response>; abort: () => void } {
  const controller = new AbortController();
  const signal = controller.signal;

  const promise = fetch(input, {
    ...init,
    signal,
  });

  return {
    promise,
    abort: () => controller.abort(),
  };
}

export function useAbortController() {
  const controllerRef = useRef<AbortController | null>(null);

  const abort = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
  };

  const getController = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();
    return controllerRef.current;
  };

  useEffect(() => {
    return () => {
      abort();
    };
  }, []);

  return { abort, getController };
}
