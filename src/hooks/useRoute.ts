import { useState, useEffect, useCallback } from 'react';

/**
 * Lightweight client-side routing hook using the History API.
 * Supports two routes:
 *   /            → no draft selected (landing page)
 *   /draft/:id   → a specific draft is active
 */
export function useRoute() {
  const getRouteState = () => {
    const parts = window.location.pathname.split('/');
    // /draft/:id
    if (parts[1] === 'draft' && parts[2]) {
      return { draftId: decodeURIComponent(parts[2]) };
    }
    return { draftId: null };
  };

  const [route, setRoute] = useState(getRouteState);

  // Listen for browser back/forward
  useEffect(() => {
    const onPop = () => setRoute(getRouteState());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      setRoute(getRouteState());
    }
  }, []);

  return { draftId: route.draftId, navigate };
}
