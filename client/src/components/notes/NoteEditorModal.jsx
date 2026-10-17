import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FiX, FiUpload, FiUser, FiUsers, FiAtSign, FiMapPin, FiLock, FiCheck, FiCheckCircle,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { MentionsInput, Mention } from 'react-mentions';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { createNote, updateNote } from '@/services/noteService';
import api, { getStaff } from '@/services/serviceService';
import { colorOf, ColorRow, rememberNoteColor, resolveNoteColor, loadColors } from './noteColors';

const DEFAULT_TITLE = 'General Note';
const ALL_STAFF = { id: 'all', display: 'All Staff' };
const MENTION_RE = /@\[(.*?)\]\((\w+)\)/g;

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private', icon: FiLock, desc: 'Only you' },
  { value: 'centre', label: 'Centre', icon: FiMapPin, desc: 'All staff in your centre' },
  { value: 'mentioned_only', label: 'Mentions', icon: FiAtSign, desc: 'You + mentioned' },
];

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20';

// Local calendar date -> "YYYY-MM-DD" (toISOString would shift it a day back in IST).
const toYmd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const contextTitle = (contextType, contextId) => {
  if (contextType === 'service_entry' && contextId) return `Note for Service Entry #${contextId}`;
  if (contextType === 'customer' && contextId) return 'Customer Note';
  return DEFAULT_TITLE;
};

