import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSend,
  FiPaperclip,
  FiMoreVertical,
  FiChevronLeft,
  FiPlus,
  FiMic,
  FiVideo as FiVideoCall,
  FiPhoneCall,
  FiUserPlus,
  FiStar,
  FiInfo,
  FiTrash2,
  FiFile,
  FiImage,
  FiDownload,
  FiX,
  FiClock,
  FiList,
  FiMessageSquare, FiCheckSquare,
  FiUser, FiBriefcase, FiUsers,
  FiSmartphone, FiMapPin, FiChevronRight, FiSearch
} from "react-icons/fi";
import { FaRegSmile } from "react-icons/fa";
import { IoMdCheckmarkCircle, IoMdCheckmarkCircleOutline } from "react-icons/io";
import { BsCircleFill } from "react-icons/bs";
import { toast } from "react-toastify";
import EmojiPicker from 'emoji-picker-react';
import { socket } from "@/services/socket";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  throw new Error("VITE_API_URL is not defined");
}

const getAvatarUrl = (photoPath) => {
  if (!photoPath) return null;
  if (photoPath.startsWith('http')) return photoPath;
  const safeBase = API_BASE_URL.replace(/\/$/, '');
  const safePath = photoPath.startsWith('/') ? photoPath : `/${photoPath}`;
  return `${safeBase}${safePath}`;
};

// Helper: check if last customer message is within 24 hours
const isWithin24Hours = (lastMessageTime) => {
  if (!lastMessageTime) return false;
  const now = new Date();
  const last = new Date(lastMessageTime);
  const diffHours = (now - last) / (1000 * 60 * 60);
  return diffHours <= 24;
};

// Helper to format date for task due dates
const formatDate = (dateString) => {
  if (!dateString) return 'No due date';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Invalid date';
  }
};

// Helper to format date separator
const formatDateSeparator = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// TaskMessage component (interactive task card)
const TaskMessage = ({ taskId, text, taskData, onStatusUpdate }) => {
  const [completing, setCompleting] = useState(false);
  const completed = taskData?.status === 'completed';

  const handleComplete = async () => {
    if (completing || completed) return;
    setCompleting(true);
    try {
      if (onStatusUpdate) {
        await onStatusUpdate(taskId, 'completed');
      }
    } catch (err) {
      // Error toast is handled by parent
    } finally {
      setCompleting(false);
    }
  };

  const match = text.match(/📋 Task created: "(.*?)" assigned to (.*?)\. Due: (.*?)(\.|$)/);
  const title = match ? match[1] : text.replace(/^📋 Task created: /, '').replace(/\.$/, '');
  const assignee = match ? match[2] : '';
  const dueDate = match ? match[3] : '';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm max-w-md">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h4 className={`font-semibold text-sm ${completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {title}
          </h4>
          {assignee && <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><FiUser size={12}/> {assignee}</p>}
          {dueDate && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><FiClock size={12}/> {dueDate}</p>}
        </div>
        {!completed && (
          <button
            onClick={handleComplete}
            disabled={completing}
            className="px-3 py-1.5 text-xs whitespace-nowrap bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50 font-medium"
          >
            {completing ? '...' : '✓ Complete'}
          </button>
        )}
        {completed && (
          <span className="text-xs text-emerald-600 font-medium whitespace-nowrap mt-1 flex items-center gap-1">
            <IoMdCheckmarkCircle /> Completed
          </span>
        )}
      </div>
    </div>
  );
};

