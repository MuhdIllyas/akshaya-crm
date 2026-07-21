import React, { useState } from 'react';
import { FiChevronLeft, FiCheckCircle, FiUser, FiClock, FiMessageSquare, FiTarget, FiBriefcase } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { addDiscussionReply, markDiscussionSolved } from '@/services/knowledge';

const DiscussionThread = ({ discussion, onBack }) => {
  const [replyText, setReplyText] = useState('');

  const handlePostReply = async () => {
    if (!replyText.trim()) return;
    try {
        await addDiscussionReply(discussion.id, replyText);
        toast.success('Reply posted successfully!');
        setReplyText('');
        onUpdate(); 
    } catch (err) {
        toast.error('Failed to post reply.');
    }
  };

  const handleMarkSolved = async (replyId = null) => {
    try {
        await markDiscussionSolved(discussion.id, replyId);
        toast.success('Discussion marked as Solved! Added to Cases library.');
        onUpdate(); // Reload thread
    } catch (err) {
        toast.error('Failed to mark as solved.');
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
          {!discussion.solved && (
            <button onClick={handleMarkSolved} className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors flex items-center gap-1.5">
              <FiCheckCircle className="h-4 w-4" /> Mark as Solved
            </button>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">{discussion.title}</h1>
        
        <div className="flex items-center gap-4 text-sm text-gray-500 font-medium mb-6 pb-6 border-b border-gray-100">
          <span className="flex items-center gap-1.5"><img src={`https://ui-avatars.com/api/?name=${discussion.author}&background=e0e7ff&color=4338ca`} className="w-5 h-5 rounded-full" /> {discussion.author}</span>
          <span className="flex items-center gap-1.5"><FiClock /> {discussion.created_at}</span>
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
                <img src={`https://ui-avatars.com/api/?name=${reply.author}&background=f3f4f6&color=4b5563`} className="w-6 h-6 rounded-full" />
                <span className="text-sm font-bold text-gray-900">{reply.author}</span>
                <span className="text-xs font-medium text-gray-400">{reply.time}</span>
              </div>
              {reply.is_best && <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full flex items-center gap-1"><FiCheckCircle/> Solution</span>}
            </div>
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{reply.content}</div>
          </div>
        ))}
      </div>

      {/* Reply Input */}
      {!discussion.solved && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Write your reply... Use @ to mention staff"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] resize-y mb-3"
          />
          <div className="flex justify-end">
            <button onClick={handlePostReply} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              Post Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscussionThread;