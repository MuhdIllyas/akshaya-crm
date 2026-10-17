import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiEdit3, FiAtSign, FiUser, FiExternalLink, FiLock, FiMapPin,
  FiBookmark, FiEdit2, FiTrash2, FiX, FiCheck, FiDroplet, FiChevronDown,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { MentionsInput, Mention } from 'react-mentions';
import { getStaff } from '@/services/serviceService';
import { createNote } from '@/services/noteService';
import api from '@/services/serviceService';
import { toast } from 'react-toastify';

/* ---------------- constants ---------------- */

const DEFAULT_TITLE = 'General Note';
const COLOR_STORAGE_KEY = 'notes_colors_v1';
const GAP = 12; // px between cards
const MIN_CARD_W = 250; // px, decides how many columns fit
const COLLAPSE_LINES = 10; // taller notes are cut with "Show more"

// Google-Keep style note colours. Full class names so Tailwind can see them.
const NOTE_COLORS = [
  { key: 'default', label: 'Default', bg: 'bg-white', border: 'border-slate-200', dot: 'bg-white' },
  { key: 'red', label: 'Red', bg: 'bg-rose-100', border: 'border-rose-200', dot: 'bg-rose-200' },
  { key: 'orange', label: 'Orange', bg: 'bg-orange-100', border: 'border-orange-200', dot: 'bg-orange-200' },
  { key: 'yellow', label: 'Yellow', bg: 'bg-amber-100', border: 'border-amber-200', dot: 'bg-amber-200' },
  { key: 'green', label: 'Green', bg: 'bg-emerald-100', border: 'border-emerald-200', dot: 'bg-emerald-200' },
  { key: 'teal', label: 'Teal', bg: 'bg-teal-100', border: 'border-teal-200', dot: 'bg-teal-200' },
  { key: 'blue', label: 'Blue', bg: 'bg-sky-100', border: 'border-sky-200', dot: 'bg-sky-200' },
  { key: 'indigo', label: 'Dark blue', bg: 'bg-indigo-100', border: 'border-indigo-200', dot: 'bg-indigo-200' },
  { key: 'purple', label: 'Purple', bg: 'bg-violet-100', border: 'border-violet-200', dot: 'bg-violet-200' },
  { key: 'pink', label: 'Pink', bg: 'bg-pink-100', border: 'border-pink-200', dot: 'bg-pink-200' },
  { key: 'brown', label: 'Brown', bg: 'bg-stone-200', border: 'border-stone-300', dot: 'bg-stone-300' },
  { key: 'grey', label: 'Grey', bg: 'bg-slate-200', border: 'border-slate-300', dot: 'bg-slate-300' },
];
const colorOf = (key) => NOTE_COLORS.find((c) => c.key === key) || NOTE_COLORS[0];

const VISIBILITY_OPTIONS = [
  { value: 'centre', label: 'Centre' },
  { value: 'private', label: 'Private' },
  { value: 'mentioned_only', label: 'Mentions only' },
];

const inputCls =
  'rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1.5 text-xs text-slate-700 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20';

/* ---------------- helpers ---------------- */

const notesBase = () => (api.defaults.baseURL || '').replace('servicemanagement', 'notes');

// "@[Anu](12)" -> "@Anu"
const MENTION_RE = /@\[(.*?)\]\((\w+)\)/g;
const plainText = (text) => (text || '').replace(MENTION_RE, '@$1');

