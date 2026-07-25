import React, { useState, useEffect } from 'react';
import { FiBookmark, FiMessageSquare, FiFileText, FiTrash2, FiExternalLink } from 'react-icons/fi';
import { fetchMyBookmarks, toggleBookmark } from '@/services/knowledge';
import { toast } from 'react-toastify';

const BookmarksPage = ({ navigateTo }) => {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadBookmarks = async () => {
    try {
      setLoading(true);
      const data = await fetchMyBookmarks();
      setBookmarks(data);
    } catch (err) {
      toast.error('Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBookmarks(); }, []);

  const handleRemove = async (targetType, targetId) => {
    try {
      await toggleBookmark(targetType, targetId);
      // Filter it out of the UI instantly
      setBookmarks(prev => prev.filter(b => !(b.target_type === targetType && b.target_id === targetId)));
      toast.success('Bookmark removed');
    } catch (err) {
      toast.error('Failed to remove bookmark');
    }
  };

  const handleNavigate = (bookmark) => {
    if (bookmark.target_type === 'discussion') {
      navigateTo('discussion-detail', bookmark.target_id);
    }
    // Add routing for documents/trainings later here!
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FiBookmark className="text-indigo-600" /> My Bookmarks
        </h1>
        <p className="text-sm text-gray-500 mt-1">Quick access to your saved discussions, SOPs, and cases.</p>
      </div>

      {loading ? (
        <div className="text-center p-12 text-gray-400">Loading your saved items...</div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl border-dashed">
          <FiBookmark className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-bold mb-1">No bookmarks yet</h3>
          <p className="text-sm text-gray-500">When you see an important thread or document, click the bookmark icon to save it here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bookmarks.map(b => (
            <div key={b.id} className="bg-white border border-gray-200 p-4 rounded-xl hover:shadow-md transition-all group flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${b.target_type === 'discussion' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {b.target_type === 'discussion' ? <FiMessageSquare className="h-4 w-4" /> : <FiFileText className="h-4 w-4" />}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{b.target_type}</span>
                </div>
                <button onClick={() => handleRemove(b.target_type, b.target_id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Remove bookmark">
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
              
              <h3 className="text-base font-bold text-gray-900 mb-4 line-clamp-2">{b.title || 'Untitled Saved Item'}</h3>
              
              <div className="mt-auto pt-3 border-t border-gray-100">
                <button onClick={() => handleNavigate(b)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5">
                  Open Item <FiExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookmarksPage;