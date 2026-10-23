import { useEffect } from 'react';

const BASE = 'CreatorHub AI';

/** Sets the browser tab title: useDocumentTitle('Trends') -> 'Trends · CreatorHub AI'. */
export function useDocumentTitle(title) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} · ${BASE}` : BASE;
    return () => {
      document.title = prev;
    };
  }, [title]);
}

export default useDocumentTitle;
