import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const KEY = 'io2:estudiados';
const ProgressContext = createContext({ studied: new Set(), toggle: () => {} });

function load() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    return new Set();
  }
}

/** Temas marcados como estudiados. Se guarda en el navegador de cada persona. */
export function ProgressProvider({ children }) {
  const [studied, setStudied] = useState(load);
  const toggle = useCallback((id) => {
    setStudied((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* sin almacenamiento: queda en memoria */ }
      return next;
    });
  }, []);
  const value = useMemo(() => ({ studied, toggle }), [studied, toggle]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export const useProgress = () => useContext(ProgressContext);
