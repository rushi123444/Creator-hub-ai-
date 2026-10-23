import { useEffect, useState } from 'react';

function match(query) {
  try {
    return typeof window !== 'undefined' && window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

/** useMediaQuery('(max-width: 640px)') -> boolean, updates live. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => match(query));
  useEffect(() => {
    let mql;
    try {
      mql = window.matchMedia(query);
    } catch {
      return undefined;
    }
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener ? mql.addEventListener('change', onChange) : mql.addListener(onChange);
    return () => {
      mql.removeEventListener ? mql.removeEventListener('change', onChange) : mql.removeListener(onChange);
    };
  }, [query]);
  return matches;
}

/** Breakpoints used by the shell. Keep in sync with the CSS media queries. */
export const BREAKPOINTS = { mobile: 640, tablet: 1024 };

export const useIsMobile = () => useMediaQuery(`(max-width: ${BREAKPOINTS.mobile}px)`);
/** True up to and including tablet width (sidebar becomes an overlay). */
export const useIsCompact = () => useMediaQuery(`(max-width: ${BREAKPOINTS.tablet}px)`);

export default useMediaQuery;
