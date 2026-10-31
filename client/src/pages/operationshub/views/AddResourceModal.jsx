import React, { useState } from 'react';
import { FiX, FiLink, FiFileText, FiVideo, FiImage, FiGlobe } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const RESOURCE_TYPES = [
  { id: 'portal', label: 'Official Portal', icon: FiGlobe },
  { id: 'pdf', label: 'PDF Document', icon: FiFileText },
  { id: 'video', label: 'Training Video', icon: FiVideo },
  { id: 'image', label: 'Reference Image', icon: FiImage }
];

const AddResourceModal = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState({ type: 'portal', title: '', url: '' });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-white rounded-2xl shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-900">Add Resource</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-500"><FiX className="h-5 w-5" /></button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Resource Type</label>
              <div className="grid grid-cols-2 gap-3">
                {RESOURCE_TYPES.map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.id })}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition-all ${
                      formData.type === type.id 
                        ? 'bg-navy-500/10 border-navy-500/20 text-navy-700 ring-1 ring-navy-500' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <type.icon className={formData.type === type.id ? 'text-navy-700' : 'text-slate-400'} /> 
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
              <input
                type="text" required
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., eDistrict Login Portal"
                className="min-h-[44px] w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-navy-500 outline-none transition-all text-base sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Link (URL)</label>
              <div className="relative">
                <FiLink className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="url" required
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://..."
                  className="min-h-[44px] w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-navy-500 outline-none transition-all text-base sm:text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 text-sm font-medium text-white bg-navy-700 hover:bg-navy-700 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm">
                {isSubmitting ? 'Saving...' : 'Save Resource'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AddResourceModal;