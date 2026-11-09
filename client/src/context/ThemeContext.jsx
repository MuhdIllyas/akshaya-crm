import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Chart } from 'chart.js';

const STORAGE_KEY = 'akshaya-theme';
const PREFERENCES = ['light', 'dark', 'system'];

// Customer-facing public pages stay light. Keep in sync with the inline script in index.html.
const THEMED_PATH = /^\/(dashboard|login|customer\/(?!register))/;

const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

const readPreference = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return PREFERENCES.includes(stored) ? stored : 'light';
  } catch {
    return 'light';
  }
};

// --- Chart.js draws on canvas, so CSS can't reach it ---
const CHART_TEXT = { light: '#64748b', dark: '#a9b5c2' };
const CHART_GRID = { light: 'rgba(0, 0, 0, 0.1)', dark: '#3b4859' };
const DATASET_DARK_COLORS = {
  '#1e3a5f': '#8fb8e3',
  '#0f1f3a': '#b8d0ea',
  'rgba(30,58,95,0.1)': 'rgba(143,184,227,0.12)',
  'rgba(30,58,95,0.10)': 'rgba(143,184,227,0.13)',
};
const DATASET_LIGHT_COLORS = Object.fromEntries(Object.entries(DATASET_DARK_COLORS).map(([light, dark]) => [dark, light]));

const swapColor = (value, swaps) => {
  if (typeof value === 'string') return swaps[value] ?? value;
  if (Array.isArray(value)) return value.map((item) => swapColor(item, swaps));
  return value;
};

const isDarkActive = () => document.documentElement.classList.contains('dark');

Chart.register({
  id: 'softDimDatasets',
  beforeUpdate(chart) {
    const swaps = isDarkActive() ? DATASET_DARK_COLORS : DATASET_LIGHT_COLORS;
    chart.data.datasets.forEach((dataset) => {
      Object.keys(dataset).forEach((key) => {
        if (/color/i.test(key)) dataset[key] = swapColor(dataset[key], swaps);
      });
    });
  },
});

const applyChartTheme = (isDark) => {
  const mode = isDark ? 'dark' : 'light';
  Chart.defaults.color = CHART_TEXT[mode];
  Chart.defaults.borderColor = CHART_GRID[mode];
  Object.values(Chart.instances).forEach((chart) => chart.update('none'));
};

/**
 * Runs `capture` with the light theme applied, for snapshots of on-screen content
 * (PDF exports) that should look the same whichever theme the user has picked.
 */
export const withLightTheme = async (capture) => {
  const root = document.documentElement;
  const wasDark = root.classList.contains('dark');
  if (!wasDark) return capture();

  root.classList.remove('dark');
  applyChartTheme(false);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    return await capture();
  } finally {
    root.classList.add('dark');
    applyChartTheme(true);
  }
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const { pathname } = useLocation();
  const [preference, setPreferenceState] = useState(readPreference);
  const [systemDark, setSystemDark] = useState(() => systemQuery().matches);

  useEffect(() => {
    const query = systemQuery();
    const onSystemChange = (event) => setSystemDark(event.matches);
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setPreferenceState(readPreference());
    };
    query.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    return () => {
      query.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const wantsDark = preference === 'dark' || (preference === 'system' && systemDark);
  const isDark = wantsDark && THEMED_PATH.test(pathname);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    applyChartTheme(isDark);
  }, [isDark]);

  const setPreference = useCallback((next) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can block storage; the choice still applies until reload.
    }
  }, []);

  const value = useMemo(() => ({ preference, setPreference, isDark }), [preference, setPreference, isDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
