// Chat.jsx
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
  FiMessageSquare,
  FiUser, // Added for customer avatar
  FiSmartphone, // Added for WhatsApp badge
} from "react-icons/fi";
import { FaRegSmile } from "react-icons/fa";
import { IoMdCheckmarkCircle, IoMdCheckmarkCircleOutline } from "react-icons/io";
import { BsCircleFill } from "react-icons/bs";
import { toast } from "react-toastify";
import EmojiPicker from 'emoji-picker-react';
import { socket } from "@/services/socket";

const API_BASE_URL = (() => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  }
  return 'http://localhost:5000/api';
})();

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

// TaskMessage component (interactive task card)
const TaskMessage = ({ taskId, text, taskData, onStatusUpdate }) => {
  const [completing, setCompleting] = useState(false);
  
  // Determine actual completion status from the live taskData passed from the workspace!
  const completed = taskData?.status === 'completed';

  const handleComplete = async () => {
    if (completing || completed) return;
    setCompleting(true);
    try {
      // Let the parent Workspace handle the API call and state synchronization
      if (onStatusUpdate) {
        await onStatusUpdate(taskId, 'completed');
      }
    } catch (err) {
      // Error toast is handled by parent
    } finally {
      setCompleting(false);
    }
  };

  // Parse the text to extract title, assignee, due date
  const match = text.match(/📋 Task created: "(.*?)" assigned to (.*?)\. Due: (.*?)(\.|$)/);
  const title = match ? match[1] : text.replace(/^📋 Task created: /, '').replace(/\.$/, '');
  const assignee = match ? match[2] : '';
  const dueDate = match ? match[3] : '';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm max-w-md">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h4 className={`font-medium ${completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
            {title}
          </h4>
          {assignee && <p className="text-xs text-gray-500 mt-1">👤 {assignee}</p>}
          {dueDate && <p className="text-xs text-gray-500">📅 {dueDate}</p>}
        </div>
        {!completed && (
          <button
            onClick={handleComplete}
            disabled={completing}
            className="px-3 py-1 text-xs whitespace-nowrap bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {completing ? '...' : '✓ Complete'}
          </button>
        )}
        {completed && (
          <span className="text-xs text-green-600 font-medium whitespace-nowrap mt-1">✓ Completed</span>
        )}
      </div>
    </div>
  );
};

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
  onTaskStatusUpdate = null, // <-- Passed from Workspace for live sync
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

  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);

  const currentMessages = messages[activeConversation?.id] || [];

  // Get display name for the conversation (handles WhatsApp)
  const getConversationDisplayName = useCallback(() => {
    if (!activeConversation) return '';

    // If it's a WhatsApp conversation
    if (activeConversation.channel === 'whatsapp') {
      // Use context_name (customer name) if available, otherwise context_identifier (phone number)
      return activeConversation.context_name || activeConversation.context_identifier || 'WhatsApp User';
    }

    // Internal conversation
    let displayName = activeConversation.name;
    if (!displayName && !activeConversation.is_group && activeConversation.participants) {
      const otherParticipants = activeConversation.participants.filter(p => p.staff_id !== currentUser.id);
      if (otherParticipants.length > 0) {
        displayName = otherParticipants.map(p => p.name).join(', ');
      }
    }
    return displayName || 'Unknown Chat';
  }, [activeConversation, currentUser.id]);

  // Get online status for a user - Convert to strings
  const isUserOnline = useCallback((userId) => {
    return onlineUsers.has(String(userId));
  }, [onlineUsers]);

  // Determine if we should show online indicator (not for WhatsApp)
  const shouldShowOnlineIndicator = useCallback(() => {
    return activeConversation?.channel !== 'whatsapp' && !activeConversation?.is_group;
  }, [activeConversation]);

  // Join conversation room when active
  useEffect(() => {
    if (!socket.connected || !activeConversation?.id) return;

    console.log("Joining conversation:", activeConversation.id);
    socket.emit("join_conversation", activeConversation.id);

    return () => {
      console.log("Leaving conversation:", activeConversation.id);
      socket.emit("leave_conversation", activeConversation.id);

      // Clear typing status when leaving
      if (isTyping) {
        fetch(`${API_BASE_URL}/chat/typing`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            conversation_id: activeConversation.id,
            isTyping: false
          })
        }).catch(err => console.error("Error clearing typing status:", err));
      }
    };
  }, [activeConversation?.id, isTyping, API_BASE_URL]);

  // Listen for socket events
  useEffect(() => {
    if (!socket.connected || !activeConversation?.id) return;

    // Handle typing indicator
    const handleTyping = (data) => {
      if (data.conversationId !== activeConversation?.id || data.userId === currentUser.id) return;
      console.log("Typing event received:", data);
      // The parent component already manages typingUsers via props
    };

    // Handle messages read
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

  // Auto-scroll to latest messages
  useEffect(() => {
    if (messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end"
        });
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

  // Throttled typing indicator
  const emitTyping = useCallback((typing) => {
    if (!activeConversation?.id) return;

    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2000) {
      console.log(`Emitting typing: ${typing} for conversation: ${activeConversation.id}`);

      if (socket.connected) {
        socket.emit("typing", {
          conversationId: activeConversation.id,
          userId: currentUser.id,
          userName: currentUser.name,
          isTyping: typing
        });
      } else {
        console.log("Socket not connected, cannot emit typing");
      }

      fetch(`${API_BASE_URL}/chat/typing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          conversation_id: activeConversation.id,
          isTyping: typing
        })
      })
        .then(res => res.json())
        .then(data => console.log("Typing API response:", data))
        .catch(err => console.error("Typing API error:", err));

      lastTypingEmitRef.current = now;
    }
  }, [activeConversation?.id, currentUser.id, currentUser.name, API_BASE_URL]);

  // Handle input change with typing indicator
  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (value.length > 0) {
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

  // Clean up typing status when leaving conversation
  useEffect(() => {
    return () => {
      if (isTyping && activeConversation?.id) emitTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [activeConversation?.id, isTyping, emitTyping]);

  const handleSendMessage = () => {
    if ((!newMessage.trim() && !fileToUpload) || !activeConversation) return;

    if (isTyping) {
      setIsTyping(false);
      emitTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

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
      isOptimistic: true
    };

    onSendMessage(newMessage, fileToUpload, optimisticMessage);

    setNewMessage("");
    setFileToUpload(null);
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
    if (msg.isOptimistic) return <FiClock className="text-blue-200 ml-1" size={12} title="Sending..." />;

    const readers = getReadReceipts(msg.id);
    const otherParticipants = activeConversation?.participants?.filter(p => p.staff_id !== currentUser.id) || [];

    if (readers.length === otherParticipants.length && otherParticipants.length > 0) {
      return <IoMdCheckmarkCircle className="text-blue-300 ml-1" size={14} title="Read by everyone" />;
    } else if (readers.length > 0) {
      return <IoMdCheckmarkCircle className="text-blue-200 ml-1" size={14} title={`Read by ${readers.length} of ${otherParticipants.length}`} />;
    } else {
      return <IoMdCheckmarkCircleOutline className="text-blue-200 ml-1" size={14} title="Sent" />;
    }
  };

  if (!activeConversation) {
    return (
      <div className="flex flex-col items-center justify-center bg-gray-50 p-4 text-center h-full overflow-y-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-navy-700 w-24 h-24 rounded-2xl flex items-center justify-center mb-6"
        >
          <FiSend className="text-white text-4xl" />
        </motion.div>
        <motion.h3
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-gray-800 mb-2"
        >
          Welcome to Chat
        </motion.h3>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-gray-500 max-w-md mb-6"
        >
          Select a conversation or start a new chat to begin messaging
        </motion.p>
        <div className="flex gap-4">
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={onOpenNewChatModal}
            className="px-5 py-3 bg-navy-700 text-white rounded-xl flex items-center gap-2 hover:bg-navy-800 transition shadow-lg"
          >
            <FiPlus /> New Conversation
          </motion.button>
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            onClick={onOpenTaskModal}
            className="px-5 py-3 bg-green-600 text-white rounded-xl flex items-center gap-2 hover:bg-green-700 transition shadow-lg"
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

  // For WhatsApp, we don't show online status
  const showOnlineStatus = shouldShowOnlineIndicator();

  // Determine if we have a single participant to show online dot for (for direct internal chats)
  const singleOtherParticipant = !activeConversation.is_group && !isWhatsApp && activeConversation.participants?.find(p => p.staff_id !== currentUser.id);
  const isParticipantOnline = singleOtherParticipant ? isUserOnline(singleOtherParticipant.staff_id) : false;

  return (
    <div className="flex flex-col w-full bg-white h-full min-h-0">
      {/* Fixed Header */}
      <div className="flex-none h-[70px] w-full px-4 flex items-center border-b border-gray-200 bg-white shadow-sm">
        <button className="md:hidden mr-3 text-gray-500 hover:text-gray-700" onClick={onBack}>
          <FiChevronLeft size={24} />
        </button>
        <div className="relative">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${activeConversation.avatarColor || 'bg-navy-700'} mr-3 flex-shrink-0`}
          >
            {avatarChar}
          </div>
          {showOnlineStatus && singleOtherParticipant && (
            <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${isParticipantOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-gray-800 truncate">{displayName}</h2>
            {isWhatsApp && (
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                <FiSmartphone size={12} /> WhatsApp
              </span>
            )}
            {serviceInfo && (
              <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full">
                Service
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {typingUsers[activeConversation.id]?.length > 0 ? (
              <p className="text-xs text-navy-700 italic">
                {typingUsers[activeConversation.id].map(u => u.name).join(', ')} typing...
              </p>
            ) : activeConversation.is_group ? (
              <p className="text-xs text-gray-500">
                {activeConversation.participants?.length || 0} members
                {onlineParticipants.length > 0 && (
                  <span className="ml-2">({onlineParticipants.length} online)</span>
                )}
              </p>
            ) : isWhatsApp ? (
              <p className="text-xs text-gray-500">
                WhatsApp conversation
              </p>
            ) : (
              <div className="flex items-center">
                <BsCircleFill className={`text-xs mr-1 ${isParticipantOnline ? 'text-green-500' : 'text-gray-400'}`} />
                <span className="text-xs text-gray-500">
                  {isParticipantOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            )}
            {serviceInfo && serviceInfo.applicationNumber && (
              <span className="text-xs text-gray-400 ml-2">
                App #{serviceInfo.applicationNumber}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex gap-1 relative">
          <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition">
            <FiVideoCall size={18} />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition">
            <FiPhoneCall size={18} />
          </button>
          <button
            onClick={onOpenTaskModal}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition"
            title="Create New Task"
          >
            <FiPlus size={18} />
          </button>
          {hasTasks && (
            <button
              onClick={() => setShowTasksModal(true)}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition"
              title="View Tasks"
            >
              <FiList size={18} />
            </button>
          )}
          <button
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition relative"
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
                className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
              >
                <button className="flex items-center w-full p-3 text-sm hover:bg-gray-50">
                  <FiUserPlus className="mr-3" /> Add People
                </button>
                <button className="flex items-center w-full p-3 text-sm hover:bg-gray-50">
                  <FiStar className="mr-3" /> Mark as Favorite
                </button>
                <button className="flex items-center w-full p-3 text-sm hover:bg-gray-50">
                  <FiInfo className="mr-3" /> View Details
                </button>
                <button className="flex items-center w-full p-3 text-sm text-red-500 hover:bg-gray-50">
                  <FiTrash2 className="mr-3" /> Delete Conversation
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Scrollable Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto bg-gray-50 chat-scroll"
      >
        <div className="px-4 py-6 space-y-4">
          {loadingChat ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-700"></div>
            </div>
          ) : (
            <>
              {currentMessages.map((msg, index) => {
                const messageKey = msg.isOptimistic
                  ? `opt-${msg.tempId || msg.id}-${index}`
                  : `msg-${msg.id}`;

                // Check if this is a system message with a task ID
                const isTaskMessage = msg.isSystem && msg.fileName && !isNaN(Number(msg.fileName)) && serviceEntryId;

                return (
                  <motion.div
                    key={messageKey}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.isCurrentUser ? "justify-end" : "justify-start"} group`}
                  >
                    {isTaskMessage ? (
                      <div className="flex max-w-xs lg:max-w-md flex-row">
                        <div className="mr-2 flex-shrink-0 relative">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                            <FiMessageSquare size={14} />
                          </div>
                        </div>
                        <TaskMessage
                          taskId={msg.fileName}
                          text={msg.text}
                          // Extract the live task data from the workspace!
                          taskData={serviceInfo?.tasks?.find(t => String(t.id) === String(msg.fileName))}
                          onStatusUpdate={onTaskStatusUpdate}
                        />
                      </div>
                    ) : (
                      <div className={`flex max-w-xs lg:max-w-md ${!msg.isCurrentUser ? "flex-row" : "flex-row-reverse"}`}>
                        {!msg.isCurrentUser && (
                          <div className="mr-2 flex-shrink-0 relative">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                              {msg.sender_type === 'customer' ? (
                                <FiUser size={14} className="text-gray-500" />
                              ) : (
                                msg.sender?.[0] || '?'
                              )}
                            </div>
                            {!isWhatsApp && isUserOnline(msg.senderId) && (
                              <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                            )}
                          </div>
                        )}
                        <div
                          className={`px-4 py-2 rounded-2xl ${msg.isCurrentUser
                              ? "bg-navy-700 text-white rounded-br-none"
                              : "bg-white text-gray-700 rounded-bl-none shadow-sm border border-gray-200"
                            } ${msg.isOptimistic ? 'opacity-70' : ''}`}
                        >
                          {msg.isDeleted ? (
                            <p className="text-sm italic text-gray-400">This message was deleted</p>
                          ) : msg.isFile ? (
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                              onClick={() => msg.fileUrl && window.open(msg.fileUrl, '_blank')}
                            >
                              {msg.messageType === 'image' ? (
                                <>
                                  <FiImage className="flex-shrink-0" size={20} />
                                  <span className="truncate">{msg.fileName || 'Image'}</span>
                                </>
                              ) : (
                                <>
                                  <FiFile className="flex-shrink-0" size={20} />
                                  <span className="truncate">{msg.fileName || 'File'}</span>
                                </>
                              )}
                              <FiDownload size={14} className="ml-2" />
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                          )}
                          <div className={`flex justify-between items-center mt-1 text-xs ${msg.isCurrentUser ? "text-blue-200" : "text-gray-500"}`}>
                            <span>{msg.time}</span>
                            <div className="flex items-center">
                              {renderMessageStatus(msg)}
                            </div>
                          </div>
                        </div>
                        {msg.isCurrentUser && !msg.isDeleted && !msg.isOptimistic && (
                          <button
                            onClick={() => onDeleteMessage(msg.id, activeConversation.id)}
                            className="ml-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition self-end mb-1"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Input Area */}
      <div className="w-full bg-white p-3 border-t border-gray-200 sticky bottom-0">
        {fileToUpload && (
          <div className="mb-2 px-3 py-2 bg-gray-100 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              {fileToUpload.type?.startsWith('image/') ? (
                <FiImage className="text-gray-600" />
              ) : (
                <FiFile className="text-gray-600" />
              )}
              <span className="text-sm text-gray-700 truncate max-w-[200px]">
                {fileToUpload.name}
              </span>
              <span className="text-xs text-gray-500">
                ({(fileToUpload.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button
              onClick={() => setFileToUpload(null)}
              className="text-gray-500 hover:text-red-500"
              disabled={isUploading}
            >
              <FiX size={18} />
            </button>
          </div>
        )}
        {isUploading && fileToUpload && (
          <div className="mb-2">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-navy-700"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">
              Uploading... {uploadProgress}%
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
              className="p-2 text-gray-500 hover:text-navy-700 rounded-full hover:bg-gray-100 transition"
            >
              <FaRegSmile size={20} />
            </button>
            <AnimatePresence>
              {isEmojiPickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-2 z-50"
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
          <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 flex items-center">
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-gray-700"
              disabled={isUploading}
            />
            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 hover:text-navy-700 rounded-full hover:bg-gray-200 transition"
                disabled={isUploading}
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
              disabled={isUploading}
              className="bg-navy-700 text-white p-3 rounded-full shadow-md hover:bg-navy-800 transition disabled:opacity-50"
            >
              <FiSend size={18} />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gray-200 text-gray-600 p-3 rounded-full shadow"
            >
              <FiMic size={18} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Tasks Modal */}
      {showTasksModal && serviceInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTasksModal(false)}>
          <div className="bg-white rounded-lg w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Service Tasks</h3>
              <button onClick={() => setShowTasksModal(false)} className="text-gray-500 hover:text-gray-700">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {serviceInfo.tasks.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No tasks for this service.</p>
              ) : (
                <div className="space-y-3">
                  {serviceInfo.tasks.map(task => (
                    <div key={task.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {task.title}
                          </h4>
                          {task.description && <p className="text-sm text-gray-600 mt-1">{task.description}</p>}
                          <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                            {task.assigned_to_name && <span>👤 {task.assigned_to_name}</span>}
                            {task.due_date && <span>📅 {formatDate(task.due_date)}</span>}
                            <span className={`px-2 py-0.5 rounded-full ${
                              task.priority === 'high' ? 'bg-red-100 text-red-800' :
                              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {task.priority}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full ${
                              task.status === 'completed' ? 'bg-green-100 text-green-800' :
                              task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
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
    </div>
  );
};

export default Chat;