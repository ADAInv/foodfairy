import { useCallback } from 'react';
import { useRouter } from './router';

/** The one action that matters: get to the food. */
export function useOrderNow() {
  const { path, navigate } = useRouter();
  return useCallback(() => {
    if (path === '/' || path === '/menu') document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else navigate('/#menu');
  }, [path, navigate]);
}
