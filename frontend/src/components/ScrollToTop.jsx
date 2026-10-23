import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** ScrollToTop: mount once inside the router. Scrolls to top on path change (not on query/hash changes). */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
