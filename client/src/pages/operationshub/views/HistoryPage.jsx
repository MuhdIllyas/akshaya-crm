import React, { useState, useEffect } from 'react';
import { FiClock, FiMessageSquare, FiFileText } from 'react-icons/fi';
import { fetchMyHistory } from '@/services/knowledge';
import { toast } from 'react-toastify';

const HistoryPage = ({ navigateTo }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const data = await fetchMyHistory();
        setHistory(data);
      } catch (err) {
        toast.error('Failed to load history');
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FiClock className="text-indigo-600" /> Recently Viewed
        </h1>
        <p className="text-sm text-gray-500 mt-1">Jump right back into the last 50 items you were looking at.</p>
      </div>

      {loading ? (
        <div className="text-center p-12 text-gray-400">Loading your history...</div>
      ) : history.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl border-dashed">
          <FiClock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-900 font-bold mb-1">No history yet</h3>
          <p className="text-sm text-gray-500">Items you view in the Operations Hub will appear here automatically.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {history.map((item, index) => (
            <div 
              key={item.id} 
              onClick={() => navigateTo('discussion-detail', item.target_id)}
              className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                index !== history.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div className={`p-2 rounded-lg ${item.target_type === 'discussion' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                {item.target_type === 'discussion' ? <FiMessageSquare className="h-5 w-5" /> : <FiFileText className="h-5 w-5" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 truncate">{item.title}</h4>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  <span className="uppercase font-bold tracking-wider">{item.target_type}</span>
                  <span>•</span>
                  <span>Viewed {new Date(item.last_viewed_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;