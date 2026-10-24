// src/components/tracking/ApplicationNumberField.jsx
// Long application numbers (e.g. 2003700630494325062026173426) are easy to mistype.
// This input shows a live, grouped "check view" + character count while typing,
// cleans pasted values, and saves on Enter / blur (Esc cancels).

import React, { useEffect, useRef, useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';

const LONG_AT = 10; // group numbers longer than this

/** Remove spaces, dashes, line breaks, etc. Letters are upper-cased. Keeps / . _ which some portals use. */
export const cleanAppNo = (v) =>
  String(v ?? '')
    .replace(/[\s​-‍﻿\-–—]+/g, '')
    .toUpperCase();

/** Split into groups of 4 for reading: 2003 7006 3049 ... */
export const groupAppNo = (v, size = 4) => {
  const s = cleanAppNo(v);
  if (!s) return [];
  if (s.length <= LONG_AT || /[/._]/.test(s)) return [s]; // short or already structured (PSK/2026/123)
  const out = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
};

/** Display helper: "2003 7006 3049 4325 ..." (thin spaces, still copies cleanly via the Copy button) */
export const formatAppNo = (v) => groupAppNo(v).join(' ');

/** Read-only display with grouping + copy */
export function AppNoDisplay({ value, className = '', empty = 'No app no.', showCopy = true }) {
  const [copied, setCopied] = useState(false);
  const clean = cleanAppNo(value);
  if (!clean) return <span className={`text-gray-400 ${className}`}>{empty}</span>;

  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* clipboard blocked */ }
  };

  return (
    <span className={`inline-flex items-center gap-1 font-mono ${className}`} title={clean}>
      <span className="tabular-nums">{formatAppNo(clean)}</span>
      {showCopy && (
        <button
          type="button"
          onClick={copy}
          className="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          title={copied ? 'Copied' : 'Copy application number'}
          aria-label="Copy application number"
        >
          {copied ? <FiCheck className="h-3 w-3 text-emerald-600" /> : <FiCopy className="h-3 w-3" />}
        </button>
      )}
    </span>
  );
}

/** The grouped check view shown while typing */
function CheckView({ draft, previous }) {
  const groups = groupAppNo(draft);
  const clean = cleanAppNo(draft);
  const prev = cleanAppNo(previous);
  const changed = prev && clean !== prev;

  return (
    <div className="space-y-1.5">
      {groups.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {groups.map((g, i) => (
            <span
              key={i}
              className={`px-1.5 py-0.5 rounded font-mono text-base font-semibold tabular-nums tracking-wider ${
                i % 2 === 0 ? 'bg-blue-50 text-[#172a45]' : 'bg-gray-100 text-gray-900'
              }`}
            >
              {g}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Type or paste the application number</p>
      )}
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span>{clean.length} characters{groups.length > 1 ? ` · ${groups.length} groups of 4` : ''}</span>
        <span>Enter to save · Esc to cancel</span>
      </div>
      {changed && (
        <p className="text-[11px] text-amber-700">
          Was: <span className="font-mono">{formatAppNo(prev)}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Input with check view.
 *
 * Save mode (default):   <ApplicationNumberField value={x} onSave={(v) => ...} />
 *   - saves on Enter or when the field loses focus, only if changed; Esc restores.
 * Form mode:             <ApplicationNumberField value={x} onChange={(v) => ...} mode="form" />
 *   - just reports the cleaned value on every change (for forms with their own Save button).
 *
 * variant="cell" shows the check view as a popup (for narrow table cells);
 * variant="block" shows it inline under the input.
 */
export default function ApplicationNumberField({
  value = '',
  onSave,
  onChange,
  mode = 'save',
  variant = 'block',
  placeholder = 'Application number',
  maxLength = 50,
  inputClassName = '',
  name,
  id,
}) {
  const [draft, setDraft] = useState(value || '');
  const [focused, setFocused] = useState(false);
  const cancelled = useRef(false);
  const inputRef = useRef(null);

  // Follow outside changes (e.g. switching to another application)
  useEffect(() => {
    if (!focused) setDraft(value || '');
  }, [value, focused]);

  const update = (raw) => {
    const next = cleanAppNo(raw).slice(0, maxLength);
    setDraft(next);
    if (mode === 'form' && onChange) onChange(next);
  };

  const commit = () => {
    if (mode !== 'save') return;
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = cleanAppNo(draft);
    if (next !== cleanAppNo(value) && onSave) onSave(next);
  };

  const showCheck = focused && (variant === 'block' || cleanAppNo(draft).length > 0 || cleanAppNo(value));
  const isLong = cleanAppNo(draft).length > LONG_AT;

  const baseInput =
    'w-full font-mono tabular-nums tracking-wide outline-none transition';

  return (
    <div className={`relative ${variant === 'cell' ? '' : 'space-y-1.5'}`}>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode={/^\d*$/.test(draft) ? 'numeric' : 'text'}
        autoComplete="off"
        spellCheck={false}
        value={draft}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onChange={(e) => update(e.target.value)}
        onPaste={(e) => {
          e.preventDefault();
          update(e.clipboardData.getData('text'));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            inputRef.current?.blur();
          } else if (e.key === 'Escape') {
            cancelled.current = true;
            setDraft(value || '');
            inputRef.current?.blur();
          }
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        title={draft ? formatAppNo(draft) : undefined}
        className={
          inputClassName ||
          (variant === 'cell'
            ? `${baseInput} text-xs border border-transparent hover:border-gray-200 focus:border-[#172a45] rounded-md px-2 py-1 bg-transparent focus:bg-white`
            : `${baseInput} text-sm px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#172a45] focus:border-[#172a45]`)
        }
      />

      {variant === 'block' && focused && (
        <div className="rounded-lg border border-blue-100 bg-white p-2">
          <CheckView draft={draft} previous={value} />
        </div>
      )}

      {variant === 'cell' && showCheck && (
        <div
          className={`absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 ${
            isLong ? 'w-[380px]' : 'w-[260px]'
          }`}
          // keep focus in the input when clicking inside the popup
          onMouseDown={(e) => e.preventDefault()}
        >
          <CheckView draft={draft} previous={value} />
        </div>
      )}
    </div>
  );
}