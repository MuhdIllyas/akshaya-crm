import React, { useState, useRef, useEffect } from 'react';
import { 
  FiArrowLeft, FiMoreHorizontal, FiShare2, FiMessageSquare, 
  FiCheckCircle, FiImage, FiPaperclip, FiSmile, FiArrowUp, FiArrowDown, FiX 
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { MentionsInput, Mention } from 'react-mentions';
import { addReply, votePost, toggleReaction, uploadKnowledgeFiles, fetchStaffSuggestions } from '@/services/knowledge'; 

const API_URL = import.meta.env.VITE_API_URL || '';

const Avatar = ({ name, size = "md" }) => {
  const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500'];
  const colorIndex = name ? name.length % colors.length : 0;
  const sizeClasses = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };

  return (
    <div className={`${sizeClasses[size]} ${colors[colorIndex]} text-white rounded-full flex items-center justify-center font-bold flex-shrink-0 shadow-sm`}>
      {initials}
    </div>
  );
};

const ReactionPill = ({ emoji, count, active, onClick }) => {
  if (count <= 0) return null;
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
        active ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
      }`}
    >
      <span>{emoji}</span> <span>{count}</span>
    </button>
  );
};

const formatContent = (text) => {
  if (!text) return '';
  const parts = text.split(/(@\[.*?\]\(\d+\))/g);
  return parts.map((part, idx) => {
    const match = part.match(/@\[(.*?)\]\((\d+)\)/);
    if (match) {
      return <span key={idx} className="font-bold text-indigo-600 bg-indigo-50 px-1 rounded cursor-pointer hover:underline">@{match[1]}</span>;
    }
    return <span key={idx}>{part}</span>;
  });
};

const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
};

// --- MAIN COMPONENT ---
const DiscussionThread = ({ discussion, onBack, onUpdate }) => {
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);
  const composerRef = useRef(null); // Used to scroll down when clicking "Reply"

  const [showEmojiPicker, setShowEmojiPicker] = useState(null); 
  const AVAILABLE_EMOJIS = ['👍', '👀', '🎉', '🚀', '❤️', '💡'];

  const [localVotes, setLocalVotes] = useState({ discussion: 0, replies: {} });
  const [localReactions, setLocalReactions] = useState({});

  // 🔥 THE FIX: Sync local state with the Database payloads on Refresh
  useEffect(() => {
    if (discussion) {
      // 1. Sync Votes
      const replyVotes = {};
      discussion.replies?.forEach(r => { replyVotes[r.id] = r.upvotes || 0; });
      setLocalVotes({
        discussion: discussion.upvotes || 0,
        replies: replyVotes
      });

      // 2. Sync Reactions from the new Database Query
      const initReactions = {};
      const mapReactions = (reactionsArray) => {
        if (!reactionsArray) return {};
        const map = {};
        reactionsArray.forEach(r => {
          map[r.emoji] = { count: Number(r.count), active: r.active };
        });
        return map;
      };

      initReactions[`discussion-${discussion.id}`] = mapReactions(discussion.reactions);
      discussion.replies?.forEach(r => {
        initReactions[`reply-${r.id}`] = mapReactions(r.reactions);
      });

      setLocalReactions(initReactions);
    }
  }, [discussion]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateStr; }
  };

  const loadSuggestions = async (query, callback) => {
    try {
      const data = await fetchStaffSuggestions(query);
      callback(data);
    } catch (err) {
      console.error("Failed to load staff for mentions");
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map(file => ({
      file, previewUrl: URL.createObjectURL(file)
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleVote = async (targetType, targetId, voteValue) => {
    setLocalVotes(prev => {
      if (targetType === 'discussion') return { ...prev, discussion: prev.discussion + voteValue };
      return { ...prev, replies: { ...prev.replies, [targetId]: (prev.replies[targetId] || 0) + voteValue }};
    });
    try {
      await votePost(targetType, targetId, voteValue);
    } catch (err) {
      toast.error("Failed to register vote.");
      setLocalVotes(prev => {
        if (targetType === 'discussion') return { ...prev, discussion: prev.discussion - voteValue };
        return { ...prev, replies: { ...prev.replies, [targetId]: (prev.replies[targetId] || 0) - voteValue }};
      });
    }
  };

  const handleReact = async (targetType, targetId, emoji) => {
    setShowEmojiPicker(null);
    const key = `${targetType}-${targetId}`;
    
    setLocalReactions(prev => {
      const current = prev[key] || {};
      const count = current[emoji]?.count || 0;
      const isActive = current[emoji]?.active || false;
      return {
        ...prev,
        [key]: {
          ...current,
          [emoji]: {
            count: isActive ? count - 1 : count + 1,
            active: !isActive
          }
        }
      };
    });

    try {
      await toggleReaction(targetType, targetId, emoji);
    } catch (err) {
      toast.error("Failed to add reaction.");
    }
  };

  // 🔥 THE FIX: Wires up the "Reply" button inside nested comments
  const handleReplyToUser = (authorName, authorId) => {
    const mentionString = `@[${authorName}](${authorId}) `;
    
    // Add the mention to the text box
    setReplyText(prev => prev ? `${prev}\n${mentionString}` : mentionString);
    
    // Smooth scroll down to the composer
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handlePostReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() && attachments.length === 0) return;

    try {
      setIsSubmitting(true);
      let finalAttachmentUrls = [];

      if (attachments.length > 0) {
        const filesToUpload = attachments.map(a => a.file);
        finalAttachmentUrls = await uploadKnowledgeFiles(filesToUpload);
      }

      await addReply(discussion.id, replyText, finalAttachmentUrls); 
      
      setReplyText('');
      setAttachments([]); 
      toast.success("Reply posted!");
      if (onUpdate) onUpdate(); 
      
    } catch (err) {
      console.error(err);
      toast.error("Failed to post reply.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!discussion) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      
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

      <div className="p-6 flex gap-4">
        <div className="flex flex-col items-center">
          <Avatar name={discussion.author} size="lg" />
          <div className="w-0.5 h-full bg-gray-100 my-2 rounded-full"></div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="text-sm font-bold text-gray-900">{discussion.author}</h3>
            <span className="text-xs text-gray-500">· {formatDate(discussion.created_at || discussion.time)}</span>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2 leading-snug">{discussion.title}</h1>
          
          {discussion.tags && discussion.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {discussion.tags.map(tag => (
                <span key={tag} className="bg-indigo-50 text-indigo-600 text-[11px] font-semibold px-2 py-0.5 rounded-md">#{tag}</span>
              ))}
            </div>
          )}

          <div className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">
            {formatContent(discussion.description || discussion.content)}
          </div>

          {discussion.attachments && discussion.attachments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {discussion.attachments.map((img, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden border border-gray-200 group bg-gray-100 aspect-video">
                  <img src={getImageUrl(img.url)} alt="attachment" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="bg-white/90 text-gray-900 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm" onClick={() => window.open(getImageUrl(img.url), '_blank')}>
                      View Full Image
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center flex-wrap gap-3 mt-5 relative">
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => handleVote('discussion', discussion.id, 1)} className="px-2 py-1.5 text-gray-400 hover:bg-gray-200 hover:text-emerald-600 transition"><FiArrowUp className="h-4 w-4" /></button>
              <span className="text-xs font-bold text-gray-700 px-2">{localVotes.discussion}</span>
              <button onClick={() => handleVote('discussion', discussion.id, -1)} className="px-2 py-1.5 text-gray-400 hover:bg-gray-200 hover:text-red-600 transition"><FiArrowDown className="h-4 w-4" /></button>
            </div>
            
            {localReactions[`discussion-${discussion.id}`] && Object.entries(localReactions[`discussion-${discussion.id}`]).map(([em, data]) => (
               <ReactionPill key={em} emoji={em} count={data.count} active={data.active} onClick={() => handleReact('discussion', discussion.id, em)} />
            ))}
            
            <div className="relative">
              <button onClick={() => setShowEmojiPicker(showEmojiPicker === discussion.id ? null : discussion.id)} className="p-1.5 text-gray-400 border border-transparent hover:border-gray-200 hover:bg-gray-50 rounded-lg transition">
                <FiSmile className="h-4 w-4"/>
              </button>
              {showEmojiPicker === discussion.id && (
                <div className="absolute left-0 bottom-full mb-2 bg-white border border-gray-200 shadow-xl rounded-xl p-2 flex gap-1 z-50">
                  {AVAILABLE_EMOJIS.map(em => (
                    <button key={em} onClick={() => handleReact('discussion', discussion.id, em)} className="hover:bg-gray-100 p-1.5 rounded text-lg transition">{em}</button>
                  ))}
                </div>
              )}
            </div>
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
            const replyVotes = localVotes.replies[reply.id] || 0;
            const replyReactions = localReactions[`reply-${reply.id}`] || {};
            
            return (
              <div key={reply.id} className="flex gap-4 relative">
                {!isLast && <div className="absolute left-[1.15rem] top-10 bottom-0 w-[2px] bg-gray-200 -z-10"></div>}
                
                <div className="flex flex-col items-center z-10 bg-white/0">
                  <Avatar name={reply.author} size="md" />
                </div>

                <div className={`flex-1 min-w-0 mb-6 ${reply.is_best ? 'bg-emerald-50/50 border border-emerald-200 p-4 rounded-xl shadow-sm' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-gray-900">{reply.author}</h4>
                    {reply.is_best && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">Best Answer</span>}
                    <span className="text-xs text-gray-500 text-right flex-1">{formatDate(reply.created_at || reply.time)}</span>
                  </div>
                  
                  <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {formatContent(reply.content)}
                  </div>

                  {reply.attachments && reply.attachments.length > 0 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                      {reply.attachments.map((img, i) => (
                        <img key={i} src={getImageUrl(img.url)} onClick={() => window.open(getImageUrl(img.url), '_blank')} className="h-24 w-auto rounded-lg border border-gray-200 object-cover cursor-pointer hover:opacity-90" alt="reply attachment" />
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-2 text-xs font-semibold text-gray-500">
                    <button onClick={() => handleVote('reply', reply.id, 1)} className="hover:text-indigo-600 flex items-center gap-1">
                      <FiArrowUp /> {replyVotes}
                    </button>
                    
                    {/* 🔥 THE FIX: Clicking Reply now tags the user and scrolls down */}
                    <button 
                      onClick={() => handleReplyToUser(reply.author, reply.author_id)} 
                      className="hover:text-gray-900"
                    >
                      Reply
                    </button>
                    
                    <div className="relative flex items-center gap-2">
                      {Object.entries(replyReactions).map(([em, data]) => (
                         <ReactionPill key={em} emoji={em} count={data.count} active={data.active} onClick={() => handleReact('reply', reply.id, em)} />
                      ))}
                      <button onClick={() => setShowEmojiPicker(showEmojiPicker === `reply-${reply.id}` ? null : `reply-${reply.id}`)} className="hover:text-gray-900">React</button>
                      
                      {showEmojiPicker === `reply-${reply.id}` && (
                        <div className="absolute left-0 bottom-full mb-2 bg-white border border-gray-200 shadow-xl rounded-xl p-2 flex gap-1 z-50">
                          {AVAILABLE_EMOJIS.map(em => (
                            <button key={em} onClick={() => handleReact('reply', reply.id, em)} className="hover:bg-gray-100 p-1.5 rounded text-lg transition">{em}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. REPLY COMPOSER BOX */}
      {!discussion.solved ? (
        <div ref={composerRef} className="p-6 bg-white border-t border-gray-200">
          <form onSubmit={handlePostReply} className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Avatar name="Current User" size="md" /> 
              <div className="flex-1 border border-gray-300 rounded-xl focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 bg-gray-50 focus-within:bg-white transition-all overflow-hidden flex flex-col">
                
                <MentionsInput
                  value={replyText}
                  onChange={(e, val) => setReplyText(val)}
                  placeholder={`Reply to ${discussion.author}... Use @ to tag someone`}
                  className="w-full"
                  style={{
                    control: { fontSize: '14px', lineHeight: '1.5', minHeight: '80px' },
                    input: { padding: '12px', border: 'none', outline: 'none', margin: 0, boxSizing: 'border-box' },
                    highlighter: { padding: '12px', margin: 0, boxSizing: 'border-box' },
                    suggestions: { 
                      list: { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', zIndex: 100, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }, 
                      item: { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '14px' } 
                    }
                  }}
                >
                  <Mention 
                    trigger="@" 
                    data={loadSuggestions} 
                    markup="@[__display__](__id__)" 
                    displayTransform={(id, display) => `@${display}`} 
                    style={{ backgroundColor: '#e0e7ff', color: '#4338ca', borderRadius: '4px', zIndex: 1 }}
                  />
                </MentionsInput>

                {attachments.length > 0 && (
                  <div className="px-3 pb-3 flex gap-2 overflow-x-auto">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="relative h-16 w-16 rounded-lg border border-gray-200 flex-shrink-0 group">
                        <img src={att.previewUrl} alt="preview" className="h-full w-full object-cover rounded-lg" />
                        <button type="button" onClick={() => removeAttachment(idx)} className="absolute -top-2 -right-2 bg-white border border-gray-200 text-gray-500 hover:text-red-500 rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition">
                          <FiX className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-white">
                  <div className="flex items-center gap-1 relative">
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      ref={fileInputRef} 
                      onChange={handleFileSelect} 
                      className="hidden" 
                    />
                    
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition" title="Attach Image">
                      <FiImage className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={isSubmitting || (!replyText.trim() && attachments.length === 0)}
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