import React from 'react';
import { FiMonitor, FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: FiSun },
  { value: 'dark', label: 'Dark', Icon: FiMoon },
  { value: 'system', label: 'System', Icon: FiMonitor },
];

const ThemeToggle = ({ collapsed = false }) => {
  const { preference, setPreference } = useTheme();

  if (collapsed) {
    const index = OPTIONS.findIndex((option) => option.value === preference);
    const { label, Icon } = OPTIONS[index];
    const next = OPTIONS[(index + 1) % OPTIONS.length];
    return (
      <button
        type="button"
        onClick={() => setPreference(next.value)}
        title={`Theme: ${label}. Switch to ${next.label}`}
        aria-label={`Theme: ${label}. Switch to ${next.label}`}
        className="flex w-full items-center justify-center rounded-xl p-3 text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900"
      >
        <Icon className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(value)}
            className={`flex min-h-[32px] flex-1 items-center justify-center gap-1 rounded-lg px-1.5 text-xs font-medium transition-colors ${
              active ? 'bg-white text-navy-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
