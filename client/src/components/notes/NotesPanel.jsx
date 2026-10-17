import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus, FiSearch, FiAtSign, FiMapPin, FiGlobe, FiLock, FiMessageCircle,
  FiCheckCircle, FiClock, FiCalendar, FiTrash2, FiEdit2, FiAlertCircle, FiRefreshCw,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { formatDistanceToNow } from 'date-fns';
import NoteEditorModal from './NoteEditorModal';
import { getServiceEntryNotes, getCustomerNotes, deleteNote, updateNote } from '@/services/noteService';
import api from '@/services/serviceService';
import { colorOf, ColorPicker, loadColors, rememberNoteColor, resolveNoteColor } from './noteColors';

const MENTION_RE = /@\[(.*?)\]\((\w+)\)/g;
const plainText = (text) => (text || '').replace(MENTION_RE, '@$1');

const FILTERS = [
  { key: 'all', label: 'All', empty: 'No notes yet' },
  { key: 'mine', label: 'Mine', empty: "You haven't written any notes here" },
  { key: 'mentions', label: 'Mentions', empty: 'No notes mention you' },
  { key: 'centre', label: 'Centre', empty: 'No centre-wide notes' },
];

// The notes API has used a few field names over time, so read them all.
const firstDefined = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '');
const authorId = (n) => firstDefined(n.created_by, n.creator_id, n.author_id, n.user_id, n.staff_id);
const sameId = (a, b) => a !== undefined && a !== null && b !== undefined && b !== null && String(a) === String(b);

const VISIBILITY = {
  private: { label: 'Only me', Icon: FiLock, cls: 'text-slate-500' },
  mentioned_only: { label: 'Mentioned staff', Icon: FiAtSign, cls: 'text-sky-600' },
  centre: { label: 'Entire centre', Icon: FiMapPin, cls: 'text-emerald-600' },
  global: { label: 'All centres', Icon: FiGlobe, cls: 'text-violet-600' },
};

const IST = 'Asia/Kolkata';
const istDay = (value) => {
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { timeZone: IST });
};
const formatDue = (value) => {
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST });
};

const timeAgo = (value) => {
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : formatDistanceToNow(d, { addSuffix: true });
};

const tasksBase = () => (api.defaults.baseURL || '').replace('servicemanagement', 'tasks');