// Normal task message
const NormalTaskMessage = ({ taskId, taskData, onStatusUpdate }) => {
  const [completing, setCompleting] = useState(false);
  const completed = taskData?.status === 'completed';

  const handleComplete = async () => {
    if (completing || completed) return;
    setCompleting(true);
    try {
      if (onStatusUpdate) {
        await onStatusUpdate(taskId, taskData.status);
      }
    } catch {
      // parent handles the error toast
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm max-w-md">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h4 className={`font-semibold text-sm ${
            completed ? 'line-through text-slate-400' : 'text-slate-800'
          }`}>
            {taskData.title}
          </h4>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
              taskData.priority === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
              taskData.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {taskData.priority}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
              completed ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}>
              {taskData.status}
            </span>
          </div>
          {taskData.due_date && (
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <FiClock size={12}/> {formatDate(taskData.due_date)}
            </p>
          )}
        </div>
        {!completed && (
          <button
            onClick={handleComplete}
            disabled={completing}
            className="px-3 py-1.5 text-xs whitespace-nowrap bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50 font-medium"
          >
            {completing ? '...' : '✓ Complete'}
          </button>
        )}
        {completed && (
          <span className="text-xs text-emerald-600 font-medium whitespace-nowrap mt-1 flex items-center gap-1">
            <IoMdCheckmarkCircle /> Completed
          </span>
        )}
      </div>
    </div>
  );
};

// ---------- Flat Tracking Mention Card ----------
const TrackingMentionCard = ({ entityId, displayText }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    axios.get(`${API_BASE_URL}/api/chat/mentions/tracking/${entityId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => { if (isMounted) setData(res.data); })
    .catch(err => console.error(err))
    .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [entityId]);

  if (loading) return <span className="text-indigo-400 font-medium animate-pulse">{displayText}</span>;
  if (!data) return <span className="text-rose-400 font-medium line-through" title="Tracking not found">{displayText}</span>;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        window.open(`/dashboard/staff/track_service/${data.tracking_id || entityId}`, '_blank');
      }}
      className="my-3 block w-72 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-400 transition-colors cursor-pointer text-left overflow-hidden select-none"
    >
      {/* Header section */}
      <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 flex justify-between items-center">
        <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-xs">
          <FiFile size={12} />
          <span>App #{data.application_number || data.tracking_id || entityId}</span>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
          data.priority === 'High' ? 'bg-rose-50 text-rose-600 border-rose-200' :
          data.priority === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-200' :
          'bg-emerald-50 text-emerald-600 border-emerald-200'
        }`}>
          {data.priority || 'Normal'}
        </span>
      </div>

      {/* Body section */}
      <div className="p-3 space-y-2.5">
        <div className="flex items-start gap-2">
          <FiBriefcase className="text-slate-400 mt-0.5 shrink-0" size={14} />
          <p className="font-bold text-slate-900 text-sm leading-tight">
            {data.service_name || 'Unknown Service'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <FiUser className="text-slate-400 shrink-0" size={14} />
          <p className="font-medium text-slate-700 text-sm truncate">
            {data.customer_name || 'No Customer Attached'}
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 space-y-1.5 mt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Status</span>
            <span className="font-bold text-slate-800 capitalize">{data.status || 'Pending'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Step</span>
            <span className="font-bold text-indigo-700 truncate max-w-[120px]" title={data.current_step}>
              {data.current_step || 'Initial Phase'}
            </span>
          </div>
          {data.estimated_delivery && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Delivery</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <FiClock size={10} /> {data.estimated_delivery}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer section */}
      <div className="bg-slate-50 border-t border-slate-100 px-3 py-2 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Assigned To</span>
          <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">
            {data.assigned_to || 'Unassigned'}
          </span>
        </div>
        <div className="text-xs font-bold text-indigo-700 flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 transition-colors">
          Open <FiChevronRight size={12} />
        </div>
      </div>
    </div>
  );
};
// -------------------------------------------------

const Chat = ({
  activeConversation,
  messages,
  currentUser,
  loadingChat,
  typingUsers,
  onSendMessage,
  onDeleteMessage,
  onOpenTaskModal,
  onOpenNewChatModal,
  onBack,
  onlineUsers = new Set(),
  serviceInfo = null,
  serviceEntryId = null,
  allTasks = [],
  onTaskStatusUpdate = null,
  onNormalTaskStatusUpdate = null,
  onDeleteConversation = null
}) => {
  const [newMessage, setNewMessage] = useState("");
  const [fileToUpload, setFileToUpload] = useState(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [messageReadBy, setMessageReadBy] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  // WhatsApp 24h window state
  const [lastCustomerMessageTime, setLastCustomerMessageTime] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("reengagement_message");
  const [templateParams, setTemplateParams] = useState("");
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // ---------- Mention states ----------
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionResults, setMentionResults] = useState([]);
  const [pendingStaffMentions, setPendingStaffMentions] = useState([]);
  // -----------------------------------------

  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);

  const chatInputRef = useRef(null);

  const currentMessages = messages[activeConversation?.id] || [];

  // Compute if 24h window is open
  const isWithinWindow = isWithin24Hours(lastCustomerMessageTime);

  // Update last customer message time whenever messages change
  useEffect(() => {
    if (!activeConversation || activeConversation.channel !== 'whatsapp') return;
    const customerMessages = currentMessages.filter(m => m.sender_type === 'customer' && !m.isOptimistic);
    if (customerMessages.length > 0) {
      const lastMsg = customerMessages[customerMessages.length - 1];
      const ts = lastMsg.createdAt || lastMsg.created_at;
      if (ts) setLastCustomerMessageTime(new Date(ts));
    } else {
      setLastCustomerMessageTime(null);
    }
  }, [currentMessages, activeConversation]);

  // Get display name for the conversation (handles WhatsApp)
  const getConversationDisplayName = useCallback(() => {
    if (!activeConversation) return '';
    if (activeConversation.channel === 'whatsapp') {
      return activeConversation.context_name || activeConversation.context_identifier || 'WhatsApp User';
    }
    let displayName = activeConversation.name;
    if (!displayName && !activeConversation.is_group && activeConversation.participants) {
      const otherParticipants = activeConversation.participants.filter(p => p.staff_id !== currentUser.id);
      if (otherParticipants.length > 0) {
        displayName = otherParticipants.map(p => p.name).join(', ');
      }
    }
    return displayName || 'Unknown Chat';
  }, [activeConversation, currentUser.id]);

  // Auto-fill the customer's name when the Template Modal opens!
  useEffect(() => {
    if (showTemplateModal && activeConversation) {
      let defaultName = getConversationDisplayName();
      defaultName = defaultName.replace(/WhatsApp /i, '').replace(/Chat with /i, '').trim();
      if (/^\+?\d+$/.test(defaultName.replace(/[\s-]/g, ''))) {
        defaultName = ''; 
      }
      setTemplateParams(defaultName);
      setSelectedTemplate("reengagement_message");
    }
  }, [showTemplateModal, activeConversation, getConversationDisplayName]);

  const isUserOnline = useCallback((userId) => {
    return onlineUsers.has(String(userId));
  }, [onlineUsers]);

  const shouldShowOnlineIndicator = useCallback(() => {
    return activeConversation?.channel !== 'whatsapp' && !activeConversation?.is_group;
  }, [activeConversation]);

  // Join conversation room when active
  useEffect(() => {
    if (!socket?.connected || !activeConversation?.id) return;
    
    console.log("Joining conversation:", activeConversation.id);
    socket.emit("join_conversation", activeConversation.id);
    
    return () => {
      console.log("Leaving conversation:", activeConversation.id);
      socket.emit("leave_conversation", activeConversation.id);
    };
  }, [activeConversation?.id]);

  // Listen for socket events
  useEffect(() => {
    if (!socket.connected || !activeConversation?.id) return;
    const handleTyping = (data) => {
      if (data.conversationId !== activeConversation?.id || data.userId === currentUser.id) return;
    };
    const handleMessagesRead = (data) => {
      if (data.conversationId !== activeConversation?.id) return;
      setMessageReadBy(prev => ({
        ...prev,
        ...data.messageIds.reduce((acc, id) => ({ ...acc, [id]: [...(prev[id] || []), data.readerId] }), {})
      }));
    };
    socket.on("typing", handleTyping);
    socket.on("messages_read", handleMessagesRead);
    return () => {
      socket.off("typing", handleTyping);
      socket.off("messages_read", handleMessagesRead);
    };
  }, [activeConversation?.id, currentUser.id]);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [currentMessages, activeConversation?.id]);

  // Mark messages as read
  useEffect(() => {
    if (!activeConversation || !currentMessages.length || !socket.connected) return;
    const unreadMessages = currentMessages
      .filter(msg => !msg.isCurrentUser && !msg.is_read_by_me && !msg.isOptimistic)
      .map(msg => msg.id);
    if (unreadMessages.length > 0) {
      const timeoutId = setTimeout(() => {
        socket.emit("mark_read", {
          messageIds: unreadMessages,
          conversationId: activeConversation.id
        });
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [currentMessages, activeConversation?.id, activeConversation]);

  // Typing indicator
  const emitTyping = useCallback((typing) => {
    if (!activeConversation?.id) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2000) {
      if (socket.connected) {
        socket.emit("typing", {
          conversationId: activeConversation.id,
          userId: currentUser.id,
          userName: currentUser.name,
          isTyping: typing
        });
      }
      fetch(`${API_BASE_URL}/api/chat/typing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          conversation_id: activeConversation.id,
          isTyping: typing
        })
      }).catch(err => console.error("Typing API error:", err));
      lastTypingEmitRef.current = now;
    }
  }, [activeConversation?.id, currentUser.id, currentUser.name, API_BASE_URL]);

  // ---------- handleInputChange ----------
  const handleInputChange = async (e) => {
    const val = e.target.value;
    setNewMessage(val);
    
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z]+)$/);
    
    if (match) {
      setMentionQuery(match[1]);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/chat/mentions/search-staff?q=${match[1]}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setMentionResults(res.data);
      } catch (err) { console.error("Staff fetch error", err); }
    } else {
      setMentionQuery(null);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (val.length > 0) {
      if (!isTyping) {
        setIsTyping(true);
        emitTyping(true);
      }
      typingTimeoutRef.current = setTimeout(() => {
        if (isTyping) {
          setIsTyping(false);
          emitTyping(false);
        }
      }, 3000);
    } else {
      if (isTyping) {
        setIsTyping(false);
        emitTyping(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (isTyping && activeConversation?.id) emitTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [activeConversation?.id, isTyping, emitTyping]);

  // ---------- handleSelectMention ----------
  const handleSelectMention = (staff) => {
    const inputEl = chatInputRef.current; 
    if (!inputEl) return; 
    const cursor = inputEl.selectionStart;
    const textBefore = newMessage.slice(0, cursor).replace(/(?:^|\s)@([a-zA-Z]+)$/, ` @${staff.name} `);
    const textAfter = newMessage.slice(cursor);
    
    setNewMessage(textBefore + textAfter);
    setMentionQuery(null);
    setPendingStaffMentions(prev => [...prev, { entityId: staff.id, name: staff.name }]);
    inputEl.focus();
  };

  // 🔥 Convert Message to Note (React-Mentions Compatible)
  const handleConvertToNote = async (msg) => {
    try {
      const staffMentions = [];
      let finalContent = msg.text;

      if (msg.mentions && msg.mentions.length > 0) {
        const sortedMentions = [...msg.mentions].sort((a, b) => b.start_index - a.start_index);
        sortedMentions.forEach(m => {
          if (m.mention_type === 'staff') {
            staffMentions.push(m.entity_id);
            const cleanName = m.display_text.replace('@', '').trim();
            const formattedMention = `@[${cleanName}](${m.entity_id})`;
            finalContent = finalContent.substring(0, m.start_index) + formattedMention + finalContent.substring(m.end_index);
          }
        });
      }

      const uniqueMentions = [...new Set(staffMentions)];
      const calculatedVisibility = uniqueMentions.length > 0 ? "mention" : "private";

      const payload = {
        title: `Note from chat: ${msg.sender || 'Unknown'}`,
        content: finalContent,
        visibility: calculatedVisibility,
        mentions: uniqueMentions,
        related_conversation_id: activeConversation.id,
        origin_message_id: msg.id,
        related_service_entry_id: activeConversation.context_type === 'service_entry' ? activeConversation.context_id : null
      };

      await axios.post(`${API_BASE_URL}/api/notes`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      toast.success(uniqueMentions.length > 0 
        ? "Note saved and staff notified ⭐" 
        : "Private note saved ⭐"
      );
      
    } catch (error) {
      console.error("Convert to note error:", error);
      toast.error("Failed to convert message to note");
    }
  };

  const handleSendMessage = () => {
    if ((!newMessage.trim() && !fileToUpload) || !activeConversation) return;

    const mentions = [];
    const trackingRegex = /(?:^|\s)@(\d+)/g;
    let match;

    while ((match = trackingRegex.exec(newMessage)) !== null) {
      const matchText = match[0].trim();
      const startIndex = match.index + (match[0].startsWith(' ') ? 1 : 0);
      mentions.push({
        mention_type: 'tracking',
        entity_id: parseInt(match[1], 10),
        display_text: matchText,
        start_index: startIndex,
        end_index: startIndex + matchText.length
      });
    }

    pendingStaffMentions.forEach(m => {
      const regex = new RegExp(`(?:^|\\s)@${m.name}(?=\\s|$)`, 'g');
      while ((match = regex.exec(newMessage)) !== null) {
        const matchText = match[0].trim();
        const startIndex = match.index + (match[0].startsWith(' ') ? 1 : 0);
        mentions.push({
          mention_type: 'staff',
          entity_id: m.entityId,
          display_text: matchText,
          start_index: startIndex,
          end_index: startIndex + matchText.length
        });
      }
    });

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage = {
      id: tempId,
      tempId: tempId,
      sender: 'You',
      senderId: currentUser.id,
      text: newMessage || (fileToUpload ? (fileToUpload.type?.startsWith('image/') ? '📷 Image' : '📎 File') : ''),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isFile: !!fileToUpload,
      fileName: fileToUpload?.name,
      fileUrl: null,
      fileSize: fileToUpload?.size,
      messageType: fileToUpload ? (fileToUpload.type?.startsWith('image/') ? 'image' : 'file') : 'text',
      isCurrentUser: true,
      is_read_by_me: true,
      isOptimistic: true,
      mentions: mentions
    };
    onSendMessage(newMessage, fileToUpload, optimisticMessage);
    setNewMessage("");
    setFileToUpload(null);
    setPendingStaffMentions([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setFileToUpload(file);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessage(prev => prev + emoji.emoji);
    setIsEmojiPickerOpen(false);
    if (!isTyping) {
      setIsTyping(true);
      emitTyping(true);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setIsEmojiPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getReadReceipts = (messageId) => {
    const readers = messageReadBy[messageId] || [];
    if (!activeConversation?.participants) return [];
    return activeConversation.participants
      .filter(p => readers.includes(p.staff_id))
      .map(p => p.name);
  };

  const renderMessageStatus = (msg) => {
    if (!msg.isCurrentUser) return null;
    if (msg.isOptimistic) return <FiClock className="text-slate-400 ml-1" size={12} title="Sending..." />;
    const readers = getReadReceipts(msg.id);
    const otherParticipants = activeConversation?.participants?.filter(p => p.staff_id !== currentUser.id) || [];
    if (readers.length === otherParticipants.length && otherParticipants.length > 0) {
      return <IoMdCheckmarkCircle className="text-indigo-500 ml-1" size={14} title="Read by everyone" />;
    } else if (readers.length > 0) {
      return <IoMdCheckmarkCircle className="text-indigo-400 ml-1" size={14} title={`Read by ${readers.length} of ${otherParticipants.length}`} />;
    } else {
      return <IoMdCheckmarkCircleOutline className="text-slate-400 ml-1" size={14} title="Sent" />;
    }
  };

  // ---------- renderMessageTextWithMentions ----------
  const renderMessageTextWithMentions = (text, mentions = []) => {
    if (!mentions || mentions.length === 0) {
      return <p className="text-sm whitespace-pre-wrap break-words">{text}</p>;
    }
    
    const sorted = [...mentions].sort((a, b) => a.start_index - b.start_index);
    const parts = [];
    let lastIndex = 0;
    
    sorted.forEach((m, idx) => {
      if (m.start_index > lastIndex) {
        parts.push(text.slice(lastIndex, m.start_index));
      }
      
      if (m.mention_type === 'tracking') {
        parts.push(<TrackingMentionCard key={`mnt-${idx}`} entityId={m.entity_id} displayText={m.display_text} />);
      } 
      else if (m.mention_type === 'staff') {
        parts.push(
          <span 
            key={`mnt-${idx}`} 
            className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100 shadow-sm mx-0.5 cursor-pointer hover:bg-indigo-100 transition-colors"
          >
            {m.display_text}
          </span>
        );
      }
      
      lastIndex = m.end_index;
    });
    
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{parts}</div>;
  };

  // Manual template send handler
  const handleSendTemplate = async () => {
    if (!activeConversation?.id) return;
    setSendingTemplate(true);
    try {
      const paramsArray = templateParams.split(",").map(p => p.trim()).filter(p => p);
      await axios.post(
        `${API_BASE_URL}/api/whatsapp/send-template`,
        {
          conversationId: activeConversation.id,
          templateName: selectedTemplate,
          params: paramsArray
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        }
      );
      toast.success("Template sent successfully");
      setShowTemplateModal(false);
      setTemplateParams("");
    } catch (err) {
      console.error("Template send error:", err);
      toast.error(err.response?.data?.error || "Failed to send template");
    } finally {
      setSendingTemplate(false);
    }
  };

  if (!activeConversation) {
    return (
      <div className="flex flex-col items-center justify-center bg-slate-50 p-4 text-center h-full overflow-y-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-indigo-600 w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20"
        >
          <FiSend className="text-white text-3xl" />
        </motion.div>
        <motion.h3
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-slate-800 mb-2"
        >
          Welcome to Chat
        </motion.h3>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-slate-500 max-w-md mb-8"
        >
          Select a conversation or start a new chat to begin messaging
        </motion.p>
        <div className="flex gap-4">
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={onOpenNewChatModal}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl flex items-center gap-2 hover:bg-slate-800 transition shadow-sm font-medium"
          >
            <FiPlus /> New Conversation
          </motion.button>
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            onClick={onOpenTaskModal}
            className="px-6 py-3 bg-white text-slate-800 border border-slate-200 rounded-xl flex items-center gap-2 hover:bg-slate-50 transition shadow-sm font-medium"
          >
            <FiPlus /> Create Task
          </motion.button>
        </div>
      </div>
    );
  }

  const displayName = getConversationDisplayName();
  const avatarChar = displayName ? displayName.charAt(0).toUpperCase() : '?';
  const onlineParticipants = activeConversation.participants?.filter(
    p => p.staff_id !== currentUser.id && isUserOnline(p.staff_id)
  ) || [];
  const hasTasks = serviceInfo && serviceInfo.tasks && serviceInfo.tasks.length > 0;
  const isWhatsApp = activeConversation.channel === 'whatsapp';
  const showOnlineStatus = shouldShowOnlineIndicator();
  const singleOtherParticipant = !activeConversation.is_group && !isWhatsApp && activeConversation.participants?.find(p => p.staff_id !== currentUser.id);
  const isParticipantOnline = singleOtherParticipant ? isUserOnline(singleOtherParticipant.staff_id) : false;

  const otherParticipants = activeConversation.participants ? activeConversation.participants.filter(p => String(p.staff_id) !== String(currentUser.id)) : [];
  const isFunctionallyGroup = activeConversation.is_group || otherParticipants.length > 1;

  let avatarPhoto = null;
  if (!isFunctionallyGroup && otherParticipants.length === 1) {
      if (otherParticipants[0]?.photo) {
          avatarPhoto = getAvatarUrl(otherParticipants[0].photo);
      }
  }

  // Group messages by date for separators
  let lastMessageDate = null;

  return (
    <div className="flex flex-col w-full bg-white h-full min-h-0">
      {/* Fixed Header */}
      <div className="flex-none h-[72px] w-full px-5 flex items-center border-b border-slate-200 bg-white">
        <button className="md:hidden mr-3 text-slate-400 hover:text-slate-600" onClick={onBack}>
          <FiChevronLeft size={24} />
        </button>
        <div className="relative mr-3 flex-shrink-0">
          {avatarPhoto ? (
            <img 
              src={avatarPhoto} 
              alt={displayName} 
              className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-sm ${activeConversation.avatarColor || 'bg-slate-800'} ${avatarPhoto ? 'hidden' : ''}`}>
            {isFunctionallyGroup ? <FiUsers size={20} /> : avatarChar}
          </div>

          {/* Online Dot */}
          {showOnlineStatus && singleOtherParticipant && !isFunctionallyGroup && (
            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isParticipantOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-slate-800 truncate text-[15px]">{displayName}</h2>
            {isWhatsApp && (
              <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold border border-emerald-100">
                <FiSmartphone size={10} /> WhatsApp
              </span>
            )}
            {serviceInfo && (
              <span className="bg-purple-50 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-purple-100">
                Service
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            {typingUsers[activeConversation.id]?.length > 0 ? (
              <p className="text-xs text-indigo-600 italic font-medium">
                {typingUsers[activeConversation.id].map(u => u.name).join(', ')} typing...
              </p>
            ) : activeConversation.is_group ? (
              <p className="text-xs text-slate-500">
                {activeConversation.participants?.length || 0} members
                {onlineParticipants.length > 0 && (
                  <span className="ml-2 text-emerald-600">({onlineParticipants.length} online)</span>
                )}
              </p>
            ) : isWhatsApp ? (
              <p className="text-xs text-slate-500">
                WhatsApp conversation
              </p>
            ) : (
              <div className="flex items-center">
                <BsCircleFill className={`text-[10px] mr-1.5 ${isParticipantOnline ? 'text-emerald-500' : 'text-slate-300'}`} />
                <span className="text-xs text-slate-500 font-medium">
                  {isParticipantOnline ? 'Online' : 'Offline'}
                </span>
                {!isFunctionallyGroup && otherParticipants[0]?.centre_name && (
                  <>
                    <span className="text-slate-300 mx-2">•</span>
                    <span className="text-xs text-slate-500 truncate flex items-center gap-1">
                      <FiMapPin size={10}/> {otherParticipants[0].centre_name}
                    </span>
                  </>
                )}
              </div>
            )}
            {serviceInfo && serviceInfo.applicationNumber && (
              <span className="text-xs text-slate-400 ml-2">
                App #{serviceInfo.applicationNumber}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex gap-1 relative">
          <button className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition">
            <FiSearch size={18} />
          </button>
          <button className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition">
            <FiVideoCall size={18} />
          </button>
          <button className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition">
            <FiPhoneCall size={18} />
          </button>
          <button
            onClick={onOpenTaskModal}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
            title="Create New Task"
          >
            <FiPlus size={18} />
          </button>
          {hasTasks && (
            <button
              onClick={() => setShowTasksModal(true)}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
              title="View Tasks"
            >
              <FiList size={18} />
            </button>
          )}
          {isWhatsApp && !isWithinWindow && (
            <button
              onClick={() => setShowTemplateModal(true)}
              className="p-2 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
              title="Send Template"
            >
              <FiMessageSquare size={18} />
            </button>
          )}
          <button
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition relative"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
          >
            <FiMoreVertical size={18} />
          </button>
          <AnimatePresence>
            {isMoreMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden"
              >
                <button className="flex items-center w-full p-3 text-sm text-slate-700 hover:bg-slate-50 transition">
                  <FiUserPlus className="mr-3 text-slate-400" size={16} /> Add People
                </button>
                <button className="flex items-center w-full p-3 text-sm text-slate-700 hover:bg-slate-50 transition">
                  <FiStar className="mr-3 text-slate-400" size={16} /> Mark as Favorite
                </button>
                <button className="flex items-center w-full p-3 text-sm text-slate-700 hover:bg-slate-50 transition">
                  <FiInfo className="mr-3 text-slate-400" size={16} /> View Details
                </button>
                <div className="h-px bg-slate-100 my-1"></div>
                <button 
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    if (onDeleteConversation) onDeleteConversation(activeConversation.id);
                  }}
                  className="flex items-center w-full p-3 text-sm text-rose-600 hover:bg-rose-50 transition"
                >
                  <FiTrash2 className="mr-3" size={16} /> Delete Conversation
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Scrollable Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto bg-slate-50/50 custom-scrollbar"
      >
        <div className="px-5 py-6 space-y-4">
          {loadingChat ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <>
              {currentMessages.map((msg, index) => {
                const messageKey = msg.isOptimistic
                  ? `opt-${msg.tempId || msg.id}-${index}`
                  : `msg-${msg.id}`;
                const isTaskMessage = msg.isSystem && msg.fileName && !isNaN(Number(msg.fileName)) && serviceEntryId;
                const isNewTaskMessage = msg.messageType === "task";

                // Date separator logic
                const msgDate = msg.createdAt || msg.created_at || new Date();
                const dateStr = new Date(msgDate).toDateString();
                let showDateSeparator = false;
                if (dateStr !== lastMessageDate) {
                  showDateSeparator = true;
                  lastMessageDate = dateStr;
                }

                return (
                  <React.Fragment key={messageKey}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-6">
                        <span className="bg-slate-100 text-slate-500 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                          {formatDateSeparator(msgDate)}
                        </span>
                      </div>
                    )}
                    <motion.div
                      id={`msg-${msg.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.isCurrentUser ? "justify-end" : "justify-start"} group`}
                    >
                    {isTaskMessage ? (
                      <div className="flex max-w-xs lg:max-w-md flex-row">
                        <div className="mr-2 flex-shrink-0 relative">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                            <FiMessageSquare size={14} />
                          </div>
                        </div>
                        <TaskMessage
                          taskId={msg.fileName}
                          text={msg.text}
                          taskData={serviceInfo?.tasks?.find(t => String(t.id) === String(msg.fileName))}
                          onStatusUpdate={onTaskStatusUpdate}
                        />
                      </div>

                      ) : isNewTaskMessage ? (
                        (() => {
                            const task = msg.live_task_data || msg.data || allTasks.find(t => String(t.id) === String(msg.text)); 
                            if (!task) return null;
                            return (
                              <NormalTaskMessage
                                taskId={task.id}
                                taskData={task}
                                onStatusUpdate={onNormalTaskStatusUpdate}
                              />
                            );
                        })()
                      ) : (
                        <div className={`flex max-w-[85%] lg:max-w-[70%] ${!msg.isCurrentUser ? "flex-row" : "flex-row-reverse"}`}>
                          {!msg.isCurrentUser && (
                            <div className="mr-2 flex-shrink-0 relative">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-semibold border border-slate-200">
                                {msg.sender_type === 'customer' ? (
                                  <FiUser size={14} className="text-slate-500" />
                                ) : (
                                  msg.sender?.[0] || '?'
                                )}
                              </div>
                              {!isWhatsApp && isUserOnline(msg.senderId) && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                              )}
                            </div>
                          )}
                          <div
                            className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                              msg.isCurrentUser
                                ? "bg-indigo-50 text-slate-800 rounded-br-md border border-indigo-100"
                                : "bg-white text-slate-700 rounded-bl-md border border-slate-200"
                              } ${msg.isOptimistic ? 'opacity-70' : ''}`}
                          >
                            {msg.isDeleted ? (
                              <p className="text-sm italic text-slate-400">This message was deleted</p>
                            ) : msg.isFile ? (
                              <div
                                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition"
                                onClick={() => {
                                  if (msg.fileUrl) {
                                    const fullUrl = msg.fileUrl.startsWith('http') ? msg.fileUrl : `${API_BASE_URL}${msg.fileUrl}`;
                                    window.open(fullUrl, '_blank');
                                  }
                                }}
                              >
                                {msg.messageType === 'image' ? (
                                  <>
                                    <FiImage className="flex-shrink-0 text-slate-500" size={18} />
                                    <span className="truncate text-sm font-medium">{msg.fileName || 'Image'}</span>
                                  </>
                                ) : (
                                  <>
                                    <FiFile className="flex-shrink-0 text-slate-500" size={18} />
                                    <span className="truncate text-sm font-medium">{msg.fileName || 'File'}</span>
                                  </>
                                )}
                                <FiDownload size={14} className="ml-2 text-slate-400" />
                              </div>
                            ) : (
                              renderMessageTextWithMentions(msg.text, msg.mentions)
                            )}
                            <div className={`flex justify-end items-center mt-1.5 gap-1 text-[10px] ${msg.isCurrentUser ? "text-slate-400" : "text-slate-400"}`}>
                              <span>{msg.time}</span>
                              {renderMessageStatus(msg)}
                            </div>
                          </div>
                          {/* Hover Actions */}
                          {!msg.isOptimistic && !msg.isDeleted && msg.messageType === 'text' && (
                            <div className={`flex items-end mb-1 opacity-0 group-hover:opacity-100 transition-opacity gap-1 ${msg.isCurrentUser ? 'mr-2' : 'ml-2'}`}>
                              <button 
                                onClick={() => handleConvertToNote(msg)}
                                className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-amber-500 rounded-full shadow-sm hover:shadow transition" 
                                title="Convert to Note"
                              >
                                <FiStar size={12} />
                              </button>
                              <button 
                                onClick={() => onOpenTaskModal(msg.text)}
                                className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 rounded-full shadow-sm hover:shadow transition" 
                                title="Create Task from Message"
                              >
                                <FiCheckSquare size={12} />
                              </button>
                              {msg.isCurrentUser && (
                                <button
                                  onClick={() => onDeleteMessage(msg.id, activeConversation.id)}
                                  className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-500 rounded-full shadow-sm hover:shadow transition"
                                  title="Delete Message"
                                >
                                  <FiTrash2 size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </React.Fragment>
                );
              })}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Input Area */}
      <div className="w-full bg-white px-4 py-3 border-t border-slate-200 sticky bottom-0 relative">
        {fileToUpload && (
          <div className="mb-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              {fileToUpload.type?.startsWith('image/') ? (
                <FiImage className="text-slate-500" size={16} />
              ) : (
                <FiFile className="text-slate-500" size={16} />
              )}
              <span className="text-xs text-slate-700 font-medium truncate max-w-[200px]">
                {fileToUpload.name}
              </span>
              <span className="text-[10px] text-slate-400">
                ({(fileToUpload.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button
              onClick={() => setFileToUpload(null)}
              className="text-slate-400 hover:text-rose-500 transition"
              disabled={isUploading}
            >
              <FiX size={16} />
            </button>
          </div>
        )}
        {isUploading && fileToUpload && (
          <div className="mb-3">
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-indigo-600"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1 text-right font-medium">
              Uploading... {uploadProgress}%
            </p>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="relative">
            <button
              onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
              className="p-2 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-slate-100 transition"
            >
              <FaRegSmile size={20} />
            </button>
            <AnimatePresence>
              {isEmojiPickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-2 z-50 shadow-xl rounded-xl overflow-hidden border border-slate-200"
                  ref={emojiPickerRef}
                >
                  <EmojiPicker
                    onEmojiClick={handleEmojiSelect}
                    width={300}
                    height={400}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1 bg-white border border-slate-200 rounded-full px-4 py-2 flex items-center focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all">
            <input
              id="chat-message-input"
              ref={chatInputRef}
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isWhatsApp && !isWithinWindow
                  ? "24h window expired – use template button"
                  : "Write your message..."
              }
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm text-slate-700 placeholder:text-slate-400"
              disabled={isUploading || (isWhatsApp && !isWithinWindow)}
            />
            <div className="flex items-center gap-1 ml-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-slate-100 transition"
                disabled={isUploading || (isWhatsApp && !isWithinWindow)}
              >
                <FiPaperclip size={18} />
              </button>
            </div>
          </div>
          {newMessage || fileToUpload ? (
            <motion.button
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSendMessage}
              disabled={isUploading || (isWhatsApp && !isWithinWindow)}
              className="bg-indigo-600 text-white p-2.5 rounded-full shadow-sm hover:bg-indigo-700 transition disabled:opacity-50"
            >
              <FiSend size={18} />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-slate-100 text-slate-500 p-2.5 rounded-full shadow-sm hover:bg-slate-200 transition"
            >
              <FiMic size={18} />
            </motion.button>
          )}
        </div>

        {/* ---------- Autocomplete dropdown ---------- */}
        {mentionQuery && mentionResults.length > 0 && (
          <div className="absolute bottom-[80px] left-14 bg-white border border-slate-200 rounded-xl shadow-xl w-64 overflow-hidden z-50">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Staff Suggestions
            </div>
            {mentionResults.map(staff => (
              <button
                key={staff.id}
                onClick={() => handleSelectMention(staff)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition text-left"
              >
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {staff.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{staff.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{staff.role}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {/* ---------------------------------------------- */}

      </div>

      {/* Tasks Modal */}
      {showTasksModal && serviceInfo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowTasksModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Service Tasks</h3>
              <button onClick={() => setShowTasksModal(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {serviceInfo.tasks.length === 0 ? (
                <p className="text-slate-500 text-center py-4 text-sm">No tasks for this service.</p>
              ) : (
                <div className="space-y-3">
                  {serviceInfo.tasks.map(task => (
                    <div key={task.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className={`font-semibold text-sm ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {task.title}
                          </h4>
                          {task.description && <p className="text-xs text-slate-500 mt-1">{task.description}</p>}
                          <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-slate-500 font-medium">
                            {task.assigned_to_name && <span className="flex items-center gap-1"><FiUser size={10}/> {task.assigned_to_name}</span>}
                            {task.due_date && <span className="flex items-center gap-1"><FiClock size={10}/> {formatDate(task.due_date)}</span>}
                            <span className={`px-2 py-0.5 rounded-full border ${
                              task.priority === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              task.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {task.priority}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full border ${
                              task.status === 'completed' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                              task.status === 'in_progress' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {task.status === 'in_progress' ? 'In Progress' : task.status === 'completed' ? 'Completed' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Send WhatsApp Template</h3>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Template</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"
              >
                <option value="reengagement_message">Re‑engagement (Auto-Mapped)</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Parameters (comma separated)</label>
              <input
                type="text"
                value={templateParams}
                onChange={(e) => setTemplateParams(e.target.value)}
                placeholder="e.g. John, APP-123"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"
              />
              <p className="text-[10px] text-slate-500 mt-1">Example: Customer name, Application ID</p>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTemplate}
                disabled={sendingTemplate}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm"
              >
                {sendingTemplate ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;