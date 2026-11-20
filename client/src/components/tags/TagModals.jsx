import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiX, FiCheck, FiTrash2, FiChevronUp, FiChevronDown, FiEdit2, FiTag,
} from 'react-icons/fi';
import { TAG_COLORS, tagColor, nextTagColor } from './tagColors';

/* ---------------- shared bits ---------------- */

const Shell = ({ open, onClose, title, subtitle, children, footer }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
            className="flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-sm sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
                {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <FiX size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3" style={{ scrollbarWidth: 'thin' }}>
              {children}
            </div>
            {footer && <div className="border-t border-slate-100 px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const ColorDots = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tag colour">
    {TAG_COLORS.map((c) => (
      <button
        key={c.key}
        type="button"
        role="radio"
        aria-checked={value === c.key}
        title={c.label}
        onClick={() => onChange(c.key)}
        className={`grid h-6 w-6 place-items-center rounded-full ${c.dot} ring-offset-2 transition ${
          value === c.key ? 'ring-2 ring-slate-400' : 'hover:scale-110'
        }`}
      >
        {value === c.key && <FiCheck size={12} className="text-white" strokeWidth={3} />}
      </button>
    ))}
  </div>
);

// Name + colour form, used for "New tag" in both modals.
const NewTagForm = ({ tags, onCreate, autoFocus = false, submitLabel = 'Create' }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(() => nextTagColor(tags));
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);
  useEffect(() => setColor(nextTagColor(tags)), [tags.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const ok = await onCreate(name.trim(), color);
    setBusy(false);
    if (ok) setName('');
  };

  return (
    <form onSubmit={submit} className="space-y-2.5 rounded-xl bg-slate-50 p-3">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="New tag name, e.g. Passport"
          aria-label="New tag name"
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-50"
        />
        <button
          type="submit"
          disabled={!name.trim() || busy}
          className="h-9 shrink-0 rounded-lg bg-navy-700 px-3 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
      <ColorDots value={color} onChange={setColor} />
    </form>
  );
};

/* ---------------- tag picker ---------------- */

/**
 * Tick the tags one item (a chat or a note) belongs to.
 * memberOf: Set of tag ids (strings) that already hold the item.
 */
export const TagPickerModal = ({ open, onClose, itemLabel, tags, memberOf, onToggle, onCreate }) => (
  <Shell open={open} onClose={onClose} title="Tags" subtitle={itemLabel}>
    {tags.length === 0 ? (
      <p className="py-2 text-sm text-slate-500">
        You have no tags yet. Make one below. Tags are only visible to you.
      </p>
    ) : (
      <ul className="-mx-2 mb-3">
        {tags.map((l) => {
          const checked = memberOf.has(String(l.id));
          const c = tagColor(l.color);
          return (
            <li key={l.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => onToggle(l, checked)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}`} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{l.name}</span>
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-md transition ${
                    checked ? 'bg-navy-700 text-white' : 'ring-1 ring-slate-300 text-transparent'
                  }`}
                >
                  <FiCheck size={12} strokeWidth={3} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    )}
    <NewTagForm tags={tags} onCreate={onCreate} submitLabel="Add" />
  </Shell>
);

/* ---------------- manage tags ---------------- */

const TagRow = ({ tag, count, isFirst, isLast, onMove, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const c = tagColor(tag.color);

  const save = async () => {
    const ok = await onUpdate(tag.id, { name: name.trim(), color });
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <li className="space-y-2.5 rounded-xl bg-slate-50 p-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
          maxLength={40}
          aria-label="Tag name"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-50"
        />
        <div className="flex items-center justify-between gap-2">
          <ColorDots value={color} onChange={setColor} />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className="h-8 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-slate-200/60">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!name.trim()}
            className="h-8 rounded-lg bg-navy-700 px-3 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800">{tag.name}</span>
        <span className="block text-[11px] text-slate-400">{count === 1 ? '1 item' : `${count} items`}</span>
      </span>
      <span className="flex shrink-0 items-center">
        <button
          onClick={() => onMove(-1)}
          disabled={isFirst}
          className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 disabled:opacity-30"
          aria-label={`Move ${tag.name} up`}
        >
          <FiChevronUp size={15} />
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={isLast}
          className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 disabled:opacity-30"
          aria-label={`Move ${tag.name} down`}
        >
          <FiChevronDown size={15} />
        </button>
        <button
          onClick={() => {
            setName(tag.name);
            setColor(tag.color);
            setEditing(true);
          }}
          className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-navy-700"
          aria-label={`Edit ${tag.name}`}
        >
          <FiEdit2 size={14} />
        </button>
        <button
          onClick={() => onDelete(tag)}
          className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          aria-label={`Delete ${tag.name}`}
        >
          <FiTrash2 size={14} />
        </button>
      </span>
    </li>
  );
};

/**
 * Create, rename, recolour, reorder and delete tags.
 * countOf(tag) -> how many items to show under the name.
 */
export const TagManagerModal = ({ open, onClose, tags, countOf, onCreate, onUpdate, onDelete, onReorder }) => {
  const move = (index, dir) => {
    const ids = tags.map((l) => l.id);
    const to = index + dir;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    onReorder(ids);
  };

  const confirmDelete = (tag) => {
    if (window.confirm(`Delete the tag "${tag.name}"? The chats and notes keep everything else; only this tag is removed from them.`)) onDelete(tag.id);
  };

  return (
    <Shell open={open} onClose={onClose} title="Your tags" subtitle="Only you can see your tags. Use them on chats and notes.">
      <NewTagForm tags={tags} onCreate={async (name, color) => !!(await onCreate(name, color))} autoFocus={tags.length === 0} />
      {tags.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400">
            <FiTag size={18} />
          </span>
          <p className="mt-2 text-sm text-slate-500">Group chats and notes by customer, service or anything you like.</p>
        </div>
      ) : (
        <ul className="-mx-2 mt-3 space-y-0.5">
          {tags.map((l, i) => (
            <TagRow
              key={l.id}
              tag={l}
              count={countOf ? countOf(l) : 0}
              isFirst={i === 0}
              isLast={i === tags.length - 1}
              onMove={(dir) => move(i, dir)}
              onUpdate={async (id, data) => !!(await onUpdate(id, data))}
              onDelete={confirmDelete}
            />
          ))}
        </ul>
      )}
    </Shell>
  );
};

/* ---------------- small tag badges ---------------- */

export const TagBadges = ({ tags = [], max = 2, className = '' }) => {
  if (!tags.length) return null;
  const shown = tags.slice(0, max);
  const extra = tags.length - shown.length;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
      {shown.map((l) => (
        <span
          key={l.id}
          className={`inline-flex max-w-[110px] items-center rounded-full px-1.5 py-px text-[10px] font-medium ring-1 ${tagColor(l.color).chip}`}
          title={l.name}
        >
          <span className="truncate">{l.name}</span>
        </span>
      ))}
      {extra > 0 && <span className="text-[10px] font-medium text-slate-400" title={tags.slice(max).map((l) => l.name).join(', ')}>+{extra}</span>}
    </span>
  );
};

