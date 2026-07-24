import React, { useState, useEffect } from 'react';
import { FiMessageSquare, FiCheckCircle, FiSearch, FiFilter, FiUser, FiClock, FiLayers } from 'react-icons/fi';
import { fetchAllDiscussions } from '@/services/knowledge'; // Adjust path based on your folder structure
import { toast } from 'react-toastify';

const GlobalDiscussions = ({ navigateTo }) => {
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadDiscussions = async () => {
      try {
        setLoading(true);
        const data = await fetchAllDiscussions();
        setDiscussions(data);
      } catch (err) {
        toast.error('Failed to load global discussions');
      } finally {
        setLoading(false);
      }
    };
    loadDiscussions();
  }, []);

  // Filter based on search input
  const filteredDiscussions = discussions.filter(d => 
    d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (d.service_name && d.service_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-6xl mx-auto animate-in fade-in duration-300 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Global Discussions</h1>
          <p className="text-sm text-gray-500 mt-1">Live feed of all staff questions and solved cases across every service.</p>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search discussions..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
        </div>
      </div>

      {/* Feed List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center p-12 text-gray-400">Loading live discussions...</div>
        ) : filteredDiscussions.length === 0 ? (
          <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl border-dashed">
            <FiMessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-gray-900 font-bold mb-1">No discussions found</h3>
            <p className="text-sm text-gray-500">No active discussions match your search.</p>
          </div>
        ) : (
          filteredDiscussions.map(discussion => (
            <div 
              key={discussion.id} 
              onClick={() => navigateTo('discussion-detail', discussion.id)} 
              className="bg-white border border-gray-200 p-4 rounded-xl hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                
                {/* Status Icon */}
                <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  discussion.status === 'solved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {discussion.status === 'solved' ? <FiCheckCircle className="h-4 w-4" /> : <FiMessageSquare className="h-4 w-4" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1">
                      <FiLayers className="h-3 w-3" /> {discussion.service_name || 'General Service'}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      discussion.status === 'solved' ? 'text-emerald-700 bg-emerald-100' : 'text-amber-700 bg-amber-100'
                    }`}>
                      {discussion.status === 'solved' ? 'Solved' : 'Open'}
                    </span>
                  </div>
                  
                  <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {discussion.title}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500 mt-2">
                    <span className="flex items-center gap-1"><FiUser className="h-3.5 w-3.5" /> {discussion.author_name}</span>
                    <span className="flex items-center gap-1"><FiClock className="h-3.5 w-3.5" /> {new Date(discussion.created_at).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><FiMessageSquare className="h-3.5 w-3.5" /> {discussion.replies_count} Replies</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GlobalDiscussions;