const NotesPanel = ({
  contextType,
  contextId,
  showTaskConversion = true,
  // eslint-disable-next-line no-unused-vars
  showAttachments = true,
  showMentions = true,
  embedded = true,
  onNoteChange = () => {},
}) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [colors, setColors] = useState(loadColors);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyTask, setBusyTask] = useState(null);
  const reqRef = useRef(0);

  const currentUserId = localStorage.getItem('id');
  const userRole = (localStorage.getItem('role') || '').toLowerCase();
  const isManager = userRole === 'admin' || userRole === 'superadmin';
  const supported = (contextType === 'service_entry' || contextType === 'customer') && Boolean(contextId);

  /* One fetch per context. Search and filters work on the loaded list, so typing never reloads. */
  const fetchNotes = useCallback(
    async ({ silent = false } = {}) => {
      if (!supported) {
        setNotes([]);
        setLoading(false);
        return;
      }
      const req = ++reqRef.current;
      if (!silent) setLoading(true);
      setFailed(false);
      try {
        const raw =
          contextType === 'service_entry' ? await getServiceEntryNotes(contextId) : await getCustomerNotes(contextId);
        if (req !== reqRef.current) return;
        // noteService returns the response body, whose shape may be a bare array or wrapped.
        const list = [raw, raw?.data, raw?.notes, raw?.rows].find(Array.isArray);
        // Notes written during a service entry are private to their author; never show someone else's.
        setNotes((list || []).filter((n) => n.visibility !== 'private' || sameId(authorId(n), currentUserId)));
      } catch (err) {
        if (req !== reqRef.current) return;
        console.error('Failed to fetch notes:', err);
        setFailed(true);
        if (!silent) toast.error('Could not load notes');
      } finally {
        if (req === reqRef.current) setLoading(false);
      }
    },
    [contextType, contextId, supported]
  );

  // A different entry/customer is a fresh list: don't carry over the old search or filter.
  useEffect(() => {
    setSearchTerm('');
    setFilter('all');
  }, [contextType, contextId]);

  useEffect(() => {
    fetchNotes();
    return () => {
      reqRef.current += 1; // drop any response that arrives after we've moved on
    };
  }, [fetchNotes]);

  const isMentioned = useCallback(
    (n) => {
      if (n.is_mentioned === true || Number(n.is_mentioned) === 1) return true;
      if ((n.mentions || []).some((m) => sameId(firstDefined(m.staff_id, m.id, m.user_id), currentUserId))) return true;
      const re = new RegExp(MENTION_RE.source, 'g');
      let m;
      while ((m = re.exec(n.content || '')) !== null) {
        if (m[2] === 'all' || sameId(m[2], currentUserId)) return true;
      }
      return false;
    },
    [currentUserId]
  );

  const matchesFilter = useCallback(
    (n, key) => {
      if (key === 'mine') return sameId(authorId(n), currentUserId);
      if (key === 'mentions') return isMentioned(n);
      if (key === 'centre') return n.visibility === 'centre' || n.visibility === 'global';
      return true;
    },
    [currentUserId, isMentioned]
  );

  const matchesSearch = useCallback((n, q) => {
    if (!q) return true;
    return `${n.title || ''} ${plainText(n.content)} ${n.task_title || ''} ${n.created_by_name || n.creator_name || ''}`
      .toLowerCase()
      .includes(q);
  }, []);

  const query = searchTerm.trim().toLowerCase();

  // Counts honour the search box, so each pill tells you what you'd get if you clicked it.
  const counts = useMemo(() => {
    const out = {};
    FILTERS.forEach((f) => {
      out[f.key] = notes.filter((n) => matchesSearch(n, query) && matchesFilter(n, f.key)).length;
    });
    return out;
  }, [notes, query, matchesSearch, matchesFilter]);

  const visible = useMemo(
    () => notes.filter((n) => matchesSearch(n, query) && matchesFilter(n, filter)),
    [notes, query, filter, matchesSearch, matchesFilter]
  );

  const canEdit = (note) => isManager || sameId(authorId(note), currentUserId);

  const refreshAfterChange = () => {
    fetchNotes({ silent: true });
    onNoteChange();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteNote(deleteTarget.id);
      toast.success('Note deleted');
      setDeleteTarget(null);
      refreshAfterChange();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleTaskToggle = async (taskId, currentStatus) => {
    if (busyTask) return;
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    setBusyTask(taskId);
    try {
      await api.patch(`/${taskId}/status`, { status: newStatus }, { baseURL: tasksBase() });
      toast.success(`Task marked ${newStatus}`);
      refreshAfterChange();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update task');
    } finally {
      setBusyTask(null);
    }
  };

  const handleColor = async (note, key) => {
    rememberNoteColor(note.id, key);
    setColors(loadColors());
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, color: key } : n)));
    const payload = { title: note.title, content: note.content, visibility: note.visibility, color: key };
    if (contextType === 'service_entry') payload.related_service_entry_id = parseInt(contextId, 10);
    if (contextType === 'customer') payload.related_customer_id = parseInt(contextId, 10);
    try {
      await updateNote(note.id, payload);
    } catch (err) {
      console.error(err);
      toast.info('Colour kept on this device only');
    }
  };

  const formatNoteContent = (text) => {
    if (!text) return null;
    const re = new RegExp(MENTION_RE.source, 'g');
    const parts = [];
    let last = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) parts.push(text.substring(last, match.index));
      const isAll = match[2] === 'all';
      parts.push(
        <span
          key={match.index}
          className={`mx-0.5 rounded-md border px-1.5 py-0.5 text-[13px] font-semibold ${
            isAll ? 'border-rose-200 bg-rose-100/80 text-rose-700' : 'border-navy-500/20 bg-navy-500/10 text-navy-800'
          }`}
        >
          @{match[1]}
        </span>
      );
      last = re.lastIndex;
    }
    if (last < text.length) parts.push(text.substring(last));
    return parts;
  };

  const todayIst = istDay(new Date());

  return (
    <div className={`notes-panel ${embedded ? '' : 'mx-auto max-w-6xl p-4'}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-navy-800">Notes &amp; tasks</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {visible.length === notes.length ? notes.length : `${visible.length} of ${notes.length}`}
          </span>
        </div>
        <button
          type="button"
          disabled={!supported}
          onClick={() => {
            setEditingNote(null);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-navy-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          <FiPlus className="h-4 w-4" /> New note
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[180px] flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search notes..."
            aria-label="Search notes"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter notes">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 ${
                filter === f.key
                  ? 'bg-navy-700 font-medium text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 text-xs ${filter === f.key ? 'text-white/70' : 'text-slate-400'}`}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading notes">
          {[0, 1].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 h-3 w-1/3 rounded bg-slate-200" />
              <div className="mb-2 h-3 w-full rounded bg-slate-100" />
              <div className="h-3 w-2/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : failed && notes.length === 0 ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <FiAlertCircle className="mx-auto mb-2 h-8 w-8 text-rose-400" />
          <p className="text-sm font-medium text-rose-800">Could not load notes</p>
          <button
            type="button"
            onClick={() => fetchNotes()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100"
          >
            <FiRefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <FiMessageCircle className="mx-auto mb-2 h-10 w-10 text-slate-300" />
          {notes.length === 0 ? (
            <>
              <p className="text-slate-600">No notes yet</p>
              <p className="text-sm text-slate-500">Click &quot;New note&quot; to add one</p>
            </>
          ) : (
            <>
              <p className="text-slate-600">
                {query ? 'No notes match your search' : FILTERS.find((f) => f.key === filter)?.empty}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilter('all');
                }}
                className="mt-1 text-sm font-medium text-navy-700 hover:underline"
              >
                Show all notes
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {visible.map((note) => {
              const colorKey = resolveNoteColor(note, colors);
              const palette = colorOf(colorKey);
              const vis = VISIBILITY[note.visibility] || VISIBILITY.private;
              const VisIcon = vis.Icon;
              const done = note.task_status === 'completed';
              const overdue = note.task_due_date && !done && istDay(note.task_due_date) < todayIst;
              const author = note.created_by_name || note.creator_name || 'Staff';
              const editable = canEdit(note);

              return (
                <motion.article
                  key={note.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.15 }}
                  className={`rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md ${palette.bg} ${palette.border}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {note.title && <span className="font-semibold text-slate-900">{note.title}</span>}
                        <span className="text-xs text-slate-500">
                          by {author}
                          {note.created_at ? ` • ${timeAgo(note.created_at)}` : ''}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs text-slate-600">
                          <VisIcon className={`h-3 w-3 ${vis.cls}`} /> {vis.label}
                        </span>
                      </div>
                      <div className="mb-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                        {formatNoteContent(note.content)}
                      </div>

                      {showMentions && note.mentions && note.mentions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {note.mentions.map((m, index) => (
                            <span
                              key={`${m.staff_id}-${index}`}
                              className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs text-navy-800"
                            >
                              <FiAtSign className="h-3 w-3" /> {m.staff_name}
                            </span>
                          ))}
                        </div>
                      )}

                      {note.task_id && (
                        <div
                          className={`mt-3 rounded-lg border p-3 ${
                            done ? 'border-slate-200 bg-white/70' : 'border-amber-200 bg-amber-50'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={busyTask === note.task_id}
                                onClick={() => handleTaskToggle(note.task_id, note.task_status)}
                                aria-label={done ? 'Mark task pending' : 'Mark task completed'}
                                className={`flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 ${
                                  done ? 'text-slate-500 line-through' : 'text-slate-800'
                                }`}
                              >
                                {done ? (
                                  <FiCheckCircle className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <FiClock className="h-4 w-4 text-amber-500" />
                                )}
                                {note.task_title}
                              </button>
                              {note.task_due_date && !done && (
                                <span
                                  className={`flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${
                                    overdue
                                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                                      : 'border-slate-100 bg-white text-slate-500'
                                  }`}
                                >
                                  <FiCalendar className="h-3 w-3" /> {overdue ? 'Overdue · ' : 'Due '}
                                  {formatDue(note.task_due_date)}
                                </span>
                              )}
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                done ? 'bg-slate-200 text-slate-600' : 'bg-amber-200 text-amber-800'
                              }`}
                            >
                              {note.task_assigned_to_name || 'Staff'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {editable && (
                      <div className="-mr-1 -mt-1 flex shrink-0 items-center">
                        <ColorPicker value={colorKey} onChange={(k) => handleColor(note, k)} />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNote(note);
                            setShowEditor(true);
                          }}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-black/5 hover:text-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
                          title="Edit"
                          aria-label="Edit note"
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(note)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-black/5 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
                          title="Delete"
                          aria-label="Delete note"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showEditor && (
          <NoteEditorModal
            key={editingNote?.id ?? 'new'}
            note={editingNote}
            contextType={contextType}
            contextId={contextId}
            showTaskConversion={showTaskConversion}
            onClose={() => {
              setShowEditor(false);
              setEditingNote(null);
            }}
            onSave={() => {
              setColors(loadColors());
              setShowEditor(false);
              setEditingNote(null);
              refreshAfterChange();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy-800/40 p-4 backdrop-blur-sm"
            onMouseDown={(e) => e.target === e.currentTarget && !deleting && setDeleteTarget(null)}
            onKeyDown={(e) => e.key === 'Escape' && !deleting && setDeleteTarget(null)}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="del-note-title"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            >
              <h4 id="del-note-title" className="text-base font-semibold text-slate-900">
                Delete this note?
              </h4>
              <p className="mt-1 text-sm text-slate-600">
                {deleteTarget.task_id
                  ? 'The note will be removed permanently. Its linked task is managed on the Tasks page.'
                  : 'This will remove the note permanently.'}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  autoFocus
                  disabled={deleting}
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={confirmDelete}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotesPanel;