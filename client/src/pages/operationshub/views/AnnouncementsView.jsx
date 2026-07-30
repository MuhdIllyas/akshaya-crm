import React, { useState, useEffect } from 'react';
import { FiBell, FiPlus, FiHeart, FiClock, FiUser, FiX, FiFileText } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { fetchAnnouncements, createAnnouncement } from '@/services/knowledge'; // Adjust path

const AnnouncementsView = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '', content: '', category: 'general', priority: 'normal', isPinned: false
  });

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await fetchAnnouncements();
      setAnnouncements(data);
    } catch (err) {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAnnouncements(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await createAnnouncement(formData);
      toast.success('Announcement published!');
      setIsModalOpen(false);
      setFormData({ title: '', content: '', category: 'general', priority: 'normal', isPinned: false });
      loadAnnouncements(); // Refresh the list
    } catch (err) {
      toast.error('Failed to publish announcement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-300 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Announcements</h2>
          <p className="text-sm text-gray-500 mt-1">Global updates, government circulars, and system notices.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
        >
          <FiPlus className="h-4 w-4" /> New Announcement
        </button>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="p-12 text-center text-gray-400">Loading feed...</div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl border-dashed">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <FiBell className="h-8 w-8" />
          </div>
          <h3 className="text-gray-900 font-bold mb-1">No Announcements</h3>
          <p className="text-gray-500 text-sm">Create an announcement to broadcast it to all staff.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => (
            <div key={a.id} className={`bg-white border rounded-2xl p-5 transition-all ${a.is_pinned ? 'border-amber-200 shadow-sm' : 'border-gray-200'}`}>
              <div className="flex justify-between items-start mb-3 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {a.is_pinned && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded"><FiHeart className="h-3 w-3"/> Pinned</span>}
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${a.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{a.priority} Priority</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{a.category}</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{a.title}</h3>
                </div>
              </div>
              <p className="text-gray-700 text-sm whitespace-pre-wrap mb-4">{a.content}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
                <span className="flex items-center gap-1"><FiUser className="h-3.5 w-3.5" /> {a.author_name || 'System Admin'}</span>
                <span className="flex items-center gap-1"><FiClock className="h-3.5 w-3.5" /> {new Date(a.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FiBell className="text-indigo-600"/> Broadcast Update</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500"><FiX className="h-5 w-5" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Server maintenance tonight" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Message</label>
                <textarea required rows="4" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="Provide details here..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                    <option value="general">General</option>
                    <option value="government">Government Order</option>
                    <option value="software">Software Update</option>
                    <option value="training">Training</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Priority</label>
                  <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="pin" checked={formData.isPinned} onChange={e => setFormData({...formData, isPinned: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                <label htmlFor="pin" className="text-sm text-gray-700 font-medium cursor-pointer">Pin to top of the dashboard feed</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50">
                  {isSubmitting ? 'Publishing...' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsView;