import React, { useState, useEffect } from 'react';
import { FiEdit2, FiTrash2, FiMessageSquare, FiBell, FiAward } from 'react-icons/fi';
import { fetchMyDrafts, deleteDraft } from '@/services/knowledge';
import { toast } from 'react-toastify';

const DraftsPage = ({ navigateTo, onResumeDraft }) => {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    try {
      setLoading(true);
      setDrafts(await fetchMyDrafts());
    } catch (err) {
      toast.error('Failed to load drafts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Prevents clicking the card when hitting delete
    try {
      await deleteDraft(id);
      setDrafts(prev => prev.filter(d => d.id !== id));
      toast.success('Draft discarded');
    } catch (err) {
      toast.error('Failed to discard draft');
    }
  };

  const getIcon = (type) => {
    if (type === 'announcement') return <FiBell className="h-5 w-5" />;
    if (type === 'training') return <FiAward className="h-5 w-5" />;
    return <FiMessageSquare className="h-5 w-5" />;
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FiEdit2 className="text-indigo-600" /> My Drafts
        </h1>
        <p className="text-sm text-gray-500 mt-1">Unfinished work saved for later.</p>
      </div>

      {loading ? (
        <div className="text-center p-12 text-gray-400">Loading your drafts...</div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl border-dashed">
          <FiEdit2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-bold mb-1">No drafts right now</h3>
          <p className="text-sm text-gray-500">When you save an unfinished post, it will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drafts.map(draft => (
            <div 
              key={draft.id} 
              onClick={() => onResumeDraft(draft)}
              className="bg-white border border-gray-200 p-4 rounded-xl hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group flex flex-col"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gray-50 text-gray-600 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors">
                    {getIcon(draft.entity_type)}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{draft.entity_type}</span>
                </div>
                <button 
                  onClick={(e) => handleDelete(e, draft.id)} 
                  className="text-gray-400 hover:text-red-500 transition-colors p-1" 
                  title="Discard Draft"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
              
              <h3 className="text-base font-bold text-gray-900 mb-2 truncate">
                {draft.title || 'Untitled Draft'}
              </h3>
              
              <div className="mt-auto pt-3 border-t border-gray-100 text-xs text-gray-500 flex justify-between items-center">
                <span>Last updated {new Date(draft.updated_at).toLocaleDateString()}</span>
                <span className="text-indigo-600 font-semibold group-hover:underline">Resume &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DraftsPage;