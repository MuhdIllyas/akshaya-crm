import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiMessageCircle, FiAtSign, FiClock, FiUser,
  FiExternalLink, FiLock, FiGlobe, FiMapPin, FiCheck,
  FiCornerDownLeft, FiPaperclip, FiBookmark, FiAlertCircle,
  FiEdit2, FiTrash2, FiX, FiSave, FiPin, FiFilter, FiEye
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { MentionsInput, Mention } from 'react-mentions';
import { getStaff } from '@/services/serviceService';
import { createNote } from '@/services/noteService';
import api from '@/services/serviceService';
import { toast } from 'react-toastify';

const NotesPage = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const [isCreating, setIsCreating] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteVisibility, setNoteVisibility] = useState('centre');
  const [noteMentions, setNoteMentions] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const creatorRef = useRef(null);

  const currentUserId = parseInt(localStorage.getItem('id'));
  const currentUserRole = localStorage.getItem('role')?.trim()?.toLowerCase();
  const centreId = localStorage.getItem('centre_id');

  useEffect(() => {
    const loadStaff = async () => {
      try {
        if (!centreId) return;
        const response = await getStaff(centreId);
        setStaffList(response.data.map(s => ({ id: s.id, display: s.name })));
      } catch (err) {
        console.error('Failed to load staff for mentions', err);
      }
    };
    loadStaff();
    fetchNotes();

    const handleOutsideClick = (e) => {
      if (creatorRef.current && !creatorRef.current.contains(e.target)) {
        setIsCreating(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [centreId]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const notesUrl = (api.defaults.baseURL || '').replace('servicemanagement', 'notes');
      const response = await api.get('/all', { baseURL: notesUrl });
      setNotes(response.data || []);
    } catch (error) {
      toast.error('Failed to load discussions board');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    try {
      await createNote({
        title: noteTitle.trim() || 'General Note',
        content: noteContent.trim(),
        visibility: noteVisibility,
        mentions: noteMentions,
        centre_id: centreId,
        created_by: currentUserId
      });
      toast.success('Note pinned to board');
      setNoteTitle('');
      setNoteContent('');
      setNoteMentions([]);
      setIsCreating(false);
      fetchNotes();
    } catch (err) {
      toast.error('Failed to pin note');
    }
  };

  const fetchStaffSuggestions = (query, callback) => {
    if (query.length === 0) return callback(staffList);
    callback(staffList.filter(s => s.display.toLowerCase().includes(query.toLowerCase())));
  };

  const getKeepCardStyle = (note) => {
    if (parseInt(note.is_mentioned) > 0) {
      return 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm hover:shadow-md';
    }
    switch (note.visibility) {
      case 'private':
        return 'bg-rose-50 border-rose-200 text-rose-800 shadow-sm hover:shadow-md';
      case 'global':
        return 'bg-blue-50 border-blue-200 text-blue-800 shadow-sm hover:shadow-md';
      default:
        return 'bg-amber-50 border-amber-200 text-amber-800 shadow-sm hover:shadow-md';
    }
  };

  const processedNotes = useMemo(() => {
    let filtered = notes.filter(note => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        note.content?.toLowerCase().includes(q) ||
        note.title?.toLowerCase().includes(q) ||
        note.creator_name?.toLowerCase().includes(q) ||
        note.customer_name?.toLowerCase().includes(q)
      );
    });

    const sortFn = (a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'alpha':
          return (a.title || '').localeCompare(b.title || '');
        default:
          return 0;
      }
    };
    filtered.sort(sortFn);
    return filtered;
  }, [notes, searchQuery, sortBy]);

  // ===== SPLIT VIEW: Mentions, Private, Centre =====
  const boardSections = useMemo(() => {
    const mentioned = [];
    const privateNotes = [];
    const centreNotes = [];
    processedNotes.forEach(n => {
      if (parseInt(n.is_mentioned) > 0) {
        mentioned.push(n);
      } else {
        if (n.visibility === 'private') {
          privateNotes.push(n);
        } else {
          centreNotes.push(n);
        }
      }
    });
    return { mentioned, private: privateNotes, centre: centreNotes };
  }, [processedNotes]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16 text-gray-700">

      {/* ===== TOP NAV BAR ===== */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <FiMessageCircle className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">Akshaya Keep</h1>
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xl mx-2 sm:mx-4">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2 bg-gray-100 border border-transparent rounded-xl text-sm focus:outline-none focus:bg-white focus:border-gray-300 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FiX className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 text-sm">
            <FiFilter className="text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent border-none text-sm text-gray-600 focus:ring-0 cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="alpha">A–Z</option>
            </select>
          </div>
          <div className="text-xs text-gray-400 font-medium hidden sm:block">
            {notes.length} Notes
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 mt-8">

        {/* ===== NOTE CREATOR (EXPANDABLE) ===== */}
        <div className="flex justify-center mb-10" ref={creatorRef}>
          <motion.form
            onSubmit={handleCreateNote}
            layout
            className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-md hover:shadow-lg transition-shadow p-3 overflow-hidden"
          >
            {isCreating && (
              <motion.input
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                type="text"
                placeholder="Title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="w-full px-3 py-1.5 font-semibold text-gray-900 placeholder-gray-400 text-base focus:outline-none mb-2"
              />
            )}

            <MentionsInput
              value={noteContent}
              onChange={(e, newValue, newPlainText, mentions) => {
                setNoteContent(newValue);
                setNoteMentions(mentions.map(m => parseInt(m.id)));
              }}
              onFocus={() => setIsCreating(true)}
              placeholder="Take a note... Use @ to tag a staff member"
              className="text-sm"
              style={{
                control: {
                  backgroundColor: 'transparent',
                  minHeight: isCreating ? '80px' : '24px',
                  fontSize: 14,
                  lineHeight: 1.5
                },
                highlighter: { padding: '6px 12px', margin: 0 },
                input: { padding: '6px 12px', border: 'none', outline: 'none', margin: 0, color: '#1e293b' },
                suggestions: {
                  list: {
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    zIndex: 110,
                    boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                  },
                  item: { padding: '8px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }
                }
              }}
            >
              <Mention trigger="@" data={fetchStaffSuggestions} markup="@[__display__](__id__)" displayTransform={(id, display) => `@${display}`} />
            </MentionsInput>

            {isCreating && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center justify-between mt-3 pt-3 border-t border-gray-100 px-2 gap-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-medium">Visibility</span>
                  <select
                    value={noteVisibility}
                    onChange={(e) => setNoteVisibility(e.target.value)}
                    className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:ring-2 focus:ring-indigo-300 outline-none"
                  >
                    <option value="centre">🏢 Centre</option>
                    <option value="private">🔒 Private</option>
                    <option value="mentioned_only">@ Mentions</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="text-xs font-semibold text-gray-500 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={!noteContent.trim()}
                    className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-5 py-1.5 rounded-xl shadow-sm transition"
                  >
                    Pin Note
                  </button>
                </div>
              </motion.div>
            )}
          </motion.form>
        </div>

        {/* ===== LOADING ===== */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* ===== THREE SECTIONS SPLIT VIEW ===== */}
        {!loading && (
          <div className="space-y-10">
            {/* 1. MENTIONS */}
            <Section
              title="Mentions"
              icon={<FiAtSign className="text-emerald-500" />}
              notes={boardSections.mentioned}
              cardStyleGetter={getKeepCardStyle}
              navigate={navigate}
              refreshBoard={fetchNotes}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />

            {/* 2. PRIVATE */}
            <Section
              title="Private"
              icon={<FiLock className="text-rose-500" />}
              notes={boardSections.private}
              cardStyleGetter={getKeepCardStyle}
              navigate={navigate}
              refreshBoard={fetchNotes}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />

            {/* 3. CENTRE */}
            <Section
              title="Centre"
              icon={<FiMapPin className="text-amber-500" />}
              notes={boardSections.centre}
              cardStyleGetter={getKeepCardStyle}
              navigate={navigate}
              refreshBoard={fetchNotes}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />

            {/* Empty state when all sections are empty */}
            {boardSections.mentioned.length === 0 &&
              boardSections.private.length === 0 &&
              boardSections.centre.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-3xl max-w-md mx-auto">
                  <FiMessageCircle className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                  <p className="font-semibold text-gray-400 text-lg">Board is empty</p>
                  <p className="text-sm text-gray-400 mt-1">Start by pinning a note above.</p>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
//  SECTION COMPONENT – renders a group of notes with a header
// ----------------------------------------------------------------------
const Section = ({ title, icon, notes, cardStyleGetter, navigate, refreshBoard, currentUserId, currentUserRole }) => {
  if (notes.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 pl-1">
        {icon}
        <span>{title}</span>
        <span className="ml-1 text-[10px] bg-gray-200 rounded-full px-2 py-0.5 text-gray-600">{notes.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {notes.map(note => (
          <KeepCard
            key={note.id}
            note={note}
            cardStyle={cardStyleGetter(note)}
            navigate={navigate}
            refreshBoard={refreshBoard}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
          />
        ))}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
//  KEEP CARD – displays a single note with edit/delete actions
//  and highlighted @mentions (bold + colour)
// ----------------------------------------------------------------------
const KeepCard = ({ note, cardStyle, navigate, refreshBoard, currentUserId, currentUserRole }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title || '');
  const [editContent, setEditContent] = useState(note.content || '');
  const [editVisibility, setEditVisibility] = useState(note.visibility || 'centre');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canModify = currentUserId === note.created_by || currentUserRole === 'admin' || currentUserRole === 'superadmin';

  const handleDelete = async () => {
    if (!window.confirm('Delete this note permanently?')) return;
    try {
      const notesUrl = (api.defaults.baseURL || '').replace('servicemanagement', 'notes');
      await api.delete(`/${note.id}`, { baseURL: notesUrl });
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
      const notesUrl = (api.defaults.baseURL || '').replace('servicemanagement', 'notes');
      await api.put(
        `/${note.id}`,
        {
          title: editTitle.trim(),
          content: editContent.trim(),
          visibility: editVisibility
        },
        { baseURL: notesUrl }
      );
      toast.success('Note updated');
      setIsEditing(false);
      refreshBoard();
    } catch (error) {
      toast.error('Failed to update note');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Edit Mode ----
  if (isEditing) {
    return (
      <motion.div
        layout
        className={`border p-4 rounded-xl shadow-lg flex flex-col bg-white ring-2 ring-indigo-400 ${cardStyle}`}
      >
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Title"
          className="font-bold text-sm text-gray-900 bg-transparent border-b border-gray-200 focus:border-indigo-400 outline-none pb-1 mb-2 w-full"
        />
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="text-sm text-gray-800 bg-transparent outline-none w-full resize-none min-h-[80px]"
          autoFocus
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
          <select
            value={editVisibility}
            onChange={(e) => setEditVisibility(e.target.value)}
            className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none text-gray-700"
          >
            <option value="centre">🏢 Centre</option>
            <option value="private">🔒 Private</option>
            <option value="mentioned_only">@ Mentions</option>
          </select>
          <div className="flex gap-1">
            <button
              onClick={() => setIsEditing(false)}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
              title="Cancel"
            >
              <FiX className="h-4 w-4" />
            </button>
            <button
              onClick={handleUpdate}
              disabled={isSubmitting}
              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition disabled:opacity-50"
              title="Save"
            >
              <FiSave className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ---- View Mode ----
  const visibilityIcon = note.visibility === 'private'
    ? <FiLock className="h-3.5 w-3.5" title="Private" />
    : note.visibility === 'mentioned_only'
    ? <FiAtSign className="h-3.5 w-3.5" title="Mentions only" />
    : <FiMapPin className="h-3.5 w-3.5" title="Centre view" />;

  // Helper to render content with bold/coloured @mentions
  const renderContent = (text) => {
    if (!text) return null;
    // Split by @word (alphanumeric + underscore)
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        // This is a mention – render it bold and with a distinct colour (e.g., indigo)
        return (
          <span key={index} className="font-bold text-indigo-700 bg-indigo-100/50 px-1 rounded">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <motion.div
      layout
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className={`border p-4 rounded-xl shadow-sm hover:shadow-lg transition-all flex flex-col justify-between min-h-[150px] group relative ${cardStyle}`}
    >
      {/* Action buttons - appear on hover */}
      {canModify && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 bg-white/80 hover:bg-white rounded-lg shadow-sm text-gray-600 hover:text-indigo-600 border border-gray-200/50 transition"
            title="Edit note"
          >
            <FiEdit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 bg-white/80 hover:bg-white rounded-lg shadow-sm text-gray-600 hover:text-rose-600 border border-gray-200/50 transition"
            title="Delete note"
          >
            <FiTrash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start gap-2 mb-2">
        <h4 className="font-semibold text-sm text-gray-900 leading-tight truncate flex-1">
          {note.title || 'General Note'}
        </h4>
        <span className="text-gray-400 shrink-0 mt-0.5">{visibilityIcon}</span>
      </div>

      {/* Content with @mentions highlighted (bold + coloured) */}
      <div className="text-sm text-gray-800 break-words leading-relaxed whitespace-pre-wrap flex-1">
        {renderContent(note.content)}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200/50 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <FiUser className="opacity-40 h-3 w-3" />
            {note.creator_name || 'Staff'}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {new Date(note.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            {' • '}
            {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {note.related_service_entry_id && note.related_service_entry_id !== 'null' && (
          <button
            onClick={() => navigate(`/dashboard/staff/track_service/${note.related_service_entry_id}`)}
            className="p-1.5 bg-white/60 hover:bg-white rounded-lg border border-gray-200/50 text-gray-600 hover:text-indigo-600 transition opacity-0 group-hover:opacity-100 shadow-sm shrink-0 ml-2"
            title={`Open service for ${note.customer_name || 'Customer'}`}
          >
            <FiExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default NotesPage;