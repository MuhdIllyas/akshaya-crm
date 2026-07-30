import React, { useState, useEffect } from 'react';
import { FiAward, FiPlus, FiVideo, FiFileText, FiClock, FiExternalLink, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { fetchTrainings, createTraining } from '@/services/knowledge'; // Adjust path

const LearningView = () => {
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({ title: '', description: '', type: 'video', url: '', duration: '' });

  const loadTrainings = async () => {
    try {
      setLoading(true);
      const data = await fetchTrainings();
      setTrainings(data);
    } catch (err) {
      toast.error('Failed to load training materials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTrainings(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await createTraining(formData);
      toast.success('Training material added!');
      setIsModalOpen(false);
      setFormData({ title: '', description: '', type: 'video', url: '', duration: '' });
      loadTrainings();
    } catch (err) {
      toast.error('Failed to add training');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Learning Center</h2>
          <p className="text-sm text-gray-500 mt-1">Official video tutorials, courses, and onboarding guides.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
        >
          <FiPlus className="h-4 w-4" /> Add Training
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-400">Loading learning materials...</div>
      ) : trainings.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl border-dashed">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <FiAward className="h-8 w-8" />
          </div>
          <h3 className="text-gray-900 font-bold mb-1">No Training Materials</h3>
          <p className="text-gray-500 text-sm">Upload videos or guides to help train your staff.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {trainings.map(t => (
            <div 
              key={t.id} 
              onClick={() => window.open(t.url, '_blank')}
              className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all flex flex-col"
            >
              <div className={`h-32 flex items-center justify-center ${t.type === 'video' ? 'bg-indigo-50 text-indigo-300' : 'bg-emerald-50 text-emerald-300'}`}>
                {t.type === 'video' ? <FiVideo className="h-12 w-12 group-hover:scale-110 transition-transform" /> : <FiFileText className="h-12 w-12 group-hover:scale-110 transition-transform" />}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">{t.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-4 flex-1">{t.description}</p>
                <div className="flex items-center justify-between text-xs font-semibold text-gray-400 pt-4 border-t border-gray-100">
                  <span className="flex items-center gap-1.5"><FiClock className="h-3.5 w-3.5" /> {t.duration || 'N/A'}</span>
                  <span className="flex items-center gap-1 text-indigo-500 group-hover:text-indigo-700">Open <FiExternalLink /></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FiAward className="text-indigo-600"/> Add Training</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500"><FiX className="h-5 w-5" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. eDistrict Onboarding" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <textarea required rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="What will they learn?" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                    <option value="video">Video Course</option>
                    <option value="article">Written Guide</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Duration</label>
                  <input type="text" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none" placeholder="e.g. 15 mins" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Resource URL (YouTube, Drive, etc.)</label>
                <input required type="url" value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://..." />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : 'Save Training'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningView;