import React, { useState, useEffect } from 'react';
import { FiAtSign, FiMessageSquare, FiClock, FiCheck } from 'react-icons/fi';
import { fetchMyMentions, markMentionsRead } from '@/services/knowledge';
import { toast } from 'react-toastify';

const MentionsPage = ({ navigateTo }) => {
  const [mentions, setMentions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMentions = async () => {
      try {
        setLoading(true);
        const data = await fetchMyMentions();
        setMentions(data);
      } catch (err) {
        toast.error('Failed to load mentions');
      } finally {
        setLoading(false);
      }
    };
    loadMentions();
  }, []);

  const handleOpenMention = async (discussionId) => {
    try {
      // Mark as read in the database
      await markMentionsRead(discussionId);
      // Immediately navigate to the discussion!
      navigateTo('discussion-detail', discussionId);
    } catch (err) {
      toast.error('Failed to open discussion');
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FiAtSign className="text-navy-700" /> Mentions Inbox
        </h1>
        <p className="text-sm text-slate-500 mt-1">When someone tags you in a discussion or case, it appears here.</p>
      </div>

      {loading ? (
        <div className="text-center p-12 text-slate-400">Loading inbox...</div>
      ) : mentions.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl border-dashed">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <FiAtSign className="h-8 w-8" />
          </div>
          <h3 className="text-slate-900 font-bold mb-1">Inbox Zero!</h3>
          <p className="text-sm text-slate-500">You are all caught up. No unread mentions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mentions.map(m => (
            <div 
              key={m.id} 
              onClick={() => handleOpenMention(m.discussion_id)}
              className={`p-4 border rounded-xl hover:shadow-md transition-all cursor-pointer group ${
                m.is_read ? 'bg-white border-slate-200 opacity-70' : 'bg-navy-500/10/30 border-navy-500/20 shadow-sm'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  m.is_read ? 'bg-slate-100 text-slate-500' : 'bg-navy-500/10 text-navy-700'
                }`}>
                  <FiAtSign className="h-4 w-4" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-navy-700 transition-colors">
                      {m.author_name} mentioned you
                    </span>
                    {!m.is_read && <span className="text-[10px] font-bold uppercase bg-navy-500/10 text-navy-700 px-2 py-0.5 rounded-full">New</span>}
                  </div>
                  
                  <p className="text-sm text-slate-700 mb-2">
                    In discussion: <span className="font-semibold">{m.discussion_title}</span>
                  </p>
                  
                  <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1"><FiClock className="h-3.5 w-3.5" /> {new Date(m.created_at).toLocaleString()}</span>
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

export default MentionsPage;