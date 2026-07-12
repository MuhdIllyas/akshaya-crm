import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiPlus, FiSearch, FiFilter, FiUser, FiAtSign, FiMapPin, 
  FiGlobe, FiLock, FiMessageCircle, FiPaperclip, FiCheckCircle,
  FiClock, FiCalendar, FiTrash2, FiEdit2, FiX
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import NoteEditorModal from './NoteEditorModal';
// UPDATED IMPORTS
import { getServiceEntryNotes, getCustomerNotes, deleteNote } from '@/services/noteService';
import { formatDistanceToNow } from 'date-fns';
import api from '@/services/serviceService';

const NotesPanel = ({ 
  contextType,      
  contextId,        
  showTaskConversion = true,
  showAttachments = true,
  showMentions = true,
  embedded = true,
  onNoteChange = () => {}
}) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); 

  const currentUserId = parseInt(localStorage.getItem('id'));
  const userRole = localStorage.getItem('role');

  const fetchNotes = async () => {
    setLoading(true);
    try {
      let rawNotes = [];
      
      // Route to the correct API based on context
      if (contextType === 'service_entry' && contextId) {
        rawNotes = await getServiceEntryNotes(contextId);
      } else if (contextType === 'customer' && contextId) {
        rawNotes = await getCustomerNotes(contextId);
      }

      // Frontend Search Filtering (until backend search is implemented)
      let filteredNotes = rawNotes;
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        filteredNotes = filteredNotes.filter(n => 
          n.title?.toLowerCase().includes(lowerSearch) || 
          n.content?.toLowerCase().includes(lowerSearch)
        );
      }

      // Frontend Visibility/Role Filtering
      if (filter === 'mine') {
        filteredNotes = filteredNotes.filter(n => n.created_by === currentUserId);
      }
      
      setNotes(filteredNotes);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      toast.error('Could not load notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contextId) {
      fetchNotes();
    }
  }, [contextType, contextId, filter, searchTerm]);

  const handleDelete = async (noteId) => {
    if (window.confirm('Delete this note permanently?')) {
      try {
        await deleteNote(noteId);
        toast.success('Note deleted');
        fetchNotes();
        onNoteChange();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Delete failed');
      }
    }
  };

  const handleTaskToggle = async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      // 🔥 EXACT FIX: Swap the Base URL from /servicemanagement to /tasks
      const taskBaseUrl = (api.defaults.baseURL || '').replace('servicemanagement', 'tasks');
      
      await api.patch(`/${taskId}/status`, { status: newStatus }, { baseURL: taskBaseUrl });
      
      toast.success(`Task marked ${newStatus}`);
      fetchNotes(); 
      onNoteChange();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update task');
    }
  };

  const getVisibilityIcon = (visibility) => {
    switch (visibility) {
      case 'private': return <FiLock className="text-gray-500" />;
      case 'mentioned_only': return <FiAtSign className="text-blue-500" />;
      case 'centre': return <FiMapPin className="text-green-500" />;
      case 'global': return <FiGlobe className="text-purple-500" />;
      default: return <FiLock className="text-gray-500" />;
    }
  };

  const getVisibilityLabel = (visibility) => {
    switch (visibility) {
      case 'private': return 'Only me';
      case 'mentioned_only': return 'Mentioned staff';
      case 'centre': return 'Entire centre';
      case 'global': return 'All centres';
      default: return visibility;
    }
  };

  const canEditNote = (note) => {
    if (userRole === 'admin' || userRole === 'superadmin') return true;
    return note.created_by === currentUserId;
  };

  const formatNoteContent = (text) => {
    if (!text) return null;

    // 🔥 FIX: Changed \d+ to \w+
    const mentionRegex = /@\[(.*?)\]\((\w+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // 1. Push normal text before the mention
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const name = match[1];
      const id = match[2];
      const isAllStaff = id === 'all';

      // 2. Push the styled mention badge
      parts.push(
        <span 
          key={match.index} 
          className={`font-bold px-1.5 py-0.5 rounded-md mx-0.5 border ${
            isAllStaff 
              ? 'text-rose-700 bg-rose-100/80 border-rose-200' 
              : 'text-indigo-700 bg-indigo-100/80 border-indigo-200'
          }`}
        >
          @{name}
        </span>
      );

      lastIndex = mentionRegex.lastIndex;
    }

    // 3. Push remaining normal text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  return (
    <div className={`notes-panel ${embedded ? '' : 'max-w-6xl mx-auto p-4'}`}>
      {/* Header with actions */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-800">Notes & Tasks</h3>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {notes.length}
          </span>
        </div>
        <button
          onClick={() => { setEditingNote(null); setShowEditor(true); }}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
        >
          <FiPlus className="h-4 w-4" /> New Note
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[180px]">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'mine', 'mentioned', 'centre'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-full transition ${
                filter === f 
                  ? 'bg-indigo-100 text-indigo-700 font-medium' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' && 'All'}
              {f === 'mine' && 'Mine'}
              {f === 'mentioned' && 'Mentions'}
              {f === 'centre' && 'Centre'}
            </button>
          ))}
        </div>
      </div>

      {/* Notes List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : notes.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
          <FiMessageCircle className="mx-auto h-10 w-10 text-gray-400 mb-2" />
          <p className="text-gray-600">No notes yet</p>
          <p className="text-gray-500 text-sm">Click "New Note" to add one</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900">{note.title}</span>
                      <span className="text-xs text-gray-400">
                        by {note.created_by_name || 'Staff'} • {note.created_at ? formatDistanceToNow(new Date(note.created_at), { addSuffix: true }) : ''}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {getVisibilityIcon(note.visibility)} {getVisibilityLabel(note.visibility)}
                      </span>
                    </div>
                    <div className="text-gray-700 text-sm whitespace-pre-wrap mb-3 leading-relaxed">
                      {formatNoteContent(note.content)}
                    </div>

                    {/* Mentions (Placeholder for future) */}
                    {showMentions && note.mentions && note.mentions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {note.mentions.map((m, index) => (
                          <span key={index} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                            <FiAtSign className="h-3 w-3" /> {m.staff_name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Linked Task */}
                    {note.task_id && (
                      <div className={`border rounded-lg p-3 mb-2 transition-colors mt-3 ${note.task_status === 'completed' ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleTaskToggle(note.task_id, note.task_status)}
                              className={`flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity ${note.task_status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-800'}`}
                            >
                              {note.task_status === 'completed' ? <FiCheckCircle className="h-4 w-4 text-emerald-500" /> : <FiClock className="h-4 w-4 text-amber-500" />}
                              {note.task_title}
                            </button>
                            {note.task_due_date && note.task_status !== 'completed' && (
                              <span className="text-xs text-gray-500 flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-gray-100 shadow-sm">
                                <FiCalendar className="h-3 w-3" /> Due {new Date(note.task_due_date).toLocaleDateString('en-IN')}
                              </span>
                            )}
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${note.task_status === 'completed' ? 'bg-gray-200 text-gray-600' : 'bg-amber-200 text-amber-800'}`}>
                            {note.task_assigned_to_name || 'Staff'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1 ml-2">
                    {canEditNote(note) && (
                      <button
                        onClick={() => { setEditingNote(note); setShowEditor(true); }}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 rounded"
                        title="Edit"
                      >
                        <FiEdit2 className="h-4 w-4" />
                      </button>
                    )}
                    {(userRole === 'admin' || userRole === 'superadmin' || note.created_by === currentUserId) && (
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-1.5 text-gray-500 hover:text-rose-600 rounded"
                        title="Delete"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <NoteEditorModal
          note={editingNote}
          contextType={contextType}
          contextId={contextId}
          onClose={() => { setShowEditor(false); setEditingNote(null); }}
          onSave={() => {
            fetchNotes();
            onNoteChange();
            setShowEditor(false);
            setEditingNote(null);
          }}
          showTaskConversion={showTaskConversion}
        />
      )}
    </div>
  );
};

export default NotesPanel;
