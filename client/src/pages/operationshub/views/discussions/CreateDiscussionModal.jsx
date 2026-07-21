import React, { useState } from 'react';
import { FiX, FiPaperclip } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { MentionsInput, Mention } from 'react-mentions';

const STAFF_SUGGESTIONS = [
  { id: 1, display: 'Admin' }, { id: 2, display: 'Sneha M' }, { id: 3, display: 'Rahul K' }
];

const CATEGORIES = [
  { id: 'question', label: 'Question' },
  { id: 'customer_issue', label: 'Customer Issue' },
  { id: 'bug', label: 'Bug / Tech Issue' },
  { id: 'suggestion', label: 'Suggestion' }
];

const CreateDiscussionModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '', content: '', category: 'question', priority: 'medium', tags: [], relatedTo: 'none', relatedId: ''
  });
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h2 className="text-xl font-bold text-gray-900">Start a Discussion</h2>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={onClose}>
              <FiX className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text" required
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="What's the issue or question?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Details & Context</label>
              <MentionsInput
                value={formData.content}
                onChange={(e, val) => setFormData(prev => ({ ...prev, content: val }))}
                placeholder="Provide details... Use @ to tag a team member"
                className="w-full"
                style={{
                  control: { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', minHeight: '100px' },
                  input: { padding: '0.75rem', border: 'none', outline: 'none' },
                  suggestions: { list: { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', zIndex: 100 }, item: { padding: '5px 10px', borderBottom: '1px solid #f1f5f9' } }
                }}
              >
                <Mention trigger="@" data={STAFF_SUGGESTIONS} markup="@[__display__](__id__)" displayTransform={(id, display) => `@${display}`} />
              </MentionsInput>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={formData.category} onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select value={formData.priority} onChange={e => setFormData(prev => ({ ...prev, priority: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical 🚨</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link to CRM Record</label>
                <select value={formData.relatedTo} onChange={e => setFormData(prev => ({ ...prev, relatedTo: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none">
                  <option value="none">None</option>
                  <option value="customer">Customer Profile</option>
                  <option value="serviceEntry">Service Entry / Application</option>
                </select>
              </div>
              {formData.relatedTo !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Record ID</label>
                  <input type="text" value={formData.relatedId} onChange={e => setFormData(prev => ({ ...prev, relatedId: e.target.value }))} placeholder="e.g., APP-9821" className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500">
                {formData.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-1 rounded-full">
                    {tag} <FiX className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                  </span>
                ))}
                <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }} placeholder="Add tag..." className="flex-1 min-w-[80px] border-none outline-none text-sm py-1" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
              <button type="button" className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50" onClick={onClose}>Cancel</button>
              <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Publish Discussion</button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreateDiscussionModal;