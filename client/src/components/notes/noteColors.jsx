import React, { useState, useEffect, useRef } from 'react';
import { FiCheck, FiDroplet } from 'react-icons/fi';

/* Shared by NotesPanel and NoteEditorModal. Same storage key as NotesPage,
   so a colour picked anywhere shows up everywhere (until the API stores it). */

export const COLOR_STORAGE_KEY = 'notes_colors_v1';

export const NOTE_COLORS = [
  { key: 'default', label: 'Default', bg: 'bg-white', border: 'border-slate-200', dot: 'bg-white', hex: '#ffffff' },
  { key: 'red', label: 'Red', bg: 'bg-rose-100', border: 'border-rose-200', dot: 'bg-rose-200', hex: '#ffe4e6' },
  { key: 'orange', label: 'Orange', bg: 'bg-orange-100', border: 'border-orange-200', dot: 'bg-orange-200', hex: '#ffedd5' },
  { key: 'yellow', label: 'Yellow', bg: 'bg-amber-100', border: 'border-amber-200', dot: 'bg-amber-200', hex: '#fef3c7' },
  { key: 'green', label: 'Green', bg: 'bg-emerald-100', border: 'border-emerald-200', dot: 'bg-emerald-200', hex: '#d1fae5' },
  { key: 'teal', label: 'Teal', bg: 'bg-teal-100', border: 'border-teal-200', dot: 'bg-teal-200', hex: '#ccfbf1' },
  { key: 'blue', label: 'Blue', bg: 'bg-sky-100', border: 'border-sky-200', dot: 'bg-sky-200', hex: '#e0f2fe' },
  { key: 'indigo', label: 'Dark blue', bg: 'bg-indigo-100', border: 'border-indigo-200', dot: 'bg-indigo-200', hex: '#e0e7ff' },
  { key: 'purple', label: 'Purple', bg: 'bg-violet-100', border: 'border-violet-200', dot: 'bg-violet-200', hex: '#ede9fe' },
  { key: 'pink', label: 'Pink', bg: 'bg-pink-100', border: 'border-pink-200', dot: 'bg-pink-200', hex: '#fce7f3' },
  { key: 'brown', label: 'Brown', bg: 'bg-stone-200', border: 'border-stone-300', dot: 'bg-stone-300', hex: '#e7e5e4' },
  { key: 'grey', label: 'Grey', bg: 'bg-slate-200', border: 'border-slate-300', dot: 'bg-slate-300', hex: '#e2e8f0' },
];

export const colorOf = (key) => NOTE_COLORS.find((c) => c.key === key) || NOTE_COLORS[0];

export const loadColors = () => {
  try {
    return JSON.parse(localStorage.getItem(COLOR_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

export const rememberNoteColor = (id, key) => {
  if (id == null) return;
  try {
    const map = loadColors();
    if (!key || key === 'default') delete map[id];
    else map[id] = key;
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable: the colour just won't persist locally */
  }
};

/** Colour a note should show: the API value wins, then this device's memory. */
export const resolveNoteColor = (note, overrides) => {
  // The saved colour is shared by everyone; this device's memory only covers notes that have none yet.
  if (note?.color && NOTE_COLORS.some((c) => c.key === note.color)) return note.color;
  return overrides?.[note?.id] || 'default';
};

const Dot = ({ c, selected, onPick }) => (
  <button
    type="button"
    role="option"
    aria-selected={selected}
    title={c.label}
    aria-label={c.label}
    onClick={() => onPick(c.key)}
    className={`flex h-6 w-6 items-center justify-center rounded-full border ${c.dot} ${
      c.key === 'default' ? 'border-slate-300' : c.border
    } ${selected ? 'ring-2 ring-navy-700 ring-offset-1' : 'hover:ring-2 hover:ring-slate-300'}`}
  >
    {selected && <FiCheck className="h-3 w-3 text-navy-700" />}
  </button>
);

/** Always-visible row of swatches (used inside the editor). */
export const ColorRow = ({ value, onChange }) => (
  <div role="listbox" aria-label="Note colour" className="flex flex-wrap gap-1.5">
    {NOTE_COLORS.map((c) => (
      <Dot key={c.key} c={c} selected={value === c.key} onPick={onChange} />
    ))}
  </div>
);

/** Droplet button that opens a small swatch popover (used on cards). */
export const ColorPicker = ({ value, onChange, align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Background colour"
        aria-label="Background colour"
        aria-expanded={open}
        className="rounded-lg p-1.5 text-slate-500 hover:bg-black/5 hover:text-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
      >
        <FiDroplet className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Choose a colour"
          className={`absolute top-full z-30 mt-2 grid w-[172px] grid-cols-6 gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {NOTE_COLORS.map((c) => (
            <Dot
              key={c.key}
              c={c}
              selected={value === c.key}
              onPick={(k) => {
                onChange(k);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};