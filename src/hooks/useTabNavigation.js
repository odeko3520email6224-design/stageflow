import { useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export const useTabNavigation = (defaultTab = 'staff') => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || defaultTab;

  // Persist scroll position per tab so switching back restores position
  const scrollPositions = useRef({});

  const saveScrollPosition = useCallback((tabId) => {
    scrollPositions.current[tabId] = window.scrollY;
  }, []);

  const restoreScrollPosition = useCallback((tabId) => {
    const saved = scrollPositions.current[tabId];
    // Use rAF to wait for the tab content to mount before scrolling
    requestAnimationFrame(() => {
      window.scrollTo({ top: saved ?? 0, behavior: 'instant' });
    });
  }, []);

  const setTab = useCallback((newTab, options = {}) => {
    // Save current tab scroll before switching
    saveScrollPosition(tab);
    const params = new URLSearchParams();
    if (newTab !== defaultTab) params.set('tab', newTab);
    if (options.reset) {
      scrollPositions.current[newTab] = 0;
    }
    setSearchParams(params, { replace: Boolean(options.replace) });
    restoreScrollPosition(newTab);
  }, [tab, defaultTab, setSearchParams, saveScrollPosition, restoreScrollPosition]);

  return [tab, setTab];
};