const loadColors = () => {
  try {
    return JSON.parse(localStorage.getItem(COLOR_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};
const saveColors = (map) => {
  try {
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable */
  }
};

const formatStamp = (value) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • ${d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

// Rough height of a card, only used to decide which column it goes into.
const estimateHeight = (note, colWidth) => {
  const text = plainText(note.content);
  const perLine = Math.max(14, Math.floor((colWidth - 30) / 7.4));
  const lines = text
    .split('\n')
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
  const hasTitle = note.title && note.title !== DEFAULT_TITLE;
  const shown = Math.min(lines, COLLAPSE_LINES);
  return 64 + (hasTitle ? 24 : 0) + (note.linked_service_name ? 26 : 0) + shown * 21 + (lines > COLLAPSE_LINES ? 22 : 0);
};

/* ---------------- colour picker ---------------- */

const ColorPicker = ({ value, onChange, align = 'right', direction = 'up', buttonClass = '' }) => {
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
        className={`rounded-lg p-1.5 text-slate-600 hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 ${buttonClass}`}
      >
        <FiDroplet className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Choose a colour"
          className={`absolute z-40 grid w-[172px] grid-cols-6 gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
        >
          {NOTE_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              role="option"
              aria-selected={value === c.key}
              title={c.label}
              aria-label={c.label}
              onClick={() => {
                onChange(c.key);
                setOpen(false);
              }}
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${c.dot} ${
                c.key === 'default' ? 'border-slate-300' : c.border
              } ${value === c.key ? 'ring-2 ring-navy-700 ring-offset-1' : 'hover:ring-2 hover:ring-slate-300'}`}
            >
              {value === c.key && <FiCheck className="h-3 w-3 text-navy-700" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------------- note text box (with @mentions) ---------------- */

const NoteInput = ({ value, onChange, placeholder, minHeight, onFocus, fetchSuggestions, inputRef }) => (
  <MentionsInput
    value={value}
    onChange={(e, newValue, newPlainText, mentions) => onChange(newValue, mentions)}
    onFocus={onFocus}
    inputRef={inputRef}
    placeholder={placeholder}
    className="text-sm"
    style={{
      control: { backgroundColor: 'transparent', minHeight, fontSize: 14, lineHeight: 1.5 },
      highlighter: { padding: '6px 12px', margin: 0 },
      input: { padding: '6px 12px', border: 'none', outline: 'none', margin: 0, color: '#1e293b' },
      suggestions: {
        list: {
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          zIndex: 110,
          boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        },
        item: { padding: '8px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13 },
      },
    }}
  >
    <Mention
      trigger="@"
      data={fetchSuggestions}
      markup="@[__display__](__id__)"
      displayTransform={(id, display) => `@${display}`}
      style={{ backgroundColor: '#dbeafe', borderRadius: 4 }}
    />
  </MentionsInput>
);

/* ---------------- page ---------------- */

const NotesPage = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true); // first load only
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteVisibility, setNoteVisibility] = useState('centre');
  const [noteMentions, setNoteMentions] = useState([]);
  const [noteColor, setNoteColor] = useState('default');
  const [staffList, setStaffList] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [servicesList, setServicesList] = useState([]);

  // colours picked on this device (used when the server does not return one)
  const [colorOverrides, setColorOverrides] = useState(loadColors);

  const creatorRef = useRef(null);
  const boardRef = useRef(null);
  const [boardWidth, setBoardWidth] = useState(1200);

  const currentUserId = Number(localStorage.getItem('id'));
  const currentUserRole = localStorage.getItem('role')?.trim()?.toLowerCase();
  const centreId = localStorage.getItem('centre_id');

  /* ---- data ---- */

  const fetchNotes = useCallback(async () => {
    try {
      const response = await api.get('/all', { baseURL: notesBase() });
      setNotes(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error('Failed to load discussions board');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();

    // tell the backend the notes board is being looked at right now
    api.post('/mark-viewed', {}, { baseURL: notesBase() }).catch((err) => {
      console.error('Failed to mark notes as viewed', err);
    });
  }, [fetchNotes]);

  useEffect(() => {
    if (!centreId) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await getStaff(centreId);
        const formattedStaff = (response.data || []).map((s) => ({ id: s.id, display: s.name }));
        if (!cancelled) setStaffList([{ id: 'all', display: 'All Staff' }, ...formattedStaff]);
      } catch (err) {
        console.error('Failed to load staff', err);
      }
      try {
        const servicesRes = await api.get('/services');
        if (!cancelled) setServicesList(servicesRes.data || []);
      } catch (err) {
        console.error('Failed to load services', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [centreId]);

  // collapse the creator when clicking elsewhere, unless there is a draft in it
  const hasDraft = Boolean(noteTitle.trim() || noteContent.trim());
  useEffect(() => {
    if (!isCreating || hasDraft) return undefined;
    const onDown = (e) => creatorRef.current && !creatorRef.current.contains(e.target) && setIsCreating(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isCreating, hasDraft]);

  // how many columns fit
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return undefined;
    const measure = () => setBoardWidth(el.clientWidth || 1200);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = Math.max(1, Math.min(5, Math.floor((boardWidth + GAP) / (MIN_CARD_W + GAP))));
  const colWidth = (boardWidth - GAP * (columns - 1)) / columns;

  /* ---- actions ---- */

  const fetchStaffSuggestions = (query, callback) => {
    if (!query) return callback(staffList);
    callback(staffList.filter((s) => s.display.toLowerCase().includes(query.toLowerCase())));
  };

  const rememberColor = (id, key) => {
    setColorOverrides((prev) => {
      const next = { ...prev };
      if (key === 'default') delete next[id];
      else next[id] = key;
      saveColors(next);
      return next;
    });
  };

  const resetCreator = () => {
    setNoteTitle('');
    setNoteContent('');
    setNoteMentions([]);
    setNoteColor('default');
    setSelectedServiceId('');
    setIsCreating(false);
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim() || submitting) return;

    // expand @All into the real staff ids
    let finalMentions = [...noteMentions];
    if (finalMentions.includes('all')) {
      const allStaffIds = staffList.filter((s) => s.id !== 'all').map((s) => parseInt(s.id));
      finalMentions = [...new Set([...finalMentions.filter((id) => id !== 'all'), ...allStaffIds])];
    }

    try {
      setSubmitting(true);
      const created = await createNote({
        title: noteTitle.trim() || DEFAULT_TITLE,
        content: noteContent.trim(),
        visibility: noteVisibility,
        mentions: finalMentions,
        centre_id: centreId,
        created_by: currentUserId,
        related_service_id: selectedServiceId ? parseInt(selectedServiceId) : null,
        color: noteColor,
      });

      // keep the colour on this device too, in case the server does not store it yet
      const newId = created?.data?.id ?? created?.id ?? created?.data?.note?.id;
      if (newId && noteColor !== 'default') rememberColor(newId, noteColor);

      toast.success('Note pinned to board');
      resetCreator();
      fetchNotes();
    } catch (err) {
      toast.error('Failed to pin note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleColorChange = async (note, key) => {
    rememberColor(note.id, key);
    try {
      // the update call needs the other fields as well, so send them unchanged
      await api.put(
        `/${note.id}`,
        { title: note.title, content: note.content, visibility: note.visibility, color: key },
        { baseURL: notesBase() }
      );
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, color: key } : n)));
    } catch (err) {
      console.error('Could not save the colour on the server', err);
    }
  };

  /* ---- derived ---- */

  const processedNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = notes.filter((note) => {
      if (!q) return true;
      return (
        plainText(note.content).toLowerCase().includes(q) ||
        note.title?.toLowerCase().includes(q) ||
        note.creator_name?.toLowerCase().includes(q) ||
        note.customer_name?.toLowerCase().includes(q) ||
        note.linked_service_name?.toLowerCase().includes(q)
      );
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'alpha':
          return (a.title || '').localeCompare(b.title || '');
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });
    return filtered;
  }, [notes, searchQuery, sortBy]);

  const boardSections = useMemo(() => {
    const mentioned = [];
    const privateNotes = [];
    const centreNotes = [];
    processedNotes.forEach((n) => {
      if (parseInt(n.is_mentioned) > 0) mentioned.push(n);
      else if (n.visibility === 'private') privateNotes.push(n);
      else centreNotes.push(n);
    });
    return { mentioned, private: privateNotes, centre: centreNotes };
  }, [processedNotes]);

  const nothingToShow =
    boardSections.mentioned.length + boardSections.private.length + boardSections.centre.length === 0;

  const sectionProps = {
    columns,
    colWidth,
    colorOverrides,
    onColorChange: handleColorChange,
    onRememberColor: rememberColor,
    navigate,
    refreshBoard: fetchNotes,
    currentUserId,
    currentUserRole,
    fetchSuggestions: fetchStaffSuggestions,
  };

  const creatorColor = colorOf(noteColor);

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-700">
      {/* ===== TOP BAR ===== */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-navy-700">
            <FiEdit3 className="h-5 w-5" />
          </span>
          <h1 className="text-base font-semibold tracking-tight text-slate-900">Akshaya Keep Notes</h1>
        </div>

        <div className="relative order-last w-full min-w-[180px] flex-1 sm:order-none sm:mx-4 sm:w-auto sm:max-w-xl">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search notes"
            aria-label="Search notes"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-transparent bg-slate-100 py-2 pl-9 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <FiX className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort notes"
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="alpha">A–Z</option>
          </select>
          <span className="hidden text-xs font-medium tabular-nums text-slate-400 sm:block">
            {searchQuery.trim() ? `${processedNotes.length} of ${notes.length}` : notes.length} notes
          </span>
        </div>
      </div>

      <div ref={boardRef} className="mx-auto mt-6 max-w-[1400px] px-4 sm:px-6">
        {/* ===== NOTE CREATOR ===== */}
        <div className="mb-8 flex justify-center" ref={creatorRef}>
          <form
            onSubmit={handleCreateNote}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCreateNote(e);
            }}
            className={`relative w-full max-w-2xl rounded-xl border p-3 shadow-sm transition-colors ${creatorColor.bg} ${creatorColor.border} ${
              isCreating ? 'shadow-md' : ''
            }`}
          >
            <AnimatePresence initial={false}>
              {isCreating && (
                <motion.input
                  key="title"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  type="text"
                  placeholder="Title"
                  aria-label="Note title"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="mb-1 w-full bg-transparent px-3 py-1.5 text-base font-semibold text-slate-900 placeholder-slate-500/70 focus:outline-none"
                />
              )}
            </AnimatePresence>

            <NoteInput
              value={noteContent}
              onChange={(newValue, mentions) => {
                setNoteContent(newValue);
                setNoteMentions(mentions.map((m) => (m.id === 'all' ? 'all' : parseInt(m.id))));
              }}
              onFocus={() => setIsCreating(true)}
              placeholder="Take a note... Use @ to tag a staff member"
              minHeight={isCreating ? 80 : 24}
              fetchSuggestions={fetchStaffSuggestions}
            />

            <AnimatePresence initial={false}>
              {isCreating && (
                <motion.div
                  key="tools"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/5 px-2 pt-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <ColorPicker value={noteColor} onChange={setNoteColor} align="left" direction="down" />
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      Visibility
                      <select
                        value={noteVisibility}
                        onChange={(e) => setNoteVisibility(e.target.value)}
                        className={inputCls}
                      >
                        {VISIBILITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      Link to
                      <select
                        value={selectedServiceId}
                        onChange={(e) => setSelectedServiceId(e.target.value)}
                        className={`${inputCls} max-w-[150px] truncate`}
                      >
                        <option value="">General note</option>
                        {servicesList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetCreator}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-black/5"
                    >
                      {hasDraft ? 'Discard' : 'Close'}
                    </button>
                    <button
                      type="submit"
                      disabled={!noteContent.trim() || submitting}
                      className="rounded-lg bg-navy-700 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {submitting ? 'Pinning…' : 'Pin note'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>

        {/* ===== LOADING (first load only) ===== */}
        {loading && (
          <div className="flex items-start gap-3" aria-busy="true">
            {Array.from({ length: columns }).map((_, c) => (
              <div key={c} className="flex min-w-0 flex-1 flex-col gap-3">
                {[96, 150, 72].map((h, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-xl border border-slate-200 bg-white"
                    style={{ height: h + ((c + i) % 3) * 24 }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ===== SECTIONS ===== */}
        {!loading && (
          <div className="space-y-8">
            <Section
              title="Mentions"
              icon={<FiAtSign className="text-emerald-600" />}
              notes={boardSections.mentioned}
              {...sectionProps}
            />
            <Section
              title="Private"
              icon={<FiLock className="text-rose-500" />}
              notes={boardSections.private}
              {...sectionProps}
            />
            <Section
              title="Centre"
              icon={<FiMapPin className="text-navy-700" />}
              notes={boardSections.centre}
              {...sectionProps}
            />

            {nothingToShow && (
              <div className="mx-auto max-w-md rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <FiEdit3 className="h-6 w-6" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {searchQuery.trim() ? 'No notes match your search' : 'No notes yet'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {searchQuery.trim() ? 'Try different keywords.' : 'Pin your first note above.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------------- section: a header and a masonry of cards ---------------- */

const Section = ({ title, icon, notes, columns, colWidth, colorOverrides, onColorChange, ...cardProps }) => {
  // Each note goes into the currently shortest column, so cards of any size
  // pack together without big gaps and keep roughly left-to-right order.
  const columnLists = useMemo(() => {
    const heights = Array(columns).fill(0);
    const lists = Array.from({ length: columns }, () => []);
    notes.forEach((note) => {
      let target = 0;
      for (let i = 1; i < columns; i++) if (heights[i] < heights[target]) target = i;
      lists[target].push(note);
      heights[target] += estimateHeight(note, colWidth) + GAP;
    });
    return lists;
  }, [notes, columns, colWidth]);

  if (notes.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2 pl-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {icon}
        <span>{title}</span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] tabular-nums text-slate-600">
          {notes.length}
        </span>
      </div>
      <div className="flex items-start" style={{ gap: GAP }}>
        {columnLists.map((list, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col" style={{ gap: GAP }}>
            {list.map((note) => (
              <KeepCard
                key={note.id}
                note={note}
                color={colorOverrides[note.id] ?? note.color ?? 'default'}
                onColorChange={onColorChange}
                {...cardProps}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};

/* ---------------- one note card ---------------- */

const KeepCard = ({
  note, color, onColorChange, onRememberColor, navigate, refreshBoard, currentUserId, currentUserRole, fetchSuggestions,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title || '');
  const [editContent, setEditContent] = useState(note.content || '');
  const [editVisibility, setEditVisibility] = useState(note.visibility || 'centre');
  const [editColor, setEditColor] = useState(color);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const contentRef = useRef(null);
  const editRef = useRef(null);

  const palette = colorOf(isEditing ? editColor : color);
  const canModify =
    (currentUserId && currentUserId === Number(note.created_by)) ||
    currentUserRole === 'admin' ||
    currentUserRole === 'superadmin';

  // show "Show more" only when the text really is cut off
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || expanded) return;
    setCanExpand(el.scrollHeight > el.clientHeight + 1);
  }, [note.content, expanded, isEditing]);

  useEffect(() => {
    if (isEditing && editRef.current) {
      const el = editRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [isEditing]);

  const startEditing = () => {
    setEditTitle(note.title || '');
    setEditContent(note.content || '');
    setEditVisibility(note.visibility || 'centre');
    setEditColor(color);
    setIsEditing(true);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this note permanently?')) return;
    try {
      await api.delete(`/${note.id}`, { baseURL: notesBase() });
      toast.success('Note deleted');
      refreshBoard();
    } catch (error) {
      if (error.response?.status === 404) {
        toast.success('Note already deleted');
        refreshBoard();
      } else {
        toast.error('Failed to delete note');
      }
    }
  };

  const handleUpdate = async () => {
    if (!editContent.trim()) {
      toast.error('Content cannot be empty');
      return;
    }
    try {
      setIsSubmitting(true);
      await api.put(
        `/${note.id}`,
        {
          title: editTitle.trim() || DEFAULT_TITLE,
          content: editContent.trim(),
          visibility: editVisibility,
          color: editColor,
        },
        { baseURL: notesBase() }
      );
      if (editColor !== color) onRememberColor(note.id, editColor);
      toast.success('Note updated');
      setIsEditing(false);
      refreshBoard();
    } catch (error) {
      toast.error('Failed to update note');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---- edit mode ---- */
  if (isEditing) {
    return (
      <div className={`rounded-xl border p-3.5 shadow-md ring-2 ring-navy-500/40 ${palette.bg} ${palette.border}`}>
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Title"
          aria-label="Note title"
          className="mb-1 w-full bg-transparent px-3 py-1 text-sm font-semibold text-slate-900 placeholder-slate-500/70 focus:outline-none"
        />
        <NoteInput
          value={editContent}
          onChange={(newValue) => setEditContent(newValue)}
          placeholder="Note"
          minHeight={72}
          fetchSuggestions={fetchSuggestions}
          inputRef={editRef}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-2">
          <div className="flex items-center gap-2">
            <ColorPicker value={editColor} onChange={setEditColor} align="left" direction="up" />
            <select
              value={editVisibility}
              onChange={(e) => setEditVisibility(e.target.value)}
              aria-label="Visibility"
              className={inputCls}
            >
              {VISIBILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setIsEditing(false)}
              className="rounded-lg p-1.5 text-slate-600 transition hover:bg-black/5"
              title="Cancel"
              aria-label="Cancel"
            >
              <FiX className="h-4 w-4" />
            </button>
            <button
              onClick={handleUpdate}
              disabled={isSubmitting}
              className="rounded-lg bg-navy-700 p-1.5 text-white transition hover:bg-navy-800 disabled:opacity-50"
              title="Save"
              aria-label="Save"
            >
              <FiCheck className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- view mode ---- */
  const visibilityIcon =
    note.visibility === 'private' ? (
      <span title="Private">
        <FiLock className="h-3.5 w-3.5" />
      </span>
    ) : note.visibility === 'mentioned_only' ? (
      <span title="Mentions only">
        <FiAtSign className="h-3.5 w-3.5" />
      </span>
    ) : (
      <span title="Centre">
        <FiMapPin className="h-3.5 w-3.5" />
      </span>
    );

  // @[Name](id) -> highlighted @Name (the id stays hidden)
  const renderContent = (text) => {
    if (!text) return null;
    return text.split(/(@\[.*?\]\(\w+\))/g).map((part, index) => {
      const match = part.match(/^@\[(.*?)\]\((\w+)\)$/);
      if (!match) return part;
      const isAll = match[2] === 'all';
      return (
        <span
          key={index}
          className={`mx-px rounded-md px-1 py-px font-semibold ${
            isAll ? 'bg-rose-200/70 text-rose-800' : 'bg-navy-700/10 text-navy-700'
          }`}
        >
          @{match[1]}
        </span>
      );
    });
  };

  const hasTitle = note.title && note.title !== DEFAULT_TITLE;
  const hasService = note.related_service_entry_id && note.related_service_entry_id !== 'null';

  return (
    <div
      className={`group relative rounded-xl border p-3.5 transition-shadow hover:shadow-md focus-within:shadow-md ${palette.bg} ${palette.border}`}
    >
      {/* header: only notes that have a title get a title row */}
      {hasTitle ? (
        <div className="flex items-start justify-between gap-2">
          <h4 className="flex-1 text-sm font-semibold leading-snug text-slate-900" style={{ overflowWrap: 'anywhere' }}>
            {note.title}
          </h4>
          <span className="mt-0.5 shrink-0 text-slate-500/80">{visibilityIcon}</span>
        </div>
      ) : (
        <span className="absolute right-3 top-3 text-slate-500/80">{visibilityIcon}</span>
      )}

      {note.linked_service_name && (
        <div className="mt-1.5">
          <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-white/70 px-2 py-0.5 text-[10px] font-medium text-navy-700 ring-1 ring-black/5">
            <FiBookmark className="h-3 w-3 shrink-0" />
            <span className="truncate">{note.linked_service_name}</span>
          </span>
        </div>
      )}

      {/* text: the card is exactly as tall as the text */}
      <div
        ref={contentRef}
        className={`whitespace-pre-wrap text-sm leading-relaxed text-slate-800 ${hasTitle ? 'mt-1.5' : 'pr-5'}`}
        style={{
          overflowWrap: 'anywhere',
          ...(expanded
            ? {}
            : {
                display: '-webkit-box',
                WebkitLineClamp: COLLAPSE_LINES,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }),
        }}
      >
        {renderContent(note.content)}
      </div>
      {(canExpand || expanded) && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-navy-700 hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
          <FiChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* footer */}
      <div className="mt-2.5 flex items-end justify-between gap-2 border-t border-black/5 pt-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-[11px] font-medium text-slate-700">
            <FiUser className="h-3 w-3 shrink-0 opacity-50" />
            <span className="truncate">{note.creator_name || 'Staff'}</span>
          </p>
          <p className="text-[10px] text-slate-500">{formatStamp(note.created_at)}</p>
        </div>

        {/* actions: shown on hover, always on touch screens */}
        <div className="flex shrink-0 items-center gap-0.5 transition-opacity [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          <ColorPicker value={color} onChange={(key) => onColorChange(note, key)} />
          {canModify && (
            <>
              <button
                onClick={startEditing}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-black/5 hover:text-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
                title="Edit note"
                aria-label="Edit note"
              >
                <FiEdit2 className="h-4 w-4" />
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-black/5 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
                title="Delete note"
                aria-label="Delete note"
              >
                <FiTrash2 className="h-4 w-4" />
              </button>
            </>
          )}
          {hasService && (
            <button
              onClick={() => navigate(`/dashboard/staff/track_service/${note.related_service_entry_id}`)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-black/5 hover:text-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
              title={`Open service for ${note.customer_name || 'customer'}`}
              aria-label="Open linked service"
            >
              <FiExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotesPage;