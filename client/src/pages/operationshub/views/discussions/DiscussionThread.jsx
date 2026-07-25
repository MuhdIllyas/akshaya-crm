import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiCheckCircle, FiUser, FiClock, FiMessageSquare, FiTarget, FiBriefcase, FiBookmark } from 'react-icons/fi';
import { MentionsInput, Mention } from 'react-mentions';
import { toast } from 'react-toastify';
import { addDiscussionReply, markDiscussionSolved, toggleBookmark } from '@/services/knowledge';

const STAFF_SUGGESTIONS = [
  { id: 1, display: 'Admin' }, 
  { id: 53, display: 'Prajitha P' }, 
  { id: 3, display: 'Rahul K' }
];

const DiscussionThread = ({ discussion, onBack, onUpdate }) => {
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(discussion.is_bookmarked || false);

  useEffect(() => {
    setIsBookmarked(discussion.is_bookmarked || false);
  }, [discussion.is_bookmarked]);

  const handlePostReply = async () => {
    if (!replyText.trim()) return;
    try {
        setIsSubmitting(true);
        await addDiscussionReply(discussion.id, replyText);
        toast.success('Reply posted successfully!');
        setReplyText('');
        onUpdate(); // Reload thread from database
    } catch (err) {
        toast.error('Failed to post reply.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleMarkSolved = async (replyId = null) => {
    try {
        await markDiscussionSolved(discussion.id, replyId);
        toast.success('Discussion marked as Solved! Added to Cases library.');
        onUpdate(); // Reload thread from database
    } catch (err) {
        toast.error('Failed to mark as solved.');
    }
  };

  const handleToggleBookmark = async () => {
    try {
      const result = await toggleBookmark('discussion', discussion.id);
      setIsBookmarked(result.bookmarked);
      toast.success(result.bookmarked ? 'Saved to Bookmarks!' : 'Removed from Bookmarks');
    } catch (err) {
      toast.error('Failed to update bookmark.');
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 mb-6 font-medium transition-colors">
        <FiChevronLeft className="h-4 w-4" /> Back to Discussions
      </button>

      {/* Main Post */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">{discussion.category}</span>
            {discussion.solved ? (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full flex items-center gap-1"><FiCheckCircle/> Solved</span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">Open</span>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button 
              onClick={handleToggleBookmark} 
              className={`p-2 rounded-lg transition-colors border ${isBookmarked ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-400 hover:text-indigo-600 border-gray-200 hover:border-indigo-200'}`}
              title="Bookmark this discussion"
            >
              <FiBookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>

            {!discussion.solved && (
              <button onClick={() => handleMarkSolved()} className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors flex items-center gap-1.5">
                <FiCheckCircle className="h-4 w-4" /> Mark as Solved
              </button>
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">{discussion.title}</h1>
        
        <div className="flex items-center gap-4 text-sm text-gray-500 font-medium mb-6 pb-6 border-b border-gray-100">
          <span className="flex items-center gap-1.5">
            <img src={`https://ui-avatars.com/api/?name=${discussion.author}&background=e0e7ff&color=4338ca`} className="w-5 h-5 rounded-full" alt="Avatar" /> 
            {discussion.author}
          </span>
          <span className="flex items-center gap-1.5"><FiClock /> {discussion.created_at || discussion.lastReply}</span>
        </div>

        {/* CRM Context Block */}
        {(discussion.crm_customer || discussion.crm_application) && (
          <div className="mb-6 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex flex-wrap gap-4 text-sm">
            {discussion.crm_customer && <div className="flex items-center gap-2 text-indigo-900"><FiUser className="text-indigo-500"/> Customer: <span className="font-semibold">{discussion.crm_customer}</span></div>}
            {discussion.crm_application && <div className="flex items-center gap-2 text-indigo-900"><FiBriefcase className="text-indigo-500"/> Application: <span className="font-semibold">{discussion.crm_application}</span></div>}
          </div>
        )}

        <div className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm md:text-base">
          {discussion.description}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-gray-100">
          {discussion.tags?.map(t => <span key={t} className="text-[11px] font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-md">#{t}</span>)}
        </div>
      </div>

      {/* Replies Section */}
      <h3 className="text-lg font-bold text-gray-900 mb-4">{discussion.replies?.length || 0} Replies</h3>
      
      <div className="space-y-4 mb-6">
        {discussion.replies?.map(reply => (
          <div key={reply.id} className={`p-5 rounded-2xl border ${reply.is_best ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <img src={`https://ui-avatars.com/api/?name=${reply.author}&background=f3f4f6&color=4b5563`} className="w-6 h-6 rounded-full" alt="Avatar" />
                <span className="text-sm font-bold text-gray-900">{reply.author}</span>
                <span className="text-xs font-medium text-gray-400">{reply.time}</span>
              </div>
              {reply.is_best && <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full flex items-center gap-1"><FiCheckCircle/> Solution</span>}
            </div>
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{reply.content}</div>
            
            {/* Mark specific reply as solution */}
            {!discussion.solved && (
               <div className="mt-3 flex justify-end">
                   <button onClick={() => handleMarkSolved(reply.id)} className="text-xs font-medium text-gray-500 hover:text-emerald-600 transition-colors">
                       Mark as Best Answer
                   </button>
               </div>
            )}
          </div>
        ))}
      </div>

      {/* Reply Input */}
      {!discussion.solved && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="mb-3 border border-gray-200 rounded-xl bg-gray-50 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-colors">
            <MentionsInput
              value={replyText}
              onChange={(e, val) => setReplyText(val)}
              placeholder="Write your reply... Use @ to tag a team member"
              className="w-full"
              style={{
                control: { minHeight: '100px', fontSize: '14px' },
                input: { padding: '12px', border: 'none', outline: 'none', margin: 0, overflow: 'auto' },
                highlighter: { padding: '12px', margin: 0 }, 
                suggestions: { 
                  list: { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', zIndex: 100, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }, 
                  item: { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '14px' } 
                }
              }}
            >
              <Mention 
                trigger="@" 
                data={STAFF_SUGGESTIONS} 
                markup="@[__display__](__id__)" 
                displayTransform={(id, display) => `@${display}`} 
                style={{ backgroundColor: '#e0e7ff', color: '#4338ca', borderRadius: '4px', zIndex: 1 }}
              />
            </MentionsInput>
          </div>
          <div className="flex justify-end">
            <button onClick={handlePostReply} disabled={isSubmitting} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {isSubmitting ? 'Posting...' : 'Post Reply'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscussionThread;