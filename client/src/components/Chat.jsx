import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSend,
  FiPaperclip,
  FiMoreVertical,
  FiChevronLeft,
  FiPlus,
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
  FiCheckSquare,
  FiUser,
  FiBriefcase,
  FiSmartphone,
  FiMapPin,
  FiChevronRight,
  FiAlertCircle,
} from "react-icons/fi";
import { FaRegSmile } from "react-icons/fa";
import { IoCheckmark, IoCheckmarkDone } from "react-icons/io5";
import { toast } from "react-toastify";
import EmojiPicker from "emoji-picker-react";
import { socket } from "@/services/socket";
import axios from "axios";
import ChatAvatar from "@/components/chat/ChatAvatar";
import {
  getAvatarUrl,
  getAvatarColor,
  getConversationDisplayName,
  getConversationPhoto,
  getOtherParticipants,
  isGroupConversation,
  getSenderNameColor,
  formatDayLabel,
  isSameDay,
  toDate,
} from "@/components/chat/chatUtils";

const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  throw new Error("VITE_API_URL is not defined");
}

// Helper: check if last customer message is within 24 hours
const isWithin24Hours = (lastMessageTime) => {
  if (!lastMessageTime) return false;
  const diffHours = (new Date() - new Date(lastMessageTime)) / (1000 * 60 * 60);
  return diffHours <= 24;
};

// Helper to format date for task due dates
const formatDate = (dateString) => {
  if (!dateString) return "No due date";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";
    return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "Invalid date";
  }
};

const fullFileUrl = (url) => (!url ? null : url.startsWith("http") ? url : `${API_BASE_URL}${url}`);

/* ══════════════════════════════════════════════════════════════
   Small UI pieces
   ══════════════════════════════════════════════════════════════ */

const HeaderButton = ({ onClick, title, active, className = "", children }) => (
  <button
    onClick={onClick}
    title={title}
    className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition ${
      active ? "bg-blue-50 text-navy-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
    } ${className}`}
  >
    {children}
  </button>
);

const MessageAction = ({ onClick, title, hover, children }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title={title}
    className={`h-7 w-7 rounded-full bg-white ring-1 ring-slate-200 shadow-sm text-slate-400 flex items-center justify-center transition ${hover}`}
  >
    {children}
  </button>
);

const DaySeparator = ({ label }) => (
  <div className="flex justify-center my-4 first:mt-0">
    <span className="px-3 py-1 rounded-full bg-white/90 ring-1 ring-slate-200 text-[11px] font-medium text-slate-500 shadow-sm">
      {label}
    </span>
  </div>
);

const ModalShell = ({ title, onClose, children, footer }) => (
  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 sm:p-4" onClick={onClose}>
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 h-14 border-b border-slate-100 shrink-0">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <button onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100">
          <FiX size={18} />
        </button>
      </div>
      <div className="px-5 py-4 overflow-y-auto">{children}</div>
      {footer && <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">{footer}</div>}
    </motion.div>
  </div>
);

/* ══════════════════════════════════════════════════════════════
   Task cards
   ══════════════════════════════════════════════════════════════ */

const TaskCardShell = ({ title, completed, meta, onComplete, completing }) => (
  <div className="w-full max-w-sm bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-3.5">
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${completed ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-navy-700"}`}>
        <FiCheckSquare size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Task</p>
        <h4 className={`text-sm font-semibold leading-snug ${completed ? "line-through text-slate-400" : "text-slate-900"}`}>{title}</h4>
        <div className="mt-1 space-y-0.5 text-xs text-slate-500">{meta}</div>
      </div>
    </div>
    <div className="mt-3 flex justify-end">
      {completed ? (
        <span className="text-xs font-medium text-emerald-600">✓ Completed</span>
      ) : (
        <button
          onClick={onComplete}
          disabled={completing}
          className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition disabled:opacity-50"
        >
          {completing ? "Saving…" : "Mark complete"}
        </button>
      )}
    </div>
  </div>
);

// Service task card (system message with task id in fileName)
const TaskMessage = ({ taskId, text, taskData, onStatusUpdate }) => {
  const [completing, setCompleting] = useState(false);
  const completed = taskData?.status === "completed";

  const handleComplete = async () => {
    if (completing || completed) return;
    setCompleting(true);
    try {
      if (onStatusUpdate) await onStatusUpdate(taskId, "completed");
    } catch {
      // Error toast is handled by parent
    } finally {
      setCompleting(false);
    }
  };

  const match = text.match(/📋 Task created: "(.*?)" assigned to (.*?)\. Due: (.*?)(\.|$)/);
  const title = match ? match[1] : text.replace(/^📋 Task created: /, "").replace(/\.$/, "");
  const assignee = match ? match[2] : "";
  const dueDate = match ? match[3] : "";

  return (
    <TaskCardShell
      title={title}
      completed={completed}
      completing={completing}
      onComplete={handleComplete}
      meta={
        <>
          {assignee && <p className="flex items-center gap-1"><FiUser size={11} /> {assignee}</p>}
          {dueDate && <p className="flex items-center gap-1"><FiClock size={11} /> {dueDate}</p>}
        </>
      }
    />
  );
};

