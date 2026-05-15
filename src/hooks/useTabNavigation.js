import { useSearchParams } from 'react-router-dom';

export const useTabNavigation = (defaultTab = 'staff') => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || defaultTab;

  const setTab = (newTab) => {
    setSearchParams({ tab: newTab }, { replace: false });
  };

  return [tab, setTab];
};