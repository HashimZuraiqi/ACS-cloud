import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem('theme-preference');
    return saved ? saved === 'dark' : true; // default to dark
  } catch { return true; }
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(getInitialTheme);

  // Update DOM and localStorage when theme changes
  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
      localStorage.setItem('theme-preference', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme-preference', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
