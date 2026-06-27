import { createContext, useContext, useEffect, useState } from 'react';

const THEMES = [
  { key: 'light', label: 'Light', swatchColor: '#D6661F' },
  { key: 'dark', label: 'Dark', swatchColor: '#16140F' },
  { key: 'green', label: 'Green', swatchColor: '#1F7A52' },
  { key: 'blue', label: 'Blue', swatchColor: '#275C8C' },
];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Real app, not a Claude-generated artifact - localStorage is the
  // correct, normal tool here for a user preference that should
  // survive a page refresh and a new session.
  const [theme, setTheme] = useState(() => localStorage.getItem('sitetracker-theme') || 'blue');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sitetracker-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
