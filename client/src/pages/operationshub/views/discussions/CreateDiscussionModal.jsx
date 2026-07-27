import React, { useState } from 'react';
import { FiX, FiPaperclip, FiLink, FiLayers } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { MentionsInput, Mention } from 'react-mentions';
import { createDiscussion, saveDraft, fetchStaffSuggestions, lookupCrmRecord } from '@/services/knowledge';

const CATEGORIES = [
  { id: 'question', label: 'Question' },
  { id: 'customer_issue', label: 'Customer Issue' },
  { id: 'bug', label: 'Bug / Tech Issue' },
  { id: 'suggestion', label: 'Suggestion' }
];

const CreateDiscussionModal = ({ isOpen, onClose, onSubmit, existingDraft }) => {
  const [formData, setFormData] = useState(existingDraft?.payload || {
    title: '', content: '', category: 'question', priority: 'medium', tags: [], relatedTo: 'none', relatedId: ''
  });
  const [tagInput, setTagInput] = useState('');
  const [crmPreview, setCrmPreview] = useState(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const handleLookup = async () => {
    if (!formData.relatedId) return;
    try {
      setIsLookingUp(true);
      
      // 🔥 THE FIX: Pass formData.serviceId to securely validate it!
      const data = await lookupCrmRecord(formData.relatedTo, formData.relatedId, formData.serviceId);
      
      setCrmPreview(data);
      toast.success("Record found and linked!");
    } catch (err) {
      setCrmPreview(null);
      console.error("LOOKUP FAILED:", err.response || err);
      toast.error(err.response?.data?.error || "Record not found or access denied");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const loadSuggestions = async (query, callback) => {
    try {
      const data = await fetchStaffSuggestions(query);
      callback(data);
    } catch (err) {
      console.error("Failed to load staff for mentions");
    }
  };

  const handleSaveDraft = async () => {
    try {
      setIsSavingDraft(true);
      
      await saveDraft({
        entityType: 'discussion',
        title: formData.title || 'Untitled Discussion',
        payload: formData,
        draftId: existingDraft?.id || null // Updates the draft if it already exists!
      });
      
      toast.success('Saved to Drafts!');
      onClose();
    } catch (err) {
      toast.error('Failed to save draft.');
    } finally {
      setIsSavingDraft(false);
    }
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

              <div className="border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 overflow-hidden bg-white">
                <MentionsInput
                  value={formData.content}
                  onChange={(e, val) => setFormData(prev => ({ ...prev, content: val }))}
                  placeholder="Provide details... Use @ to tag a team member"
                  className="w-full"
                  style={{
                    control: { fontFamily: 'inherit', fontSize: '14px', lineHeight: '1.5', minHeight: '100px' },
                    input: { padding: '12px', border: 'none', outline: 'none', margin: 0, boxSizing: 'border-box', overflow: 'auto' },
                    highlighter: { padding: '12px', margin: 0, boxSizing: 'border-box' },
                    suggestions: { 
                      list: { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', zIndex: 100, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }, 
                      item: { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '14px' } 
                    }
                  }}
                >
                  <Mention 
                    trigger="@" 
                    data={loadSuggestions} 
                    markup="@[__display__](__id__)" 
                    displayTransform={(id, display) => `@${display}`} 
                    style={{ backgroundColor: '#e0e7ff', color: '#4338ca', borderRadius: '4px', zIndex: 1 }}
                  />
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

            <div className="border-t border-gray-100 pt-4 mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <FiLink className="text-gray-400" /> Link to CRM Record (Optional)
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select 
                  value={formData.workspaceId} // or formData.serviceId
                  onChange={e => {
                    setFormData(prev => ({ 
                      ...prev, 
                      workspaceId: e.target.value,
                      // 🔥 THE UX FIX: Wipe the linked CRM data if they change the workspace!
                      relatedTo: 'none',
                      relatedId: ''
                    }));
                    // Wipe the blue preview card
                    setCrmPreview(null); 
                  }} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm"
                >
                  <option value="none">No Link</option>
                  <option value="serviceEntry">Service Application</option>
                </select>

                {formData.relatedTo !== 'none' && (
                  <div className="sm:col-span-2 flex gap-2">
                    <input 
                      type="number" 
                      value={formData.relatedId} 
                      onChange={e => {
                        setFormData(prev => ({ ...prev, relatedId: e.target.value }));
                        setCrmPreview(null); 
                      }} 
                      placeholder="e.g., 6687 (Tracking ID)" 
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm" 
                    />
                    <button 
                      type="button"
                      onClick={handleLookup}
                      disabled={isLookingUp || !formData.relatedId}
                      className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50"
                    >
                      {isLookingUp ? 'Searching...' : 'Verify'}
                    </button>
                  </div>
                )}
              </div>

              {/* THE PREVIEW CARD */}
              {crmPreview && (
                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600">
                    <FiLayers className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      {crmPreview.id} 
                      <span className="text-[10px] uppercase tracking-wider bg-white px-2 py-0.5 rounded text-indigo-600 border border-indigo-100">
                        {crmPreview.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      <span className="font-semibold">{crmPreview.title}</span> • Customer: {crmPreview.customer}
                    </div>
                  </div>
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
              <button 
                type="button" 
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition" 
                onClick={onClose}
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
                className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition disabled:opacity-50"
              >
                {isSavingDraft ? 'Saving...' : 'Save Draft'}
              </button>

              <button 
                type="submit" 
                disabled={!formData.title.trim() || !formData.content.trim()}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
              >
                Publish Discussion
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreateDiscussionModal;