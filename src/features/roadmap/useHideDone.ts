// "Hide done" toggle, remembered per project in localStorage.
import { useEffect, useState } from 'react';

const key = (slug: string) => `hq.roadmap.hideDone.${slug}`;

function read(slug: string): boolean {
  try {
    return localStorage.getItem(key(slug)) === '1';
  } catch {
    return false;
  }
}

export function useHideDone(slug: string): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => read(slug));
  useEffect(() => setValue(read(slug)), [slug]);

  const set = (next: boolean) => {
    setValue(next);
    try {
      if (next) localStorage.setItem(key(slug), '1');
      else localStorage.removeItem(key(slug));
    } catch {
      // storage unavailable: the choice just won't persist
    }
  };
  return [value, set];
}
