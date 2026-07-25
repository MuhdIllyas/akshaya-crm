import React, { useState, useEffect } from 'react';
import { FiEye, FiMessageSquare, FiUser, FiClock, FiCheckCircle, FiLayers } from 'react-icons/fi';
import { fetchMyFollowing } from '@/services/knowledge';
import { toast } from 'react-toastify';

const FollowingPage = ({ navigateTo }) => {
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFollowing = async () => {
      try {
        setLoading(true);
        const data = await fetchMyFollowing();
        setDiscussions(data);
      } catch (err) {
        toast.error('Failed to load your watchlist');
      } finally {
        setLoading(false);
      }
    };
    loadFollowing();
  }, []);

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FiEye className="text-indigo-600" /> Following Watchlist
        </h1>
        <p className="text-sm text-gray-500 mt-1">Discussions and cases you are actively monitoring.</p>
      </div>

      {loading ? (
        <div className="text-center p-12 text-gray-400">Loading watchlist...</div>
      ) : discussions.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl border-dashed">
          <FiEye className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-bold mb-1">Not following anything</h3>
          <p className="text-sm text-gray-500">Click the eye icon on any discussion to track its progress here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {discussions.map(d => (
            <div 
              key={d.id} 
              onClick={() => navigateTo('discussion-detail', d.id)}
              className="bg-white border border-gray-200 p-4 rounded-xl hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  d.status === 'solved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {d.status === 'solved' ? <FiCheckCircle className="h-4 w-4" /> : <FiMessageSquare className="h-4 w-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1">
                      <FiLayers className="h-3 w-3" /> {d.service_name || 'General'}
                    </span>
                  </div>
                  
                  <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {d.title}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500 mt-2">
                    <span className="flex items-center gap-1"><FiUser className="h-3.5 w-3.5" /> {d.author_name}</span>
                    <span className="flex items-center gap-1"><FiClock className="h-3.5 w-3.5" /> Last active: {new Date(d.updated_at).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><FiMessageSquare className="h-3.5 w-3.5" /> {d.replies_count} Replies</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FollowingPage;