const NoteEditorModal = ({
  note = null,
  contextType,
  contextId,
  onClose,
  onSave,
  showTaskConversion = true,
}) => {
  const fallbackTitle = contextTitle(contextType, contextId);
  const initialTitle = note ? note.title || '' : fallbackTitle;
  const initialColor = note ? resolveNoteColor(note, loadColors()) : 'default';
  const hasTask = Boolean(note?.task_id || note?.task);

  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(note?.content || '');
  const [visibility, setVisibility] = useState(note?.visibility || 'centre');
  const [color, setColor] = useState(initialColor);
  const [createTask, setCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [staffFailed, setStaffFailed] = useState(false);
  const textRef = useRef(null);

  const palette = colorOf(color);
  const dirty =
    content !== (note?.content || '') ||
    title !== initialTitle ||
    visibility !== (note?.visibility || 'centre') ||
    color !== initialColor ||
    createTask;

  /* ---- staff for @mentions and task assignee ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getStaff(localStorage.getItem('centre_id'));
        const rows = Array.isArray(response?.data) ? response.data : [];
        if (!cancelled) setStaffList(rows.map((s) => ({ id: s.id, display: s.name })));
      } catch (error) {
        console.error('Failed to load staff for mentions', error);
        if (!cancelled) setStaffFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Esc closes (unless there are unsaved edits, or a popup is open) ---- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || loading || dirty) return;
      if (document.querySelector('.react-datepicker-popper, .mentions-input__suggestions')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [loading, dirty, onClose]);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const mentionOptions = useMemo(() => [ALL_STAFF, ...staffList], [staffList]);

  const fetchStaffSuggestions = (query, callback) => {
    if (!query) return callback(mentionOptions);
    const q = query.toLowerCase();
    return callback(mentionOptions.filter((s) => s.display.toLowerCase().includes(q)));
  };

  // Read mentions straight from the text so the list can never drift out of sync.
  const mentionedStaffIds = (text) => {
    const ids = new Set();
    const re = new RegExp(MENTION_RE.source, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[2] === 'all') staffList.forEach((s) => ids.add(Number(s.id)));
      else if (Number.isFinite(Number(m[2]))) ids.add(Number(m[2]));
    }
    return [...ids];
  };

  const toggleTask = (checked) => {
    setCreateTask(checked);
    if (checked && !taskTitle.trim()) {
      const t = title.trim();
      if (t && t !== DEFAULT_TITLE && t !== fallbackTitle) setTaskTitle(t);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!content.trim()) {
      toast.error('Please enter some content');
      return;
    }
    const wantsTask = createTask && showTaskConversion && !hasTask;
    if (wantsTask && (!taskTitle.trim() || !taskAssignee)) {
      toast.error('Add a task title and choose who to assign it to');
      return;
    }

    setLoading(true);

    const payload = {
      title: title.trim() || fallbackTitle,
      content: content.trim(),
      visibility,
      color,
      mentions: mentionedStaffIds(content),
    };
    if (contextType === 'service_entry' && contextId) payload.related_service_entry_id = parseInt(contextId, 10);
    if (contextType === 'customer' && contextId) payload.related_customer_id = parseInt(contextId, 10);
    if (contextType === 'tracking' && contextId) payload.related_service_tracking_id = parseInt(contextId, 10);

    let savedNoteId = null;
    try {
      if (note) {
        await updateNote(note.id, payload);
        savedNoteId = note.id;
      } else {
        const response = await createNote(payload);
        savedNoteId = response?.data?.id || response?.id || response?.data?.note?.id || null;
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to save');
      setLoading(false);
      return;
    }

    // The note is saved from here on. Whatever happens with the task, don't make
    // the user save again (that would create the note twice).
    rememberNoteColor(savedNoteId, color);
    let taskFailed = false;

    if (wantsTask && savedNoteId) {
      try {
        const taskPayload = {
          title: taskTitle.trim(),
          description: content.trim(),
          assigned_to: parseInt(taskAssignee, 10),
          due_date: taskDueDate ? toYmd(taskDueDate) : null,
          priority: 'medium',
          note_id: savedNoteId,
        };
        if (contextType === 'service_entry') taskPayload.related_service_entry_id = parseInt(contextId, 10);
        if (contextType === 'customer') taskPayload.related_customer_id = parseInt(contextId, 10);

        const taskBaseUrl = (api.defaults.baseURL || '').replace('servicemanagement', 'tasks');
        await api.post('/add', taskPayload, { baseURL: taskBaseUrl });
      } catch (err) {
        console.error(err);
        taskFailed = true;
      }
    }

    if (taskFailed) toast.warning(`Note ${note ? 'updated' : 'saved'}, but the task could not be created. Add it from the Tasks page.`);
    else toast.success(wantsTask ? 'Note saved and task created' : note ? 'Note updated' : 'Note saved');

    setLoading(false);
    onSave();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-800/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading && !dirty) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-editor-title"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="note-editor-title" className="text-lg font-semibold text-navy-800">
            {note ? 'Edit note' : 'New note'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            <div>
              <label htmlFor="note-title" className="mb-1 block text-sm font-medium text-slate-700">
                Title <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="note-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
                placeholder="Short summary..."
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-slate-700">Note *</label>
                <ColorRow value={color} onChange={setColor} />
              </div>
              <MentionsInput
                value={content}
                onChange={(ev, newValue) => setContent(newValue)}
                className="mentions-input"
                inputRef={textRef}
                placeholder="Write your note. Type @ to mention staff..."
                style={{
                  control: {
                    backgroundColor: palette.hex,
                    fontSize: 14,
                    width: '100%',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    minHeight: '120px',
                    lineHeight: '1.5',
                    overflow: 'hidden',
                    transition: 'background-color .15s',
                  },
                  highlighter: { padding: '0.85rem', boxSizing: 'border-box', lineHeight: '1.5', margin: 0 },
                  input: {
                    padding: '0.85rem',
                    border: 'none',
                    outline: 'none',
                    lineHeight: '1.5',
                    boxSizing: 'border-box',
                    width: '100%',
                    height: '100%',
                    margin: 0,
                    color: '#1e293b',
                  },
                  suggestions: {
                    list: {
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      fontSize: 13,
                      zIndex: 100,
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                    },
                    item: {
                      padding: '8px 12px',
                      borderBottom: '1px solid #f1f5f9',
                      '&focused': { backgroundColor: '#eaf0f8' },
                    },
                  },
                }}
              >
                <Mention
                  trigger="@"
                  data={fetchStaffSuggestions}
                  markup="@[__display__](__id__)"
                  displayTransform={(id, display) => `@${display}`}
                  style={{ backgroundColor: 'rgba(30,58,95,0.14)', borderRadius: 4 }}
                  renderSuggestion={(suggestion, search, highlightedDisplay) => (
                    <div className="flex items-center gap-2">
                      {suggestion.id === 'all' ? (
                        <FiUsers className="h-3 w-3 text-rose-500" />
                      ) : (
                        <FiUser className="h-3 w-3 text-slate-500" />
                      )}
                      {highlightedDisplay}
                    </div>
                  )}
                />
              </MentionsInput>
              <p className="mt-1 text-xs text-slate-500">
                {staffFailed ? 'Could not load staff, so @mentions and task assignment are unavailable.' : 'Type @ to mention staff members, or @All Staff to notify everyone.'}
              </p>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">Visibility</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {VISIBILITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = visibility === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-navy-500/30 ${
                        selected ? 'border-navy-500 bg-navy-500/5' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="note-visibility"
                        value={opt.value}
                        checked={selected}
                        onChange={(e) => setVisibility(e.target.value)}
                        className="mt-0.5 accent-navy-700"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                          <Icon className={`h-4 w-4 ${selected ? 'text-navy-700' : 'text-slate-500'}`} />
                          {opt.label}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">{opt.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <span className="mb-2 block text-sm font-medium text-slate-700">Attachments</span>
              <span
                aria-disabled="true"
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-400"
              >
                <FiUpload className="h-4 w-4" /> Upload files <span className="text-xs">(coming soon)</span>
              </span>
            </div>

            {showTaskConversion && hasTask && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <FiCheckCircle className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">Linked task: {note.task_title || note.task?.title || 'Task'}</span>
              </div>
            )}

            {showTaskConversion && !hasTask && (
              <div className="border-t border-slate-200 pt-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createTask}
                    onChange={(e) => toggleTask(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-navy-700"
                  />
                  <span className="text-sm font-medium text-slate-800">Create a task from this note</span>
                </label>

                {createTask && (
                  <div className="ml-1 mt-4 space-y-4 border-l-2 border-navy-500/30 pl-4">
                    <div>
                      <label htmlFor="task-title" className="mb-1 block text-sm font-medium text-slate-700">
                        Task title *
                      </label>
                      <input
                        id="task-title"
                        type="text"
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        className={inputCls}
                        placeholder="e.g., Collect missing document"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="task-assignee" className="mb-1 block text-sm font-medium text-slate-700">
                          Assign to *
                        </label>
                        <select
                          id="task-assignee"
                          value={taskAssignee}
                          onChange={(e) => setTaskAssignee(e.target.value)}
                          className={`${inputCls} bg-white`}
                        >
                          <option value="">Select staff</option>
                          {staffList.map((staff) => (
                            <option key={staff.id} value={staff.id}>
                              {staff.display}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="task-due" className="mb-1 block text-sm font-medium text-slate-700">
                          Due date <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <DatePicker
                          id="task-due"
                          selected={taskDueDate}
                          onChange={(date) => setTaskDueDate(date)}
                          className={inputCls}
                          wrapperClassName="block w-full"
                          popperClassName="!z-[70]"
                          popperProps={{ strategy: 'fixed' }}
                          placeholderText="Select date"
                          dateFormat="dd/MM/yyyy"
                          minDate={startOfToday()}
                          isClearable
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <FiCheck className="h-4 w-4" />
              )}
              {note ? 'Update note' : 'Save note'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default NoteEditorModal;