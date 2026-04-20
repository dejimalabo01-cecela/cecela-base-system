import { useState, useEffect } from 'react';

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('cecela_theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('cecela_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('cecela_theme', 'light');
    }
  }, [isDark]);

  return { isDark, toggleTheme: () => setIsDark(d => !d) };
}