// Normal task shared into a chat
const NormalTaskMessage = ({ taskId, taskData, onStatusUpdate }) => {
  const [completing, setCompleting] = useState(false);
  const completed = taskData?.status === "completed";

  const handleComplete = async () => {
    if (completing || completed) return;
    setCompleting(true);
    try {
      if (onStatusUpdate) await onStatusUpdate(taskId, taskData.status);
    } catch {
      // parent handles the error toast
    } finally {
      setCompleting(false);
    }
  };

  return (
    <TaskCardShell
      title={taskData.title}
      completed={completed}
      completing={completing}
      onComplete={handleComplete}
      meta={
        <>
          <p className="capitalize">
            {taskData.priority || "medium"} priority · {String(taskData.status || "pending").replace("_", " ")}
          </p>
          {taskData.due_date && <p className="flex items-center gap-1"><FiClock size={11} /> {formatDate(taskData.due_date)}</p>}
        </>
      }
    />
  );
};

/* ══════════════════════════════════════════════════════════════
   Tracking mention card (@284)
   ══════════════════════════════════════════════════════════════ */

const TrackingMentionCard = ({ entityId, displayText }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    axios
      .get(`${API_BASE_URL}/api/chat/mentions/tracking/${entityId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => console.error(err))
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [entityId]);

  if (loading) return <span className="font-medium opacity-70 animate-pulse">{displayText}</span>;
  if (!data) return <span className="font-medium line-through opacity-70" title="Tracking not found">{displayText}</span>;

  const priorityCls =
    data.priority === "High"
      ? "bg-rose-50 text-rose-600 ring-rose-200"
      : data.priority === "Medium"
      ? "bg-amber-50 text-amber-600 ring-amber-200"
      : "bg-emerald-50 text-emerald-600 ring-emerald-200";

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        window.open(`/dashboard/staff/track_service/${data.tracking_id || entityId}`, "_blank");
      }}
      className="my-2 block w-full max-w-[18rem] bg-white text-slate-800 rounded-xl ring-1 ring-slate-200 hover:ring-blue-300 transition cursor-pointer text-left overflow-hidden select-none"
    >
      <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-navy-700">
          <FiFile size={12} /> App #{data.application_number || data.tracking_id || entityId}
        </span>
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ring-1 ${priorityCls}`}>
          {data.priority || "Normal"}
        </span>
      </div>
      <div className="p-3 space-y-2">
        <p className="flex items-start gap-2 text-sm font-semibold leading-tight">
          <FiBriefcase className="text-slate-400 mt-0.5 shrink-0" size={13} />
          {data.service_name || "Unknown Service"}
        </p>
        <p className="flex items-center gap-2 text-[13px] text-slate-600 truncate">
          <FiUser className="text-slate-400 shrink-0" size={13} />
          {data.customer_name || "No customer attached"}
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
          <div>
            <p className="text-slate-400">Status</p>
            <p className="font-semibold capitalize truncate">{data.status || "Pending"}</p>
          </div>
          <div>
            <p className="text-slate-400">Step</p>
            <p className="font-semibold text-navy-700 truncate" title={data.current_step}>{data.current_step || "Initial phase"}</p>
          </div>
          {data.estimated_delivery && (
            <div>
              <p className="text-slate-400">Delivery</p>
              <p className="font-semibold truncate">{data.estimated_delivery}</p>
            </div>
          )}
          <div>
            <p className="text-slate-400">Assigned</p>
            <p className="font-semibold truncate">{data.assigned_to || "Unassigned"}</p>
          </div>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-slate-100 flex justify-end">
        <span className="text-xs font-medium text-navy-700 flex items-center gap-0.5">
          Open <FiChevronRight size={12} />
        </span>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN CHAT
   ══════════════════════════════════════════════════════════════ */

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
  onDeleteConversation = null,
  onOpenDetails = null,
  isDetailsOpen = false,
}) => {
  const [newMessage, setNewMessage] = useState("");
  const [fileToUpload, setFileToUpload] = useState(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isUploading] = useState(false);
  const [uploadProgress] = useState(0);
  const [messageReadBy, setMessageReadBy] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [selectedMsgId, setSelectedMsgId] = useState(null);

  // WhatsApp 24h window state
  const [lastCustomerMessageTime, setLastCustomerMessageTime] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("reengagement_message");
  const [templateParams, setTemplateParams] = useState("");
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // Mentions
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionResults, setMentionResults] = useState([]);
  const [pendingStaffMentions, setPendingStaffMentions] = useState([]);

  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const moreMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const chatInputRef = useRef(null);

  const currentMessages = messages[activeConversation?.id] || [];
  const isWithinWindow = isWithin24Hours(lastCustomerMessageTime);

  // Update last customer message time whenever messages change
  useEffect(() => {
    if (!activeConversation || activeConversation.channel !== "whatsapp") return;
    const customerMessages = currentMessages.filter((m) => m.sender_type === "customer" && !m.isOptimistic);
    if (customerMessages.length > 0) {
      const lastMsg = customerMessages[customerMessages.length - 1];
      const ts = lastMsg.createdAt || lastMsg.created_at;
      if (ts) setLastCustomerMessageTime(new Date(ts));
    } else {
      setLastCustomerMessageTime(null);
    }
  }, [currentMessages, activeConversation]);

  const getDisplayName = useCallback(
    () => getConversationDisplayName(activeConversation, currentUser.id),
    [activeConversation, currentUser.id]
  );

  // Auto-fill the customer's name when the Template Modal opens
  useEffect(() => {
    if (showTemplateModal && activeConversation) {
      let defaultName = getDisplayName();
      defaultName = defaultName.replace(/WhatsApp /i, "").replace(/Chat with /i, "").trim();
      if (/^\+?\d+$/.test(defaultName.replace(/[\s-]/g, ""))) defaultName = "";
      setTemplateParams(defaultName);
      setSelectedTemplate("reengagement_message");
    }
  }, [showTemplateModal, activeConversation, getDisplayName]);

  const isUserOnline = useCallback((userId) => onlineUsers.has(String(userId)), [onlineUsers]);

  // Join conversation room when active
  useEffect(() => {
    if (!socket?.connected || !activeConversation?.id) return;
    socket.emit("join_conversation", activeConversation.id);
    return () => {
      socket.emit("leave_conversation", activeConversation.id);
    };
  }, [activeConversation?.id]);

  // Read receipts
  useEffect(() => {
    if (!socket.connected || !activeConversation?.id) return;
    const handleMessagesRead = (data) => {
      if (data.conversationId !== activeConversation?.id) return;
      setMessageReadBy((prev) => ({
        ...prev,
        ...data.messageIds.reduce((acc, id) => ({ ...acc, [id]: [...(prev[id] || []), data.readerId] }), {}),
      }));
    };
    socket.on("messages_read", handleMessagesRead);
    return () => socket.off("messages_read", handleMessagesRead);
  }, [activeConversation?.id, currentUser.id]);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      const t = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [currentMessages, activeConversation?.id]);

  // Reset per-conversation UI state
  useEffect(() => {
    setSelectedMsgId(null);
    setIsMoreMenuOpen(false);
    setMentionQuery(null);
  }, [activeConversation?.id]);

  // Mark messages as read
  useEffect(() => {
    if (!activeConversation || !currentMessages.length || !socket.connected) return;
    const unreadMessages = currentMessages
      .filter((msg) => !msg.isCurrentUser && !msg.is_read_by_me && !msg.isOptimistic)
      .map((msg) => msg.id);
    if (unreadMessages.length > 0) {
      const timeoutId = setTimeout(() => {
        socket.emit("mark_read", { messageIds: unreadMessages, conversationId: activeConversation.id });
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [currentMessages, activeConversation?.id, activeConversation]);

  // Auto-grow the message box
  useEffect(() => {
    const el = chatInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [newMessage]);

  // Typing indicator
  const emitTyping = useCallback(
    (typing) => {
      if (!activeConversation?.id) return;
      const now = Date.now();
      if (now - lastTypingEmitRef.current > 2000) {
        if (socket.connected) {
          socket.emit("typing", {
            conversationId: activeConversation.id,
            userId: currentUser.id,
            userName: currentUser.name,
            isTyping: typing,
          });
        }
        fetch(`${API_BASE_URL}/api/chat/typing`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ conversation_id: activeConversation.id, isTyping: typing }),
        }).catch((err) => console.error("Typing API error:", err));
        lastTypingEmitRef.current = now;
      }
    },
    [activeConversation?.id, currentUser.id, currentUser.name]
  );

  const handleInputChange = async (e) => {
    const val = e.target.value;
    setNewMessage(val);

    // Detect staff mentions (@ followed by letters)
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z]+)$/);

    if (match) {
      setMentionQuery(match[1]);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/chat/mentions/search-staff?q=${match[1]}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setMentionResults(res.data);
      } catch (err) {
        console.error("Staff fetch error", err);
      }
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
        setIsTyping(false);
        emitTyping(false);
      }, 3000);
    } else if (isTyping) {
      setIsTyping(false);
      emitTyping(false);
    }
  };

  useEffect(() => {
    return () => {
      if (isTyping && activeConversation?.id) emitTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [activeConversation?.id, isTyping, emitTyping]);

  const handleSelectMention = (staff) => {
    const inputEl = chatInputRef.current;
    if (!inputEl) return;
    const cursor = inputEl.selectionStart;
    const textBefore = newMessage.slice(0, cursor).replace(/(?:^|\s)@([a-zA-Z]+)$/, ` @${staff.name} `);
    const textAfter = newMessage.slice(cursor);
    setNewMessage(textBefore + textAfter);
    setMentionQuery(null);
    setPendingStaffMentions((prev) => [...prev, { entityId: staff.id, name: staff.name }]);
    inputEl.focus();
  };

  // Convert message to note (react-mentions compatible: @[Name](id))
  const handleConvertToNote = async (msg) => {
    try {
      const staffMentions = [];
      let finalContent = msg.text;

      if (msg.mentions && msg.mentions.length > 0) {
        const sortedMentions = [...msg.mentions].sort((a, b) => b.start_index - a.start_index);
        sortedMentions.forEach((m) => {
          if (m.mention_type === "staff") {
            staffMentions.push(m.entity_id);
            const cleanName = m.display_text.replace("@", "").trim();
            const formattedMention = `@[${cleanName}](${m.entity_id})`;
            finalContent =
              finalContent.substring(0, m.start_index) + formattedMention + finalContent.substring(m.end_index);
          }
        });
      }

      const uniqueMentions = [...new Set(staffMentions)];
      const payload = {
        title: `Note from chat: ${msg.sender || "Unknown"}`,
        content: finalContent,
        visibility: uniqueMentions.length > 0 ? "mention" : "private",
        mentions: uniqueMentions,
        related_conversation_id: activeConversation.id,
        origin_message_id: msg.id,
        related_service_entry_id:
          activeConversation.context_type === "service_entry" ? activeConversation.context_id : null,
      };

      await axios.post(`${API_BASE_URL}/api/notes`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      toast.success(uniqueMentions.length > 0 ? "Note saved and staff notified ⭐" : "Private note saved ⭐");
      setSelectedMsgId(null);
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

    // 1. Tracking IDs (@284)
    while ((match = trackingRegex.exec(newMessage)) !== null) {
      const matchText = match[0].trim();
      const startIndex = match.index + (match[0].startsWith(" ") ? 1 : 0);
      mentions.push({
        mention_type: "tracking",
        entity_id: parseInt(match[1], 10),
        display_text: matchText,
        start_index: startIndex,
        end_index: startIndex + matchText.length,
      });
    }

    // 2. Staff mentions picked from the dropdown
    pendingStaffMentions.forEach((m) => {
      const regex = new RegExp(`(?:^|\\s)@${m.name}(?=\\s|$)`, "g");
      while ((match = regex.exec(newMessage)) !== null) {
        const matchText = match[0].trim();
        const startIndex = match.index + (match[0].startsWith(" ") ? 1 : 0);
        mentions.push({
          mention_type: "staff",
          entity_id: m.entityId,
          display_text: matchText,
          start_index: startIndex,
          end_index: startIndex + matchText.length,
        });
      }
    });

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage = {
      id: tempId,
      tempId,
      sender: "You",
      senderId: currentUser.id,
      text: newMessage || (fileToUpload ? (fileToUpload.type?.startsWith("image/") ? "📷 Image" : "📎 File") : ""),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
      isFile: !!fileToUpload,
      fileName: fileToUpload?.name,
      fileUrl: null,
      fileSize: fileToUpload?.size,
      messageType: fileToUpload ? (fileToUpload.type?.startsWith("image/") ? "image" : "file") : "text",
      isCurrentUser: true,
      is_read_by_me: true,
      isOptimistic: true,
      mentions,
    };
    onSendMessage(newMessage, fileToUpload, optimisticMessage);
    setNewMessage("");
    setFileToUpload(null);
    setPendingStaffMentions([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setFileToUpload(file);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessage((prev) => prev + emoji.emoji);
    setIsEmojiPickerOpen(false);
    if (!isTyping) {
      setIsTyping(true);
      emitTyping(true);
    }
  };

  // Close emoji picker / more menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) setIsEmojiPickerOpen(false);
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setIsMoreMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getReadReceipts = (messageId) => {
    const readers = messageReadBy[messageId] || [];
    if (!activeConversation?.participants) return [];
    return activeConversation.participants.filter((p) => readers.includes(p.staff_id)).map((p) => p.name);
  };

  const renderMessageStatus = (msg) => {
    if (!msg.isCurrentUser) return null;
    if (msg.isOptimistic) return <FiClock className="text-blue-100" size={11} title="Sending…" />;
    const readers = getReadReceipts(msg.id);
    const others = activeConversation?.participants?.filter((p) => p.staff_id !== currentUser.id) || [];
    if (readers.length === others.length && others.length > 0) {
      return <IoCheckmarkDone className="text-sky-300" size={15} title="Read by everyone" />;
    }
    if (readers.length > 0) {
      return <IoCheckmarkDone className="text-blue-100" size={15} title={`Read by ${readers.length} of ${others.length}`} />;
    }
    return <IoCheckmark className="text-blue-100" size={14} title="Sent" />;
  };

  const renderMessageTextWithMentions = (text, mentions = [], isOwn) => {
    if (!mentions || mentions.length === 0) {
      return <p className="whitespace-pre-wrap break-words">{text}</p>;
    }
    const sorted = [...mentions].sort((a, b) => a.start_index - b.start_index);
    const parts = [];
    let lastIndex = 0;

    sorted.forEach((m, idx) => {
      if (m.start_index > lastIndex) parts.push(text.slice(lastIndex, m.start_index));
      if (m.mention_type === "tracking") {
        parts.push(<TrackingMentionCard key={`mnt-${idx}`} entityId={m.entity_id} displayText={m.display_text} />);
      } else if (m.mention_type === "staff") {
        parts.push(
          <span
            key={`mnt-${idx}`}
            className={`font-semibold rounded px-1 ${isOwn ? "bg-white/15 text-white" : "bg-blue-50 text-navy-700"}`}
          >
            {m.display_text}
          </span>
        );
      }
      lastIndex = m.end_index;
    });

    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return <div className="whitespace-pre-wrap break-words">{parts}</div>;
  };

  const handleSendTemplate = async () => {
    if (!activeConversation?.id) return;
    setSendingTemplate(true);
    try {
      const paramsArray = templateParams.split(",").map((p) => p.trim()).filter((p) => p);
      await axios.post(
        `${API_BASE_URL}/api/whatsapp/send-template`,
        { conversationId: activeConversation.id, templateName: selectedTemplate, params: paramsArray },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
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

  /* ───────────────────────── Empty state ───────────────────────── */
  if (!activeConversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-slate-50 p-6 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="h-16 w-16 rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm flex items-center justify-center mb-5"
        >
          <FiMessageSquare className="text-navy-700" size={26} />
        </motion.div>
        <h3 className="text-lg font-semibold text-slate-900">Your messages</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-xs">
          Pick a conversation on the left, or start a new one.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={onOpenNewChatModal}
            className="h-10 px-4 rounded-xl bg-navy-700 text-white text-sm font-medium flex items-center gap-2 hover:bg-navy-800 transition shadow-sm"
          >
            <FiPlus size={16} /> New conversation
          </button>
          <button
            onClick={() => onOpenTaskModal()}
            className="h-10 px-4 rounded-xl bg-white text-slate-700 ring-1 ring-slate-200 text-sm font-medium flex items-center gap-2 hover:bg-slate-50 transition"
          >
            <FiCheckSquare size={16} /> Create task
          </button>
        </div>
      </div>
    );
  }

  /* ───────────────────────── Derived values ───────────────────────── */
  const displayName = getDisplayName();
  const others = getOtherParticipants(activeConversation, currentUser.id);
  const isFunctionallyGroup = isGroupConversation(activeConversation, currentUser.id);
  const isWhatsApp = activeConversation.channel === "whatsapp";
  const avatarPhoto = getConversationPhoto(activeConversation, currentUser.id);
  const singleOther = !isFunctionallyGroup && !isWhatsApp ? others[0] : null;
  const isParticipantOnline = singleOther ? isUserOnline(singleOther.staff_id) : false;
  const onlineParticipants = others.filter((p) => isUserOnline(p.staff_id));
  const hasTasks = serviceInfo && serviceInfo.tasks && serviceInfo.tasks.length > 0;
  const showSenderNames = isFunctionallyGroup && !isWhatsApp;
  const typingList = typingUsers[activeConversation.id] || [];
  const windowClosed = isWhatsApp && !isWithinWindow;
  const inputDisabled = isUploading || windowClosed;
  const canSend = (newMessage.trim() || fileToUpload) && !inputDisabled;

  const participantNames = {};
  const participantPhotos = {};
  (activeConversation.participants || []).forEach((p) => {
    participantNames[String(p.staff_id)] = p.name;
    if (p.photo) participantPhotos[String(p.staff_id)] = getAvatarUrl(p.photo);
  });

  let subtitle;
  if (typingList.length > 0) {
    subtitle = (
      <span className="text-emerald-600">
        {showSenderNames ? `${typingList.map((u) => u.name).join(", ")} typing…` : "typing…"}
      </span>
    );
  } else if (isWhatsApp) {
    subtitle = <span className="flex items-center gap-1"><FiSmartphone size={11} /> {activeConversation.context_identifier || "WhatsApp"}</span>;
  } else if (isFunctionallyGroup) {
    subtitle = (
      <span className="truncate">
        {activeConversation.participants?.length || 0} members
        {onlineParticipants.length > 0 && ` · ${onlineParticipants.length} online`}
      </span>
    );
  } else {
    subtitle = (
      <span className="flex items-center gap-1 truncate">
        <span className={isParticipantOnline ? "text-emerald-600" : ""}>{isParticipantOnline ? "Online" : "Offline"}</span>
        {singleOther?.centre_name && (
          <>
            <span className="text-slate-300">·</span>
            <FiMapPin size={10} className="shrink-0" />
            <span className="truncate">{singleOther.centre_name}</span>
          </>
        )}
      </span>
    );
  }

  /* ───────────────────────── Render ───────────────────────── */
  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-white">
      {/* Header */}
      <div className="shrink-0 h-16 px-2 sm:px-4 flex items-center gap-2 border-b border-slate-200 bg-white">
        <button
          className="md:hidden h-9 w-9 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100"
          onClick={onBack}
          title="Back"
        >
          <FiChevronLeft size={22} />
        </button>

        <button
          onClick={() => onOpenDetails && onOpenDetails()}
          className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl px-1 py-1 hover:bg-slate-50 transition"
          title="View details"
        >
          <ChatAvatar
            name={displayName}
            photo={avatarPhoto}
            size="md"
            color={isWhatsApp ? "bg-emerald-600" : activeConversation.avatarColor || getAvatarColor(activeConversation.id)}
            isGroup={isFunctionallyGroup}
            icon={isWhatsApp ? FiSmartphone : undefined}
            online={singleOther ? isParticipantOnline : undefined}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[15px] font-semibold text-slate-900 truncate">{displayName}</h2>
              {activeConversation.context_type === "service_entry" && (
                <FiBriefcase className="shrink-0 text-violet-600" size={12} title="Service" />
              )}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 min-w-0">
              {subtitle}
              {serviceInfo?.applicationNumber && (
                <span className="hidden sm:inline text-slate-400 shrink-0">App #{serviceInfo.applicationNumber}</span>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-0.5 relative">
          {windowClosed && (
            <HeaderButton onClick={() => setShowTemplateModal(true)} title="Send template" className="bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100">
              <FiMessageSquare size={17} />
            </HeaderButton>
          )}
          <HeaderButton onClick={() => onOpenTaskModal()} title="Create task" className="hidden sm:flex">
            <FiCheckSquare size={17} />
          </HeaderButton>
          {hasTasks && (
            <HeaderButton onClick={() => setShowTasksModal(true)} title="View tasks" className="hidden sm:flex">
              <FiList size={17} />
            </HeaderButton>
          )}
          {onOpenDetails && (
            <HeaderButton onClick={onOpenDetails} title="Details" active={isDetailsOpen}>
              <FiInfo size={18} />
            </HeaderButton>
          )}

          <div ref={moreMenuRef} className="relative">
            <HeaderButton onClick={() => setIsMoreMenuOpen((o) => !o)} title="More">
              <FiMoreVertical size={18} />
            </HeaderButton>
            <AnimatePresence>
              {isMoreMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full right-0 mt-2 w-52 bg-white rounded-xl ring-1 ring-slate-200 shadow-lg z-50 overflow-hidden py-1"
                >
                  <MenuItem icon={FiCheckSquare} label="Create task" className="sm:hidden" onClick={() => { setIsMoreMenuOpen(false); onOpenTaskModal(); }} />
                  {hasTasks && (
                    <MenuItem icon={FiList} label="View tasks" className="sm:hidden" onClick={() => { setIsMoreMenuOpen(false); setShowTasksModal(true); }} />
                  )}
                  <MenuItem icon={FiUserPlus} label="Add people" onClick={() => setIsMoreMenuOpen(false)} />
                  <MenuItem icon={FiStar} label="Mark as favourite" onClick={() => setIsMoreMenuOpen(false)} />
                  {onOpenDetails && (
                    <MenuItem icon={FiInfo} label="View details" onClick={() => { setIsMoreMenuOpen(false); onOpenDetails(); }} />
                  )}
                  <div className="my-1 border-t border-slate-100" />
                  <MenuItem
                    icon={FiTrash2}
                    label="Delete conversation"
                    danger
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      if (onDeleteConversation) onDeleteConversation(activeConversation.id);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto bg-slate-50 chat-scroll"
        style={{ scrollbarWidth: "thin" }}
        onClick={() => setSelectedMsgId(null)}
      >
        <div className="px-3 sm:px-6 py-4 max-w-4xl mx-auto">
          {loadingChat ? (
            <div className="flex justify-center py-10">
              <div className="h-7 w-7 rounded-full border-2 border-slate-200 border-t-blue-800 animate-spin" />
            </div>
          ) : currentMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <div className="h-12 w-12 rounded-full bg-white ring-1 ring-slate-200 flex items-center justify-center mb-3">
                <FiMessageSquare className="text-slate-400" size={20} />
              </div>
              <p className="text-sm font-medium text-slate-700">No messages yet</p>
              <p className="text-xs text-slate-500 mt-1">Say hello 👋</p>
            </div>
          ) : (
            currentMessages.map((msg, index) => {
              const prevMsg = currentMessages[index - 1];
              const msgDate = toDate(msg.createdAt);
              const showDaySeparator = !prevMsg || !isSameDay(msgDate, toDate(prevMsg.createdAt));

              const messageKey = msg.isOptimistic ? `opt-${msg.tempId || msg.id}-${index}` : `msg-${msg.id}`;
              const isTaskMessage = msg.isSystem && msg.fileName && !isNaN(Number(msg.fileName)) && serviceEntryId;
              const isNewTaskMessage = msg.messageType === "task";
              const isSystemNote = msg.isSystem && !isTaskMessage && !isNewTaskMessage;

              const isFirstInRun =
                showDaySeparator ||
                !prevMsg ||
                String(prevMsg.senderId) !== String(msg.senderId) ||
                prevMsg.isSystem ||
                prevMsg.messageType === "task" ||
                prevMsg.sender_type !== msg.sender_type;

              const isOwn = msg.isCurrentUser;
              const senderLabel = participantNames[String(msg.senderId)] || msg.sender || "Unknown";
              const senderPhoto = msg.sender_type !== "customer" ? participantPhotos[String(msg.senderId)] : null;
              const selected = selectedMsgId === msg.id;

              let body;

              if (isTaskMessage) {
                body = (
                  <div className="w-full flex justify-center">
                    <TaskMessage
                      taskId={msg.fileName}
                      text={msg.text}
                      taskData={serviceInfo?.tasks?.find((t) => String(t.id) === String(msg.fileName))}
                      onStatusUpdate={onTaskStatusUpdate}
                    />
                  </div>
                );
              } else if (isNewTaskMessage) {
                const task =
                  msg.live_task_data || msg.data || allTasks.find((t) => String(t.id) === String(msg.text));
                body = task ? (
                  <div className={`w-full flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <NormalTaskMessage taskId={task.id} taskData={task} onStatusUpdate={onNormalTaskStatusUpdate} />
                  </div>
                ) : null;
              } else if (isSystemNote) {
                body = (
                  <div className="w-full flex justify-center">
                    <span className="max-w-[85%] text-center text-xs text-slate-600 bg-white/90 ring-1 ring-slate-200 rounded-xl px-3 py-1.5 shadow-sm whitespace-pre-wrap">
                      {msg.text}
                    </span>
                  </div>
                );
              } else {
                const isImage = msg.messageType === "image" && msg.fileUrl && !msg.isDeleted;
                body = (
                  <div className={`w-full flex ${isOwn ? "justify-end" : "justify-start"} group`}>
                    <div className={`relative flex items-end gap-2 max-w-[88%] sm:max-w-[75%] lg:max-w-[65%] ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
                      {/* Avatar (groups only, first message of a run) */}
                      {!isOwn && showSenderNames && (
                        <div className="w-8 shrink-0 self-start">
                          {isFirstInRun && (
                            <ChatAvatar
                              name={senderLabel}
                              photo={senderPhoto}
                              size="sm"
                              color="bg-slate-400"
                              online={isUserOnline(msg.senderId) ? true : undefined}
                            />
                          )}
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMsgId((id) => (id === msg.id ? null : msg.id));
                        }}
                        className={`relative min-w-0 px-3.5 py-2 text-[14px] leading-relaxed shadow-sm ${
                          isOwn
                            ? `bg-navy-700 text-white rounded-2xl ${isFirstInRun ? "rounded-tr-md" : ""}`
                            : `bg-white text-slate-800 ring-1 ring-slate-200/80 rounded-2xl ${isFirstInRun ? "rounded-tl-md" : ""}`
                        } ${msg.isOptimistic ? "opacity-70" : ""} ${selected ? "ring-2 ring-blue-300" : ""}`}
                      >
                        {showSenderNames && !isOwn && isFirstInRun && (
                          <p className={`text-xs font-semibold mb-0.5 ${getSenderNameColor(msg.senderId)}`}>{senderLabel}</p>
                        )}

                        {msg.isDeleted ? (
                          <p className={`italic ${isOwn ? "text-blue-100" : "text-slate-400"}`}>This message was deleted</p>
                        ) : msg.isFile ? (
                          isImage ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(fullFileUrl(msg.fileUrl), "_blank");
                              }}
                              className="block -mx-1.5 -mt-0.5"
                            >
                              <img
                                src={fullFileUrl(msg.fileUrl)}
                                alt={msg.fileName || "Image"}
                                className="max-h-64 w-auto max-w-full rounded-xl object-cover"
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                              />
                              {msg.fileName && <p className="mt-1 px-1.5 text-[11px] opacity-70 truncate text-left">{msg.fileName}</p>}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (msg.fileUrl) window.open(fullFileUrl(msg.fileUrl), "_blank");
                              }}
                              className={`flex items-center gap-3 rounded-xl p-2 -mx-1.5 text-left transition ${
                                isOwn ? "bg-white/10 hover:bg-white/15" : "bg-slate-50 hover:bg-slate-100"
                              }`}
                            >
                              <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${isOwn ? "bg-white/15" : "bg-white ring-1 ring-slate-200 text-slate-500"}`}>
                                {msg.messageType === "image" ? <FiImage size={18} /> : <FiFile size={18} />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate max-w-[180px]">{msg.fileName || "File"}</p>
                                <p className="text-[11px] opacity-70">
                                  {msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : msg.isOptimistic ? "Uploading…" : "Download"}
                                </p>
                              </div>
                              <FiDownload size={15} className="shrink-0 opacity-70" />
                            </button>
                          )
                        ) : (
                          renderMessageTextWithMentions(msg.text, msg.mentions, isOwn)
                        )}

                        <div className={`flex items-center justify-end gap-1 mt-0.5 -mb-0.5 text-[10.5px] ${isOwn ? "text-blue-100" : "text-slate-400"}`}>
                          <span>{msg.time}</span>
                          {renderMessageStatus(msg)}
                        </div>
                      </div>

                      {/* Actions: hover on desktop, tap bubble on mobile */}
                      {!msg.isOptimistic && !msg.isDeleted && msg.messageType === "text" && (
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 transition-opacity ${isOwn ? "right-full mr-1.5" : "left-full ml-1.5"} ${
                            selected ? "opacity-100" : "opacity-0 pointer-events-none md:pointer-events-auto md:group-hover:opacity-100"
                          }`}
                        >
                          <MessageAction onClick={() => handleConvertToNote(msg)} title="Save as note" hover="hover:text-amber-500">
                            <FiStar size={12} />
                          </MessageAction>
                          <MessageAction onClick={() => { setSelectedMsgId(null); onOpenTaskModal(msg.text); }} title="Create task" hover="hover:text-emerald-600">
                            <FiCheckSquare size={12} />
                          </MessageAction>
                          {isOwn && (
                            <MessageAction onClick={() => { setSelectedMsgId(null); onDeleteMessage(msg.id, activeConversation.id); }} title="Delete" hover="hover:text-rose-500">
                              <FiTrash2 size={12} />
                            </MessageAction>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (!body) return null;

              return (
                <React.Fragment key={messageKey}>
                  {showDaySeparator && <DaySeparator label={formatDayLabel(msgDate)} />}
                  <motion.div
                    id={`msg-${msg.id}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={isFirstInRun ? "mt-3" : "mt-0.5"}
                  >
                    {body}
                  </motion.div>
                </React.Fragment>
              );
            })
          )}

          {/* Typing bubble */}
          {typingList.length > 0 && (
            <div className="flex justify-start mt-3">
              <div className="bg-white ring-1 ring-slate-200 rounded-2xl rounded-tl-md px-3 py-2 shadow-sm flex items-center gap-2">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
                {showSenderNames && <span className="text-xs text-slate-500">{typingList.map((u) => u.name).join(", ")}</span>}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div
        className="shrink-0 relative bg-white border-t border-slate-200 px-2 sm:px-4 pt-2"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {windowClosed && (
          <div className="mb-2 flex items-center gap-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3 py-2">
            <FiAlertCircle className="text-amber-600 shrink-0" size={16} />
            <p className="flex-1 text-xs text-amber-800">
              The 24-hour reply window has closed. Send a template message to reopen the chat.
            </p>
            <button
              onClick={() => setShowTemplateModal(true)}
              className="shrink-0 h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition"
            >
              Send template
            </button>
          </div>
        )}

        {fileToUpload && (
          <div className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-white ring-1 ring-slate-200 flex items-center justify-center text-slate-500">
              {fileToUpload.type?.startsWith("image/") ? <FiImage size={16} /> : <FiFile size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{fileToUpload.name}</p>
              <p className="text-[11px] text-slate-500">{(fileToUpload.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              onClick={() => {
                setFileToUpload(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white"
              disabled={isUploading}
              title="Remove"
            >
              <FiX size={16} />
            </button>
          </div>
        )}

        {isUploading && fileToUpload && (
          <div className="mb-2">
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <motion.div className="h-full bg-navy-700" initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {/* Mention suggestions */}
        {mentionQuery && mentionResults.length > 0 && (
          <div className="absolute bottom-full left-2 right-2 sm:left-4 sm:right-auto sm:w-72 mb-2 bg-white rounded-xl ring-1 ring-slate-200 shadow-xl overflow-hidden z-50">
            <p className="px-3 py-2 text-[11px] font-medium text-slate-400 border-b border-slate-100">Mention someone</p>
            {mentionResults.map((staff) => (
              <button
                key={staff.id}
                onClick={() => handleSelectMention(staff)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition text-left"
              >
                <ChatAvatar name={staff.name} size="sm" color={getAvatarColor(staff.id)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{staff.name}</p>
                  <p className="text-[11px] text-slate-500 truncate capitalize">{staff.role}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div
            className={`flex-1 min-w-0 flex items-end gap-0.5 rounded-3xl px-1.5 py-1 transition ring-1 ${
              inputDisabled ? "bg-slate-50 ring-slate-100" : "bg-slate-100 ring-transparent focus-within:bg-white focus-within:ring-slate-300"
            }`}
          >
            <div className="relative" ref={emojiPickerRef}>
              <button
                onClick={() => setIsEmojiPickerOpen((o) => !o)}
                disabled={inputDisabled}
                className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:text-navy-700 hover:bg-white transition disabled:opacity-40"
                title="Emoji"
              >
                <FaRegSmile size={19} />
              </button>
              <AnimatePresence>
                {isEmojiPickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    className="absolute bottom-full left-0 mb-3 z-50"
                  >
                    <EmojiPicker
                      onEmojiClick={handleEmojiSelect}
                      width={typeof window !== "undefined" ? Math.min(320, window.innerWidth - 24) : 320}
                      height={380}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <textarea
              id="chat-message-input"
              ref={chatInputRef}
              rows={1}
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={windowClosed ? "Reply window closed — send a template" : "Message"}
              disabled={inputDisabled}
              className="flex-1 min-w-0 resize-none bg-transparent border-0 focus:ring-0 focus:outline-none text-[15px] leading-6 text-slate-800 placeholder:text-slate-400 py-1.5 px-1 max-h-[140px] disabled:cursor-not-allowed"
            />

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={inputDisabled}
              className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:text-navy-700 hover:bg-white transition disabled:opacity-40"
              title="Attach file"
            >
              <FiPaperclip size={18} />
            </button>
          </div>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleSendMessage}
            disabled={!canSend}
            className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center transition shadow-sm ${
              canSend ? "bg-navy-700 text-white hover:bg-navy-800" : "bg-slate-200 text-slate-400"
            }`}
            title="Send"
          >
            <FiSend size={18} className="-ml-0.5" />
          </motion.button>
        </div>
      </div>

      {/* Tasks modal */}
      {showTasksModal && serviceInfo && (
        <ModalShell title="Service tasks" onClose={() => setShowTasksModal(false)}>
          {serviceInfo.tasks.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No tasks for this service.</p>
          ) : (
            <div className="space-y-2">
              {serviceInfo.tasks.map((task) => (
                <div key={task.id} className="rounded-xl ring-1 ring-slate-200 p-3">
                  <h4 className={`text-sm font-medium ${task.status === "completed" ? "line-through text-slate-400" : "text-slate-900"}`}>
                    {task.title}
                  </h4>
                  {task.description && <p className="text-xs text-slate-600 mt-1">{task.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-500">
                    {task.assigned_to_name && <span className="flex items-center gap-1"><FiUser size={10} /> {task.assigned_to_name}</span>}
                    {task.due_date && <span className="flex items-center gap-1"><FiClock size={10} /> {formatDate(task.due_date)}</span>}
                    <span
                      className={`px-1.5 py-0.5 rounded font-medium capitalize ${
                        task.priority === "high"
                          ? "bg-rose-50 text-rose-700"
                          : task.priority === "medium"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {task.priority}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-medium ${
                        task.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : task.status === "in_progress"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {task.status === "in_progress" ? "In progress" : task.status === "completed" ? "Completed" : "Pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ModalShell>
      )}

      {/* WhatsApp template modal */}
      {showTemplateModal && (
        <ModalShell
          title="Send WhatsApp template"
          onClose={() => setShowTemplateModal(false)}
          footer={
            <>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="h-9 px-4 rounded-lg text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTemplate}
                disabled={sendingTemplate}
                className="h-9 px-4 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {sendingTemplate ? "Sending…" : "Send"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Template</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full h-10 rounded-lg bg-slate-50 border border-slate-200 px-3 text-sm focus:outline-none focus:ring-4 focus:ring-blue-50"
              >
                {/* Abstract keys — backend maps them per centre */}
                <option value="reengagement_message">Re-engagement (auto-mapped)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Parameters (comma separated)</label>
              <input
                type="text"
                value={templateParams}
                onChange={(e) => setTemplateParams(e.target.value)}
                placeholder="e.g. John, APP-123"
                className="w-full h-10 rounded-lg bg-white border border-slate-200 px-3 text-sm focus:outline-none focus:ring-4 focus:ring-blue-50"
              />
              <p className="text-[11px] text-slate-400 mt-1">Example: customer name, application ID</p>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};

const MenuItem = ({ icon: Icon, label, onClick, danger, className = "" }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 w-full px-3.5 py-2.5 text-sm transition ${
      danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50"
    } ${className}`}
  >
    <Icon size={15} className={danger ? "" : "text-slate-400"} />
    {label}
  </button>
);

export default Chat;