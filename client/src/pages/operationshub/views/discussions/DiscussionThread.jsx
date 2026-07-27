import React, { useState } from 'react';
import { 
  FiArrowLeft, FiMoreHorizontal, FiShare2, FiMessageSquare, 
  FiCheckCircle, FiImage, FiPaperclip, FiSmile, FiArrowUp, FiArrowDown 
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { addReply } from '@/services/knowledge'; 

// --- UI HELPER: Generates a color-coded avatar based on a name ---
const Avatar = ({ name, size = "md" }) => {
  const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500'];
  const colorIndex = name ? name.length % colors.length : 0;
  
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base"
  };

  return (
    <div className={`${sizeClasses[size]} ${colors[colorIndex]} text-white rounded-full flex items-center justify-center font-bold flex-shrink-0 shadow-sm`}>
      {initials}
    </div>
  );
};

// --- UI HELPER: Discord-style Reaction Pill ---
const ReactionPill = ({ emoji, count, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
      active ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
    }`}
  >
    <span>{emoji}</span> <span>{count}</span>
  </button>
);

// --- MAIN COMPONENT ---
const DiscussionThread = ({ discussion, onBack, onUpdate }) => {
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fallback for dates just in case the parent didn't format them
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const handlePostReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    try {
      setIsSubmitting(true);
      // Calls your existing backend function
      await addReply(discussion.id, replyText); 
      setReplyText('');
      toast.success("Reply posted!");
      if (onUpdate) onUpdate(); // Refresh the thread!
    } catch (err) {
      toast.error("Failed to post reply.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!discussion) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      
      {/* 1. HEADER (Navigation & Title) */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition">
          <FiArrowLeft /> Back
        </button>
        <div className="flex items-center gap-2">
          {discussion.solved && (
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <FiCheckCircle /> Solved
            </span>
          )}
          <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition"><FiShare2 /></button>
          <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition"><FiMoreHorizontal /></button>
        </div>
      </div>

      {/* 2. THE MAIN POST (Reddit-style layout) */}
      <div className="p-6 flex gap-4">
        
        {/* Left Column: Avatar & Thread Line */}
        <div className="flex flex-col items-center">
          <Avatar name={discussion.author} size="lg" />
          <div className="w-0.5 h-full bg-gray-100 my-2 rounded-full"></div>
        </div>

        {/* Right Column: Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="text-sm font-bold text-gray-900">{discussion.author}</h3>
            <span className="text-xs text-gray-500">· {formatDate(discussion.created_at || discussion.time)}</span>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2 leading-snug">{discussion.title}</h1>
          
          {/* Tags */}
          {discussion.tags && discussion.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {discussion.tags.map(tag => (
                <span key={tag} className="bg-indigo-50 text-indigo-600 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Body Content */}
          <div className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">
            {discussion.description || discussion.content}
          </div>

          {/* Image Attachments Array Mapping (Ready for backend integration) */}
          {discussion.attachments && discussion.attachments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {discussion.attachments.map((img, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden border border-gray-200 group bg-gray-100 aspect-video">
                  <img src={img.url} alt="attachment" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="bg-white/90 text-gray-900 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">View Full Image</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action & Reaction Bar */}
          <div className="flex items-center flex-wrap gap-3 mt-5">
            {/* Reddit-style Upvotes */}
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
              <button className="px-2 py-1.5 text-gray-400 hover:bg-gray-200 hover:text-emerald-600 transition"><FiArrowUp className="h-4 w-4" /></button>
              <span className="text-xs font-bold text-gray-700 px-2">{discussion.upvotes || 1}</span>
              <button className="px-2 py-1.5 text-gray-400 hover:bg-gray-200 hover:text-red-600 transition"><FiArrowDown className="h-4 w-4" /></button>
            </div>
            
            {/* Discord-style Reactions (Visual Dummy for now) */}
            <ReactionPill emoji="👍" count={3} active={true} />
            <ReactionPill emoji="👀" count={1} active={false} />
            <button className="p-1.5 text-gray-400 border border-transparent hover:border-gray-200 hover:bg-gray-50 rounded-lg transition"><FiSmile className="h-4 w-4"/></button>
          </div>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* 3. REPLIES SECTION */}
      <div className="bg-gray-50/30">
        <div className="px-6 py-4 text-sm font-bold text-gray-800 flex items-center gap-2">
          <FiMessageSquare className="text-gray-400" /> {discussion.replies?.length || 0} Replies
        </div>

        <div className="px-6 pb-6 space-y-0">
          {discussion.replies && discussion.replies.map((reply, idx) => {
            const isLast = idx === discussion.replies.length - 1;
            
            return (
              <div key={reply.id} className="flex gap-4 relative">
                
                {/* Thread Connector Line (Stops on the last reply) */}
                {!isLast && (
                  <div className="absolute left-[1.15rem] top-10 bottom-0 w-[2px] bg-gray-200 -z-10"></div>
                )}

                {/* Avatar */}
                <div className="flex flex-col items-center z-10 bg-white/0">
                  <Avatar name={reply.author} size="md" />
                </div>

                {/* Reply Content Box */}
                <div className={`flex-1 min-w-0 mb-6 ${reply.is_best ? 'bg-emerald-50/50 border border-emerald-200 p-4 rounded-xl shadow-sm' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-gray-900">{reply.author}</h4>
                    {reply.is_best && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">Best Answer</span>
                    )}
                    <span className="text-xs text-gray-500 text-right flex-1">{formatDate(reply.created_at || reply.time)}</span>
                  </div>
                  
                  <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {reply.content}
                  </div>

                  {/* Reply Attachments */}
                  {reply.attachments && reply.attachments.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                      {reply.attachments.map((img, i) => (
                        <img key={i} src={img.url} className="h-24 w-auto rounded-lg border border-gray-200 object-cover cursor-pointer hover:opacity-90" alt="reply attachment" />
                      ))}
                    </div>
                  )}

                  {/* Reply Actions */}
                  <div className="flex items-center gap-4 mt-2 text-xs font-semibold text-gray-500">
                    <button className="hover:text-indigo-600 flex items-center gap-1"><FiArrowUp /> {reply.upvotes || 0}</button>
                    <button className="hover:text-gray-900">Reply</button>
                    <button className="hover:text-gray-900">Share</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. REPLY COMPOSER BOX */}
      {!discussion.solved ? (
        <div className="p-6 bg-white border-t border-gray-200">
          <form onSubmit={handlePostReply} className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Avatar name="Current User" size="md" /> {/* You can pass currentUser.name here if you pass it via props */}
              <div className="flex-1 border border-gray-300 rounded-xl focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 bg-gray-50 focus-within:bg-white transition-all overflow-hidden">
                
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${discussion.author}... Use @ to tag someone`}
                  className="w-full bg-transparent p-3 text-sm outline-none resize-none min-h-[80px]"
                />
                
                {/* Composer Toolbar */}
                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-white">
                  <div className="flex items-center gap-1">
                    <button type="button" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition" title="Attach Image">
                      <FiImage className="h-4 w-4" />
                    </button>
                    <button type="button" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition" title="Attach File">
                      <FiPaperclip className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={isSubmitting || !replyText.trim()}
                    className="bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                  >
                    {isSubmitting ? 'Posting...' : 'Post Reply'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div className="p-4 bg-gray-100 border-t border-gray-200 text-center">
          <p className="text-sm font-medium text-gray-500 flex items-center justify-center gap-2">
            <FiCheckCircle /> This discussion has been marked as solved and is closed to new replies.
          </p>
        </div>
      )}

    </div>
  );
};

export default DiscussionThread;