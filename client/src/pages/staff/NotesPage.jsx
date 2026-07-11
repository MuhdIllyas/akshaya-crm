import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiMessageCircle, FiAtSign, FiClock, FiUser,
  FiExternalLink, FiLock, FiGlobe, FiMapPin, FiCheck,
  FiCornerDownLeft, FiPaperclip, FiBookmark, FiAlertCircle
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

  // Note Creator State (Google Keep Expandable style)
  const [isCreating, setIsCreating] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteVisibility, setNoteVisibility] = useState('centre');
  const [noteMentions, setNoteMentions] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const creatorRef = useRef(null);

  const currentUserId = parseInt(localStorage.getItem('id'));
  const centreId = localStorage.getItem('centre_id');

  // Load staff suggestions for @mentions
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

    // Close creator if clicked outside
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
        centre_id: centreId,          // <-- added missing centre_id
        created_by: currentUserId
      });

      toast.success('Note pinned to board');
      setNoteTitle('');
      setNoteContent('');
      setNoteMentions([]);
      setIsCreating(false);
      fetchNotes(); // Refresh board
    } catch (err) {
      toast.error('Failed to pin note');
    }
  };

  const fetchStaffSuggestions = (query, callback) => {
    if (query.length === 0) return callback(staffList);
    callback(staffList.filter(s => s.display.toLowerCase().includes(query.toLowerCase())));
  };

  // Google Keep Pastel Color Palette mapping based on visibility/mentions
  const getKeepCardStyle = (note) => {
    if (parseInt(note.is_mentioned) > 0) {
      return 'bg-[#E6F4EA] border-[#CEEAD6] text-[#137333] shadow-[0_1px_3px_rgba(60,64,67,0.12)]'; // Pastel Green for Mentions
    }
    switch (note.visibility) {
      case 'private':
        return 'bg-[#FCE8E6] border-[#FAD2CF] text-[#C5221F]'; // Pastel Red
      case 'global':
        return 'bg-[#E8F0FE] border-[#D2E3FC] text-[#1A73E8]'; // Pastel Blue
      default:
        return 'bg-[#FFF8E1] border-[#FFE082] text-[#B85C00]'; // Pastel Yellow/Amber for Centre
    }
  };

  // Filter notes
  const processedNotes = useMemo(() => {
    return notes.filter(note => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        note.content?.toLowerCase().includes(query) ||
        note.title?.toLowerCase().includes(query) ||
        note.creator_name?.toLowerCase().includes(query) ||
        note.customer_name?.toLowerCase().includes(query)
      );
    });
  }, [notes, searchQuery]);

  // Separate into Pinned (Mentions) and Others matching Google Keep layout
  const boardSections = useMemo(() => {
    const pinned = [];
    const others = [];
    processedNotes.forEach(n => {
      if (parseInt(n.is_mentioned) > 0) pinned.push(n);
      else others.push(n);
    });
    return { pinned, others };
  }, [processedNotes]);

  return (
    <div className="min-h-screen bg-[#FFFFFF] font-sans pb-16 text-gray-700">

      {/* ===== GOOGLE KEEP STYLE TOP NAV BAR ===== */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <FiMessageCircle className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">Akshaya Keep Board</h1>
        </div>

        {/* Omnibox Search Bar */}
        <div className="relative flex-1 max-w-xl mx-auto">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search notes, tags, customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-xl text-sm focus:outline-none focus:bg-white focus:border-gray-200 transition-all shadow-inner"
          />
        </div>
        <div className="w-24 hidden sm:block text-right text-xs text-gray-400 font-medium">
          {notes.length} Active Notes
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 mt-8">

        {/* ===== KEEP STICKY NOTE CREATOR ===== */}
        <div className="flex justify-center mb-10" ref={creatorRef}>
          <motion.form
            onSubmit={handleCreateNote}
            layout
            className="w-full max-w-xl bg-white border border-gray-200 rounded-xl shadow-[0_1px_3px_rgba(60,64,67,0.2),0_2px_8px_rgba(60,64,67,0.1)] p-3 transition-all overflow-hidden"
          >
            {isCreating && (
              <motion.input
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                type="text"
                placeholder="Title"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="w-full px-3 py-1.5 font-bold text-gray-900 placeholder-gray-400 text-sm focus:outline-none mb-2"
              />
            )}

            <MentionsInput
              value={noteContent}
              onChange={(e, newValue, newPlainText, mentions) => {
                setNoteContent(newValue);
                setNoteMentions(mentions.map(m => parseInt(m.id)));
              }}
              onFocus={() => setIsCreating(true)}
              placeholder="Take an internal note... Use @ to tag staff members"
              className="text-sm"
              style={{
                control: {
                  backgroundColor: 'transparent',
                  minHeight: isCreating ? '80px' : '24px',
                  fontSize: 14,
                  lineHeight: 1.5
                },
                highlighter: { padding: '6px 12px', margin: 0 },
                input: { padding: '6px 12px', border: 'none', outline: 'none', margin: 0, color: '#3c4043' },
                suggestions: {
                  list: {
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    zIndex: 110,
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                  },
                  item: { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }
                }
              }}
            >
              <Mention trigger="@" data={fetchStaffSuggestions} markup="@[__display__](__id__)" displayTransform={(id, display) => `@${display}`} />
            </MentionsInput>

            {isCreating && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 px-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium">Visibility:</span>
                  <select
                    value={noteVisibility}
                    onChange={(e) => setNoteVisibility(e.target.value)}  // Fixed typo
                    className="text-xs bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-gray-700 outline-none"
                  >
                    <option value="centre">Centre Only</option>
                    <option value="global">Global (All Centres)</option>
                    <option value="private">Private (Only Me)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="text-xs font-semibold text-gray-500 hover:bg-gray-100 px-3 py-1.5 rounded-md transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={!noteContent.trim()}
                    className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg shadow-sm transition"
                  >
                    Pin Note
                  </button>
                </div>
              </motion.div>
            )}
          </motion.form>
        </div>

        {/* ===== LOADING SPINNER ===== */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* ===== MASONRY BOARD SECTIONS ===== */}
        {!loading && (
          <div className="space-y-10">

            {/* 1. PINNED SECTION (Mentions) */}
            {boardSections.pinned.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 pl-1">
                  <FiBookmark className="text-emerald-500" /> Pinned Notes (Your Mentions)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
                  {boardSections.pinned.map(note => <KeepCard key={note.id} note={note} cardStyle={getKeepCardStyle(note)} navigate={navigate} />)}
                </div>
              </div>
            )}

            {/* 2. OTHERS SECTION */}
            <div>
              {boardSections.pinned.length > 0 && (
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4 pl-1 border-t border-gray-100 pt-6">
                  Others
                </div>
              )}
              {boardSections.others.length === 0 && boardSections.pinned.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-2xl max-w-md mx-auto">
                  <FiMessageCircle className="mx-auto h-12 w-12 text-gray-200 mb-3" />
                  <p className="font-semibold text-gray-400">Board is entirely clear!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
                  {boardSections.others.map(note => <KeepCard key={note.id} note={note} cardStyle={getKeepCardStyle(note)} navigate={navigate} />)}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
//  COMPACT GOOGLE KEEP CARD MODULE
// ----------------------------------------------------------------------
const KeepCard = ({ note, cardStyle, navigate }) => {
  return (
    <motion.div
      layout
      whileHover={{ y: -1, boxShadow: "0 1px 3px rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)" }}
      className={`border p-4 rounded-xl shadow-[0_1px_2px_0_rgba(60,64,67,0.3)] transition-all flex flex-col justify-between min-h-[140px] group relative ${cardStyle}`}
    >
      <div>
        {/* Title Block */}
        <div className="flex justify-between items-start mb-2 gap-2">
          <h4 className="font-bold text-sm text-gray-900 leading-tight truncate flex-1">{note.title || 'General Note'}</h4>
          <div className="opacity-40 shrink-0 mt-0.5">
            {note.visibility === 'private' ? <FiLock className="h-3.5 w-3.5" /> : note.visibility === 'global' ? <FiGlobe className="h-3.5 w-3.5" /> : <FiMapPin className="h-3.5 w-3.5" />}
          </div>
        </div>

        {/* Content Body */}
        <div className="text-xs text-gray-800 break-words leading-relaxed whitespace-pre-wrap">
          {note.content?.split(/(@\w+)/g).map((chunk, i) =>
            chunk.startsWith('@') ? <span key={i} className="font-bold bg-white/60 px-1 rounded text-indigo-900">{chunk}</span> : chunk
          )}
        </div>
      </div>

      {/* Action Footer Drawer */}
      <div className="mt-4 pt-3 border-t border-black/5 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-gray-900 flex items-center gap-1">
            <FiUser className="opacity-40" /> {note.creator_name || 'Staff'}
          </p>
          <p className="text-[9px] text-gray-500 mt-0.5">
            {new Date(note.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* STRICT VALIDATION: Only render if related_service_entry_id exists AND is not the string "null" */}
        {note.related_service_entry_id && note.related_service_entry_id !== "null" && (
          <button
            onClick={() => navigate(`/dashboard/staff/track_service/${note.related_service_entry_id}`)}
            className="p-1.5 bg-white/40 hover:bg-white rounded-lg border border-black/5 text-gray-700 hover:text-indigo-600 transition opacity-0 group-hover:opacity-100 shadow-sm shrink-0"
            title={`Open File Tracker for ${note.customer_name || 'Customer'}`}
          >
            <FiExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default NotesPage;