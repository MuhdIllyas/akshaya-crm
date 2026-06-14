import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FiX, FiPaperclip, FiUpload, FiUser, FiAtSign, FiMapPin, 
  FiGlobe, FiLock, FiCheck, FiCalendar, FiAlertCircle
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { createNote, updateNote } from '@/services/noteService';
import { getStaff } from '@/services/serviceService';
import { MentionsInput, Mention } from 'react-mentions';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import api from '@/services/serviceService';

const NoteEditorModal = ({ 
  note = null,
  contextType,
  contextId,
  onClose,
  onSave,
  showTaskConversion = true
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('centre');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [mentions, setMentions] = useState([]);
  const [createTask, setCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState([]);

  useEffect(() => {
    const loadStaffForMentions = async () => {
      try {
        const centreId = localStorage.getItem('centre_id');
        const response = await getStaff(centreId);
        
        const formattedStaff = response.data.map(staff => ({
          id: staff.id,
          display: staff.name
        }));
        
        setStaffList(formattedStaff);
      } catch (error) {
        console.error('Failed to load staff for mentions', error);
      }
    };

    loadStaffForMentions();
  }, []);

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setVisibility(note.visibility || 'centre');
      setMentions(note.mentions?.map(m => m.staff_id) || []);
      
      if (note.task && showTaskConversion) {
        setCreateTask(true);
        setTaskTitle(note.task.title);
        setTaskAssignee(String(note.task.assigned_to));
        setTaskDueDate(note.task.due_date ? new Date(note.task.due_date) : null);
      }
    } else {
      if (contextType === 'service_entry' && contextId) {
        setTitle(`Note for Service Entry #${contextId}`);
      } else if (contextType === 'customer' && contextId) {
        setTitle(`Customer Note`);
      }
    }
  }, [note, contextType, contextId]);

  const handleFileChange = async (e) => {
    toast.info("Attachments will be available in the next update!");
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleMentionChange = (event, newValue, newPlainTextValue, mentionsArray) => {
    setContent(newValue);
    const mentionedIds = mentionsArray.map(m => parseInt(m.id));
    setMentions(mentionedIds);
  };

  const fetchStaffSuggestions = (query, callback) => {
      if (query.length === 0) {
        return callback(staffList);
      }
      
      const filtered = staffList.filter(s => 
        s.display.toLowerCase().includes(query.toLowerCase())
      );
      
      callback(filtered);
    };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('Please enter some content');
      return;
    }

    setLoading(true);

    const payload = {
      title: title.trim(),
      content: content.trim(),
      visibility,
      mentions
    };

    if (contextType === 'service_entry' && contextId) payload.related_service_entry_id = parseInt(contextId);
    if (contextType === 'customer' && contextId) payload.related_customer_id = parseInt(contextId);
    if (contextType === 'tracking' && contextId) payload.related_service_tracking_id = parseInt(contextId);

    try {
      let savedNoteId = null;

      if (note) {
        await updateNote(note.id, payload);
        savedNoteId = note.id;
        toast.success('Note updated');
      } else {
        const response = await createNote(payload);
        // Safely extract the new note ID
        savedNoteId = response?.data?.id || response?.id || response?.data?.note?.id;
        toast.success('Note created');
      }

      // 🔥 Trigger the Task System via your existing tasks.js endpoint
      if (createTask && taskTitle && taskAssignee && savedNoteId && !note?.task_id) {
        const taskPayload = {
          title: taskTitle.trim(),
          description: content.trim(), 
          assigned_to: parseInt(taskAssignee),
          due_date: taskDueDate ? taskDueDate.toISOString().split('T')[0] : null,
          priority: 'medium',
          note_id: savedNoteId,
        };

        if (contextType === 'service_entry') taskPayload.related_service_entry_id = parseInt(contextId);
        if (contextType === 'customer') taskPayload.related_customer_id = parseInt(contextId);

        // 🔥 EXACT FIX: Swap the Base URL from /servicemanagement to /tasks for this request
        const taskBaseUrl = (api.defaults.baseURL || '').replace('servicemanagement', 'tasks');
        
        await api.post('/add', taskPayload, { baseURL: taskBaseUrl });
        toast.success('Task created & linked to chat!');
      }

      onSave();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  // Visibility options with labels and icons
  const visibilityOptions = [
    { value: 'private', label: 'Private', icon: FiLock, desc: 'Only you' },
    { value: 'centre', label: 'Centre', icon: FiMapPin, desc: 'All staff in your centre' },
    { value: 'mentioned_only', label: 'Mentions', icon: FiAtSign, desc: 'You + mentioned' },
  ];

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold">{note ? 'Edit Note' : 'New Note'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FiX className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title (Optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Short summary..."
            />
          </div>

          {/* Content with mentions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note *</label>
            <MentionsInput
              value={content}
              onChange={handleMentionChange}
              className="mentions-input"
              style={{
                control: {
                  backgroundColor: '#fff',
                  fontSize: 14,
                  fontWeight: 'normal',
                  width: '100%',
                  border: '1px solid #e2e8f0', // <-- MOVED HERE
                  borderRadius: '0.75rem',     // <-- MOVED HERE
                  minHeight: '100px',          // <-- MOVED HERE
                  lineHeight: '1.5',
                  overflow: 'hidden',          // Prevents inner absolute elements from spilling
                },
                highlighter: { 
                  padding: '0.85rem', 
                  boxSizing: 'border-box',
                  lineHeight: '1.5',
                  margin: 0,
                },
                input: { 
                  padding: '0.85rem', 
                  border: 'none',              // <-- REMOVED (handled by control)
                  outline: 'none',
                  lineHeight: '1.5', 
                  boxSizing: 'border-box',
                  width: '100%',
                  height: '100%',              // Tells it to fill the control box
                  margin: 0,
                  color: '#333',
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
                    overflowY: 'auto'
                  },
                  item: { 
                    padding: '8px 12px', 
                    borderBottom: '1px solid #f1f5f9',
                    '&focused': { backgroundColor: '#eef2ff' } 
                  },
                },
              }}
            >
              <Mention
                trigger="@"
                data={fetchStaffSuggestions}
                markup="@[__display__](__id__)"
                displayTransform={(id, display) => `@${display}`}
                renderSuggestion={(suggestion, search, highlightedDisplay) => (
                  <div className="flex items-center gap-2">
                    <FiUser className="h-3 w-3 text-gray-500" />
                    {highlightedDisplay}
                  </div>
                )}
              />
            </MentionsInput>
            <p className="text-xs text-gray-500 mt-1">Type @ to mention staff members</p>
          </div>

          {/* Visibility Options - FIXED with inline grid to guarantee no overlap */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
              gap: '0.75rem'
            }}>
              {visibilityOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = visibility === opt.value;
                return (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      padding: '0.75rem',
                      borderRadius: '0.75rem',
                      border: `1px solid ${isSelected ? '#6366f1' : '#e5e7eb'}`,
                      backgroundColor: isSelected ? '#eef2ff' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={opt.value}
                      checked={isSelected}
                      onChange={(e) => setVisibility(e.target.value)}
                      style={{ marginTop: '0.25rem' }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>
                        <Icon style={{ width: '1rem', height: '1rem', color: isSelected ? '#4f46e5' : '#6b7280' }} />
                        {opt.label}
                      </div>
                      <p style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.125rem' }}>{opt.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Attachments - UI preserved but disabled for V1 */}
          <div className="opacity-60 relative group">
            <div className="absolute inset-0 z-10" onClick={() => toast.info("Attachments coming in V2")} />
            <label className="block text-sm font-medium text-gray-700 mb-2">Attachments (Coming Soon)</label>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="cursor-not-allowed bg-gray-100 rounded-lg px-3 py-2 text-sm flex items-center gap-2 text-gray-500">
                <FiUpload className="h-4 w-4" /> Upload Files
              </label>
            </div>
          </div>

          {/* Create Task Checkbox */}
          {showTaskConversion && !note?.task && (
            <div className="border-t border-gray-200 pt-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createTask}
                  onChange={(e) => setCreateTask(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 mt-0.5"
                />
                <span className="text-sm font-medium text-gray-800">Create a task from this note</span>
              </label>

              {createTask && (
                <div className="mt-4 ml-6 space-y-4 border-l-2 border-indigo-200 pl-4 py-1">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
                    <input
                      type="text"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      required={createTask}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="e.g., Collect missing document"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assign To *</label>
                      <select
                        value={taskAssignee}
                        onChange={(e) => setTaskAssignee(e.target.value)}
                        required={createTask}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      >
                        <option value="">Select staff</option>
                        {staffList.map(staff => (
                          <option key={staff.id} value={staff.id}>
                            {staff.display}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (Optional)</label>
                      <DatePicker
                        selected={taskDueDate}
                        onChange={(date) => setTaskDueDate(date)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholderText="Select date"
                        dateFormat="dd/MM/yyyy"
                        minDate={new Date()}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 transition"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FiCheck className="h-4 w-4" />
              )}
              {note ? 'Update Note' : 'Save Note'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default NoteEditorModal;
