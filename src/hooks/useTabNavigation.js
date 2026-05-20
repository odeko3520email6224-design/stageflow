import { useSearchParams } from 'react-router-dom';

export const useTabNavigation = (defaultTab = 'staff') => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || defaultTab;

  const setTab = (newTab, options = {}) => {
    const params = new URLSearchParams();
    if (newTab !== defaultTab) params.set('tab', newTab);
    setSearchParams(params, { replace: Boolean(options.replace) });
  };

  return [tab, setTab];
};
