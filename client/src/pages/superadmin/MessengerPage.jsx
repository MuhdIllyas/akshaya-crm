import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSend,
  FiPaperclip,
  FiSearch,
  FiMoreVertical,
  FiBell,
  FiMenu,
  FiX,
  FiFile,
  FiChevronLeft,
  FiPlus,
  FiMic,
  FiVideo as FiVideoCall,
  FiPhoneCall,
  FiUserPlus,
  FiStar,
  FiInfo,
  FiTrash2,
  FiMail,
  FiUser,
  FiBriefcase,
  FiCalendar,
  FiMapPin,
  FiCheckSquare,
  FiCheck,
  FiMessageSquare,
  FiActivity,
  FiClock,
  FiGrid,
  FiDownload,
  FiPlusCircle,
  FiList,
  FiFilter,
  FiRepeat,
  FiGlobe,
  FiHome,
  FiEdit,
  FiPause,
  FiPlay,
  FiUsers,
  FiHeart,
  FiCoffee,
  FiRefreshCw,
  FiAlertCircle,
  FiImage,
  FiChevronRight, FiLayout,
  FiSmartphone, FiPlayCircle
} from "react-icons/fi";
import { FaRegSmile, FaEllipsisH } from "react-icons/fa";
import { IoMdCheckmarkCircle, IoMdClose } from "react-icons/io";
import { BsCircleFill } from "react-icons/bs";
import { toast } from "react-toastify";
import FilesView from "@/components/chat/FilesView";
import CalendarView from "@/components/CalendarView";
import ActivityPanel from "@/components/ActivityPanel";
import EmojiPicker from 'emoji-picker-react';
import Chat from '@/components/Chat';
import { socket } from "@/services/socket";
import { useLocation } from "react-router-dom";

// ============== NEW CHAT MODAL (Grouped by Centre) ==============
const NewChatModal = ({ isOpen, onClose, onCreate, staffList, centresMap }) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [chatType, setChatType] = useState('internal');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');

  if (!isOpen) return null;

  const filteredStaff = staffList.filter(staff =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedStaff = filteredStaff.reduce((acc, staff) => {
    const cName = staff.centre_name || centresMap?.[staff.centre_id] || (staff.centre_id ? `Centre ${staff.centre_id}` : 'Other Staff');
    if (!acc[cName]) acc[cName] = [];
    acc[cName].push(staff);
    return acc;
  }, {});

  const sortedCentres = Object.keys(groupedStaff).sort();

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    if (chatType === 'internal') {
      await onCreate(selectedUsers, isGroup ? groupName : null, 'internal');
    } else {
      if (!phoneNumber.trim()) {
        toast.error('Phone number is required for WhatsApp chat');
        setIsCreating(false);
        return;
      }
      await onCreate(null, null, 'whatsapp', phoneNumber, customerName);
    }
    handleClose();
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setGroupName('');
    setIsGroup(false);
    setSearchTerm('');
    setChatType('internal');
    setPhoneNumber('');
    setCustomerName('');
    setIsCreating(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/60"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 pb-0 bg-gradient-to-br from-white to-slate-50/50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">New Conversation</h3>
            <button onClick={handleClose} disabled={isCreating} className="p-2 rounded-full hover:bg-slate-100 transition text-slate-400 hover:text-slate-600">
              <IoMdClose size={20} />
            </button>
          </div>

          <div className="space-y-4 mb-4">
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
              <button type="button" onClick={() => setChatType('internal')} disabled={isCreating} className={`flex-1 py-2 rounded-lg transition-all text-sm font-semibold ${chatType === 'internal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Internal</button>
              <button type="button" onClick={() => setChatType('whatsapp')} disabled={isCreating} className={`flex-1 py-2 rounded-lg transition-all text-sm font-semibold flex items-center justify-center gap-1.5 ${chatType === 'whatsapp' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><FiSmartphone size={14}/> WhatsApp</button>
            </div>

            {chatType === 'internal' && (
              <>
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                  <button type="button" onClick={() => setIsGroup(false)} disabled={isCreating} className={`flex-1 py-1.5 rounded-lg transition-all text-sm font-semibold ${!isGroup ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Direct</button>
                  <button type="button" onClick={() => setIsGroup(true)} disabled={isCreating} className={`flex-1 py-1.5 rounded-lg transition-all text-sm font-semibold ${isGroup ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Group</button>
                </div>

                {isGroup && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Group Name</label>
                    <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm" placeholder="Enter group name" disabled={isCreating} />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Search Staff</label>
                  <div className="relative">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm" placeholder="Search by name or role..." disabled={isCreating} />
                  </div>
                </div>
              </>
            )}

            {chatType === 'whatsapp' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Phone Number *</label>
                  <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white outline-none transition text-sm" placeholder="+1234567890" disabled={isCreating} />
                  <p className="text-xs text-slate-400 mt-1.5">Include country code (e.g., +1 for US)</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Customer Name (Optional)</label>
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white outline-none transition text-sm" placeholder="John Doe" disabled={isCreating} />
                </div>
              </>
            )}
          </div>
        </div>

        {chatType === 'internal' && (
          <div className="px-6 pb-2 flex-1 overflow-hidden flex flex-col">
            <label className="block text-xs font-semibold text-slate-600 mb-2 flex-shrink-0 uppercase tracking-wider">
              Select Participants <span className="text-indigo-600">({selectedUsers.length})</span>
            </label>
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl custom-scrollbar bg-white min-h-[150px]">
              {sortedCentres.length > 0 ? (
                sortedCentres.map(centreName => {
                  const members = groupedStaff[centreName];
                  const centreStaffIds = members.map(m => m.id);
                  const allSelected = centreStaffIds.every(id => selectedUsers.includes(id));

                  return (
                    <div key={centreName} className="mb-0 border-b border-slate-100 last:border-0">
                      <div className="bg-slate-50/80 px-3 py-2 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{centreName}</span>
                        <div className="flex items-center gap-2">
                          {isGroup && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                if (allSelected) {
                                  setSelectedUsers(selectedUsers.filter(id => !centreStaffIds.includes(id)));
                                } else {
                                  const newSelection = new Set([...selectedUsers, ...centreStaffIds]);
                                  setSelectedUsers(Array.from(newSelection));
                                }
                              }}
                              className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 font-semibold transition"
                            >
                              {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                          )}
                          <span className="text-[10px] text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full font-bold">{members.length}</span>
                        </div>
                      </div>
                      <div>
                        {members.map(staff => (
                          <label key={staff.id} className={`flex items-center p-3 hover:bg-indigo-50/40 cursor-pointer border-b border-slate-50 last:border-0 transition ${isCreating ? 'opacity-50 pointer-events-none' : ''}`}>
                            <input
                              type={isGroup ? "checkbox" : "radio"}
                              name="participantSelection"
                              checked={selectedUsers.includes(staff.id)}
                              onChange={(e) => {
                                if (isGroup) {
                                  if (e.target.checked) setSelectedUsers([...selectedUsers, staff.id]);
                                  else setSelectedUsers(selectedUsers.filter(id => id !== staff.id));
                                } else {
                                  setSelectedUsers([staff.id]);
                                }
                              }}
                              disabled={isCreating}
                              className={`w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 mr-3 ${isGroup ? 'rounded' : ''}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 text-sm truncate">{staff.name}</p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{staff.role || 'Staff'}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                  <FiUsers size={24} className="mb-2 text-slate-300" />
                  <p className="text-sm">No staff members found</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-5 pt-4 flex justify-end gap-3 border-t border-slate-100 flex-shrink-0 mt-auto bg-slate-50/50">
          <button onClick={handleClose} disabled={isCreating} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium disabled:opacity-50 text-sm rounded-lg hover:bg-slate-100 transition">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={
              (chatType === 'internal' && (selectedUsers.length === 0 || (isGroup && !groupName))) ||
              (chatType === 'whatsapp' && !phoneNumber.trim()) ||
              isCreating
            }
            className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-800 transition disabled:opacity-50 flex items-center gap-2 shadow-md shadow-indigo-500/20 text-sm"
          >
            {isCreating ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Creating...</> : 'Create Chat'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============== MAIN MESSENGER PAGE ==============
const MessengerPage = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");

  let decodedPayload = null;
  if (token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      decodedPayload = JSON.parse(window.atob(base64));
    } catch (err) {
      console.error("Could not decode token", err);
    }
  }

  const currentUser = {
    role: user?.role || decodedPayload?.role || localStorage.getItem("role") || "staff",
    id: user?.id || decodedPayload?.id || 1,
    centreId: user?.centre_id || decodedPayload?.centre_id || localStorage.getItem("centreId") || null,
    name: user?.name || decodedPayload?.username || "Current User",
    username: user?.username || decodedPayload?.username || ""
  };

  const [activeView, setActiveView] = useState("chats");
  const [activeConversation, setActiveConversation] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const [conversationNotes, setConversationNotes] = useState([]);
  const [isQuickNoteModalOpen, setIsQuickNoteModalOpen] = useState(false);
  const [quickNoteForm, setQuickNoteForm] = useState({ title: "", content: "" });

  const [taskFilter, setTaskFilter] = useState("all");
  const [taskViewMode, setTaskViewMode] = useState("board");
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState({});
  const [staffList, setStaffList] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [socketConnected, setSocketConnected] = useState(false);

  const [serviceDetails, setServiceDetails] = useState(null);
  const [loadingServiceDetails, setLoadingServiceDetails] = useState(false);

  const lastMessageIdsRef = useRef(new Set());
  const typingTimeoutRef = useRef(null);
  const processedMessageIds = useRef(new Set());

  const [calendarData, setCalendarData] = useState([]);
  const [leavesData, setLeavesData] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({
    date: "",
    type: "working",
    description: ""
  });

  const [centres, setCentres] = useState([]);
  const [centresMap, setCentresMap] = useState({});
  const [centresLoading, setCentresLoading] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

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

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assignee: "",
    dueDate: "",
    priority: "medium"
  });

  const [templateForm, setTemplateForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    isRecurring: true,
    recurrenceType: "weekly",
    recurrenceInterval: 1,
    recurrenceDay: 1,
    recurrenceDate: 1,
    assignmentMode: "centre_admin",
    specificAssignee: "",
    dueOffsetDays: 0,
    isGlobal: false,
    isActive: true
  });

  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);

  // ============== UNREAD COUNTS API FUNCTIONS ==============

  const fetchAllUnreadCounts = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/unread/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch unread counts');
      const unreadMap = await res.json();
      setConversations(prev => prev.map(conv => ({
        ...conv,
        unread: unreadMap[conv.id] || 0
      })));
    } catch (err) {
      console.error('Error fetching unread counts:', err);
    }
  };

  const fetchConversationUnreadCount = async (conversationId) => {
    if (!token) return 0;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/unread/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch unread count');
      const data = await res.json();
      return data.unread;
    } catch (err) {
      console.error('Error fetching conversation unread count:', err);
      return 0;
    }
  };

  useEffect(() => {
    if (activeConversation?.id) {
      fetch(`${API_BASE_URL}/api/notes/conversation/${activeConversation.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : [])
        .then(data => setConversationNotes(data))
        .catch(err => console.error("Failed to fetch notes", err));
    } else {
      setConversationNotes([]);
    }

    if (activeConversation?.context_type === 'service_entry' && activeConversation.context_id) {
      setLoadingServiceDetails(true);
      fetch(`${API_BASE_URL}/api/servicecollaboration/${activeConversation.context_id}/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          setServiceDetails(data);
          setLoadingServiceDetails(false);
        })
        .catch(err => {
          console.error("Failed to fetch service details", err);
          setLoadingServiceDetails(false);
        });
    } else {
      setServiceDetails(null);
    }
  }, [activeConversation?.id, token, API_BASE_URL]);

  // ============== SOCKET.IO INTEGRATION ==============
  useEffect(() => {
    if (!token) return;

    const handleConnect = () => {
      console.log("Messenger socket connected");
      setSocketConnected(true);
      if (activeConversation) {
        socket.emit("join_conversation", activeConversation.id);
      }
    };

    const handleOnlineUsers = (users) => {
      const stringUsers = users.map(user => String(user));
      setOnlineUsers(new Set(stringUsers));
    };

    const handleDisconnect = () => {
      console.log("Socket disconnected");
      setSocketConnected(false);
    };

    const handleConnectError = (err) => {
      console.error("Socket connection error:", err);
      toast.error("Realtime connection lost. Messages may be delayed.");
    };

    const handleNewMessage = (msg) => {
      const conversationId = msg.conversation_id;

      if (processedMessageIds.current.has(msg.id)) return;
      processedMessageIds.current.add(msg.id);

      setTimeout(() => {
        processedMessageIds.current.delete(msg.id);
      }, 60000);

      setMessages(prev => {
        const currentMessages = prev[conversationId] || [];
        if (currentMessages.some(m => m.id === msg.id)) return prev;

        const filteredMessages = currentMessages.filter(m => {
          if (!m.isOptimistic) return true;
          const sameSender = String(msg.sender_id) === String(currentUser.id);
          const sameText = m.text === msg.message;
          if (sameSender && sameText) return false;
          return true;
        });

        let senderName = msg.sender_name;
        if (msg.sender_type === 'customer') {
          senderName = senderName || 'Customer';
        } else if (String(msg.sender_id) === String(currentUser.id)) {
          senderName = 'You';
        } else {
          senderName = senderName || 'Unknown';
        }

        const formattedMsg = {
          id: msg.id,
          sender: senderName,
          senderId: msg.sender_id,
          text: msg.message,
          time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: msg.created_at,
          isFile: msg.message_type === 'file' || msg.message_type === 'image',
          fileName: msg.file_name,
          fileUrl: msg.file_url,
          fileSize: msg.file_size,
          messageType: msg.message_type,
          isDeleted: msg.is_deleted,
          isCurrentUser: String(msg.sender_id) === String(currentUser.id),
          is_read_by_me: String(msg.sender_id) === String(currentUser.id),
          isOptimistic: false,
          isSystem: msg.sender_type === 'system',
          sender_type: msg.sender_type,
          live_task_data: msg.live_task_data || null,
          mentions: msg.mentions || []
        };

        return {
          ...prev,
          [conversationId]: [...filteredMessages, formattedMsg]
        };
      });

      setConversations(prev => {
        const updated = prev.map(conv =>
          conv.id === conversationId
            ? {
              ...conv,
              last_message: msg.message || (msg.file_name ? 'Sent a file' : ''),
              lastMessage: msg.message || (msg.file_name ? 'Sent a file' : ''),
              last_message_at: msg.created_at,
              time: msg.created_at,
              last_message_sender_id: msg.sender_id,
              last_message_sender: msg.sender_type === 'customer' ? (msg.sender_name || 'Customer') : msg.sender_name,
            }
            : conv
        );
        return updated.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
      });

      if (conversationId === activeConversation?.id && String(msg.sender_id) !== String(currentUser.id) && socket.connected) {
        socket.emit("mark_read", {
          messageIds: [msg.id],
          conversationId
        });
      } else if (String(msg.sender_id) !== String(currentUser.id)) {
        fetchConversationUnreadCount(conversationId).then(unreadCount => {
          setConversations(prev => prev.map(conv =>
            conv.id === conversationId ? { ...conv, unread: unreadCount } : conv
          ));
        });
      }
    };

    const handleConversationUpdated = (data) => {
      console.log("📥 [Frontend] RECEIVED conversation update", data);
      setConversations(prev => {
        const exists = prev.some(c => String(c.id) === String(data.conversationId));
        if (!exists) {
          fetchConversations();
          return prev;
        }
        const updated = prev.map(conv =>
          String(conv.id) === String(data.conversationId)
            ? {
              ...conv,
              last_message: data.lastMessage,
              lastMessage: data.lastMessage,
              last_message_sender_id: data.lastMessageSenderId,
              last_message_sender: data.lastMessageSender,
              last_message_at: data.time,
              time: data.time,
              unread: data.unread !== undefined ? data.unread : conv.unread
            }
            : conv
        );
        return updated.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
      });
    };

    const handleTyping = (data) => {
      setTypingUsers(prev => {
        const currentTyping = prev[data.conversationId] || [];
        if (data.isTyping) {
          if (data.userId !== currentUser.id && !currentTyping.some(u => u.userId === data.userId)) {
            return {
              ...prev,
              [data.conversationId]: [...currentTyping, { name: data.userName, userId: data.userId }]
            };
          }
        } else {
          if (currentTyping.some(u => u.userId === data.userId)) {
            return {
              ...prev,
              [data.conversationId]: currentTyping.filter(u => u.userId !== data.userId)
            };
          }
        }
        return prev;
      });

      if (data.isTyping && data.userId !== currentUser.id) {
        setTimeout(() => {
          setTypingUsers(prev => {
            const currentTyping = prev[data.conversationId] || [];
            if (currentTyping.some(u => u.userId === data.userId)) {
              return {
                ...prev,
                [data.conversationId]: currentTyping.filter(u => u.userId !== data.userId)
              };
            }
            return prev;
          });
        }, 5000);
      }
    };

    const handleMessagesRead = (data) => {
      if (data.conversationId === activeConversation?.id) {
        setMessages(prev => ({
          ...prev,
          [data.conversationId]: prev[data.conversationId]?.map(msg =>
            data.messageIds.includes(msg.id) ? { ...msg, is_read_by_me: true } : msg
          )
        }));
      }
      fetchAllUnreadCounts();
    };

    const handleUnreadUpdate = (data) => {
      console.log("📥 [Frontend] RECEIVED unread_update", data);
      if (data.unread !== undefined) {
        setConversations(prev => prev.map(conv =>
          String(conv.id) === String(data.conversationId) ? { ...conv, unread: data.unread } : conv
        ));
      }
    };

    const handleUserOnline = (data) => {
      setOnlineUsers(prev => new Set([...prev, String(data.userId)]));
    };

    const handleUserOffline = (data) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(String(data.userId));
        return newSet;
      });
    };

    const handleNewConversation = (newConv) => {
      setConversations(prev => {
        if (!prev.some(c => c.id === newConv.id)) {
          return [{
            ...newConv,
            name: newConv.name || 'New Chat',
            avatarColor: getAvatarColor(newConv.id),
            unread: 0
          }, ...prev];
        }
        return prev;
      });
    };

    const handleAddedToConversation = (conversation) => {
      setConversations(prev => {
        if (!prev.some(c => c.id === conversation.id)) {
          return [{
            ...conversation,
            name: conversation.name || 'New Chat',
            avatarColor: getAvatarColor(conversation.id),
            unread: 0
          }, ...prev];
        }
        return prev;
      });
      toast.info(`You were added to a new conversation`);
    };

    const handleMessageDeleted = (data) => {
      if (data.conversationId === activeConversation?.id) {
        setMessages(prev => ({
          ...prev,
          [data.conversationId]: prev[data.conversationId]?.map(msg =>
            msg.id === data.messageId ? { ...msg, isDeleted: true, text: 'This message was deleted' } : msg
          )
        }));
      }
      fetchConversations();
    };

    const handleConversationDeleted = (data) => {
      setConversations(prev => prev.filter(c => String(c.id) !== String(data.conversationId)));
      setActiveConversation(prevActive => {
        if (prevActive && String(prevActive.id) === String(data.conversationId)) return null;
        return prevActive;
      });
    };

    socket.on("connect", handleConnect);
    socket.on("online_users", handleOnlineUsers);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("new_message", handleNewMessage);
    socket.on("conversation_updated", handleConversationUpdated);
    socket.on("typing", handleTyping);
    socket.on("messages_read", handleMessagesRead);
    socket.on("unread_update", handleUnreadUpdate);
    socket.on("user_online", handleUserOnline);
    socket.on("user_offline", handleUserOffline);
    socket.on("new_conversation", handleNewConversation);
    socket.on("added_to_conversation", handleAddedToConversation);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("conversation_deleted", handleConversationDeleted);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("online_users", handleOnlineUsers);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("new_message", handleNewMessage);
      socket.off("conversation_updated", handleConversationUpdated);
      socket.off("typing", handleTyping);
      socket.off("messages_read", handleMessagesRead);
      socket.off("unread_update", handleUnreadUpdate);
      socket.off("user_online", handleUserOnline);
      socket.off("user_offline", handleUserOffline);
      socket.off("new_conversation", handleNewConversation);
      socket.off("added_to_conversation", handleAddedToConversation);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("conversation_deleted", handleConversationDeleted);
    };
  }, [token, currentUser.id, currentUser.centreId, activeConversation]);

  // 🔥 Catch incoming navigation from Notifications
  useEffect(() => {
    if (!location.state) return;

    if (location.state.openTasksView) {
      setActiveView("tasks");
      window.history.replaceState({}, document.title);
      return;
    }

    if (location.state.openConversationId && conversations.length > 0) {
      const targetConvId = location.state.openConversationId;
      const chatToOpen = conversations.find(c => c.id === targetConvId);

      if (chatToOpen) {
        setActiveView("chats");
        setActiveConversation(chatToOpen);
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, conversations]);

  // ============== CHAT API INTEGRATION ==============

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data = await res.json();

      const processedData = data.map(conv => ({
        ...conv,
        id: conv.id,
        name: conv.name || null,
        is_group: conv.is_group || false,
        channel: conv.channel || 'internal',
        context_type: conv.context_type,
        context_id: conv.context_id,
        context_name: conv.context_name,
        context_identifier: conv.context_identifier,
        last_message: conv.last_message,
        lastMessage: conv.last_message,
        last_message_at: conv.last_message_at,
        time: conv.last_message_at,
        last_message_sender_id: conv.last_message_sender_id,
        last_message_sender: conv.last_message_sender,
        participants: conv.participants || [],
        unread: conv.unread || 0,
        avatarColor: getAvatarColor(conv.id)
      }));

      const sorted = processedData.sort((a, b) =>
        new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)
      );

      setConversations(sorted);
      fetchAllUnreadCounts();
    } catch (err) {
      console.error('Error fetching conversations:', err);
      toast.error('Failed to load conversations');
    }
  };

  const fetchMessages = async (conversationId) => {
    setLoadingChat(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();

      lastMessageIdsRef.current.clear();

      const formattedMessages = data.map(msg => {
        const isCurrentUser = String(msg.sender_id) === String(currentUser.id);
        let senderName = msg.sender_name;
        if (msg.sender_type === 'customer') {
          senderName = senderName || 'Customer';
        } else if (isCurrentUser) {
          senderName = 'You';
        } else {
          senderName = senderName || 'Unknown User';
        }
        return {
          id: msg.id,
          sender: senderName,
          senderId: msg.sender_id,
          text: msg.text,
          time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: msg.created_at,
          isFile: msg.type === 'file' || msg.type === 'image',
          fileName: msg.file_name,
          fileUrl: msg.file_url,
          fileSize: msg.file_size,
          messageType: msg.type,
          isDeleted: msg.is_deleted,
          isCurrentUser: isCurrentUser,
          is_read_by_me: msg.is_read_by_me || isCurrentUser,
          isOptimistic: false,
          isSystem: msg.sender_type === 'system',
          sender_type: msg.sender_type,
          live_task_data: msg.live_task_data || null,
          mentions: msg.mentions || []
        };
      });

      setMessages(prev => ({
        ...prev,
        [conversationId]: formattedMessages || []
      }));

      formattedMessages.forEach(msg => {
        processedMessageIds.current.add(msg.id);
      });

      const unreadIds = data
        .filter(m => String(m.sender_id) !== String(currentUser.id) && !m.is_read_by_me)
        .map(m => m.id);

      if (unreadIds.length > 0 && socket.connected) {
        socket.emit("mark_read", {
          messageIds: unreadIds,
          conversationId
        });

        setTimeout(() => {
          fetchConversationUnreadCount(conversationId).then(unreadCount => {
            setConversations(prev => prev.map(conv =>
              conv.id === conversationId
                ? { ...conv, unread: unreadCount }
                : conv
            ));
          });
        }, 500);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
      toast.error('Failed to load messages');
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    if (!activeConversation) return;

    if (socket.connected) {
      socket.emit("join_conversation", activeConversation.id);
    }

    fetchMessages(activeConversation.id);
    setTypingUsers(prev => ({ ...prev, [activeConversation.id]: [] }));

    return () => {
      if (socket.connected) {
        socket.emit("leave_conversation", activeConversation.id);
      }
    };
  }, [activeConversation?.id]);

  const handleSendMessage = async (message, file, optimisticMessage = null) => {
    if ((!message?.trim() && !file) || !activeConversation) return;

    const actualTempId = optimisticMessage?.tempId || `temp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    const optimisticMsg = optimisticMessage || {
      id: actualTempId,
      tempId: actualTempId,
      sender: 'You',
      senderId: currentUser.id,
      text: message || (file ? (file.type?.startsWith('image/') ? '📷 Image' : '📎 File') : ''),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isFile: !!file,
      fileName: file?.name,
      fileUrl: null,
      fileSize: file?.size,
      messageType: file ? (file.type?.startsWith('image/') ? 'image' : 'file') : 'text',
      isCurrentUser: true,
      is_read_by_me: true,
      isOptimistic: true
    };

    setMessages(prev => {
      const currentMessages = prev[activeConversation.id] || [];
      const exists = currentMessages.some(m => m.tempId === actualTempId || m.id === actualTempId);
      if (exists) return prev;
      return {
        ...prev,
        [activeConversation.id]: [...currentMessages, optimisticMsg]
      };
    });

    const formData = new FormData();
    formData.append('conversation_id', activeConversation.id);
    formData.append('message', message || '');
    formData.append('message_type', file ? (file.type?.startsWith('image/') ? 'image' : 'file') : 'text');

    if (optimisticMessage?.mentions?.length > 0) {
      formData.append('mentions', JSON.stringify(optimisticMessage.mentions));
    }

    if (file) {
      formData.append('file', file);
      setIsUploading(true);
      setUploadProgress(0);
    }

    try {
      let progressInterval;
      if (file) {
        progressInterval = setInterval(() => {
          setUploadProgress(prev => Math.min(prev + 10, 90));
        }, 200);
      }

      const onSendMessage = `${API_BASE_URL}/api/chat/message`;

      const res = await fetch(onSendMessage, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (file && progressInterval) clearInterval(progressInterval);
      if (!res.ok) throw new Error('Failed to send message');

      const newMsg = await res.json();

      setMessages(prev => {
        const currentMessages = prev[activeConversation.id] || [];
        const filtered = currentMessages.filter(m => m.tempId !== actualTempId);

        if (filtered.some(m => m.id === newMsg.id)) {
          return { ...prev, [activeConversation.id]: filtered };
        }

        const formattedMsg = {
          id: newMsg.id,
          sender: 'You',
          senderId: currentUser.id,
          text: newMsg.message,
          time: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: newMsg.created_at,
          isFile: newMsg.message_type === 'file' || newMsg.message_type === 'image',
          fileName: newMsg.file_name,
          fileUrl: newMsg.file_url,
          fileSize: newMsg.file_size,
          messageType: newMsg.message_type,
          isDeleted: newMsg.is_deleted,
          isCurrentUser: true,
          is_read_by_me: true,
          isOptimistic: false,
          isSystem: newMsg.sender_type === 'system',
          sender_type: newMsg.sender_type,
          live_task_data: newMsg.live_task_data || null,
          mentions: newMsg.mentions || (optimisticMessage ? optimisticMessage.mentions : [])
        };

        return {
          ...prev,
          [activeConversation.id]: [...filtered, formattedMsg]
        };
      });
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to send message or file");

      setMessages(prev => ({
        ...prev,
        [activeConversation.id]: prev[activeConversation.id].filter(m => m.tempId !== actualTempId)
      }));
    } finally {
      if (file) setIsUploading(false);
    }
  };

  const handleCreateConversation = async (participants, name = null, channel = 'internal', phoneNumber = null, customerName = null) => {
    try {
      let requestBody;
      if (channel === 'internal') {
        const isGroup = participants.length > 1 || (name && participants.length > 0);
        requestBody = {
          participants: participants,
          is_group: isGroup,
          conversationType: "internal",
          channel: "internal"
        };
        if (isGroup && name) {
          requestBody.name = name;
        }
      } else if (channel === 'whatsapp') {
        requestBody = {
          channel: "whatsapp",
          context_type: "customer",
          context_identifier: phoneNumber,
          context_name: customerName || phoneNumber,
          participants: [currentUser.id]
        };
      } else {
        throw new Error('Invalid channel');
      }

      const res = await fetch(`${API_BASE_URL}/api/chat/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create conversation');
      }

      const newConv = await res.json();

      setIsNewChatModalOpen(false);
      await fetchConversations();

      if (newConv && newConv.id) {
        setActiveConversation(newConv);
      } else {
        const updatedConvs = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => res.json());

        const createdConv = updatedConvs.find(c => c.id === newConv.id);
        if (createdConv) {
          setActiveConversation(createdConv);
        }
      }

      toast.success(channel === 'whatsapp' ? 'WhatsApp conversation started' : (isGroup ? 'Group created' : 'Conversation started'));
    } catch (err) {
      console.error('Error creating conversation:', err);
      toast.error(err.message || 'Failed to create conversation');
      setIsNewChatModalOpen(false);
    }
  };

  const fetchStaff = async () => {
    try {
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/chat/staff`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      setStaffList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching staff:', err);
      toast.error('Failed to load staff list');
      setStaffList([]);
    }
  };

  const handleDeleteMessage = async (messageId, conversationId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/message/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete message');

      lastMessageIdsRef.current.delete(messageId);
      processedMessageIds.current.delete(messageId);

      setMessages(prev => ({
        ...prev,
        [conversationId]: prev[conversationId].map(msg =>
          msg.id === messageId ? { ...msg, isDeleted: true, text: 'This message was deleted' } : msg
        )
      }));

      toast.success('Message deleted');
    } catch (err) {
      console.error('Error deleting message:', err);
      toast.error('Failed to delete message');
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    if (!window.confirm("Are you sure you want to delete this entire conversation? This action cannot be undone.")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/conversation/${conversationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete conversation');

      toast.success('Conversation deleted successfully');

      setConversations(prev => prev.filter(c => String(c.id) !== String(conversationId)));
      setActiveConversation(null);
    } catch (err) {
      console.error('Error deleting conversation:', err);
      toast.error('Failed to delete conversation');
    }
  };

  const handleAssignChat = async (staffId) => {
    if (!activeConversation) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/conversation/${activeConversation.id}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ staff_id: staffId || null })
      });

      if (!res.ok) throw new Error('Failed to assign conversation');

      const newStaffId = staffId ? parseInt(staffId) : null;
      setActiveConversation(prev => ({ ...prev, assigned_staff_id: newStaffId }));
      setConversations(prev => prev.map(c => c.id === activeConversation.id ? { ...c, assigned_staff_id: newStaffId } : c));

      toast.success(staffId ? 'Chat assigned successfully' : 'Chat unassigned');
      fetchConversations();
    } catch (err) {
      console.error('Error assigning conversation:', err);
      toast.error('Failed to assign chat');
    }
  };

  const getAvatarColor = (id) => {
    const colors = [
      "bg-navy-700",
      "bg-blue-600",
      "bg-pink-500",
      "bg-purple-600",
      "bg-orange-500",
      "bg-green-600",
      "bg-red-500",
      "bg-indigo-600",
    ];
    return colors[(id || 0) % colors.length];
  };

  const handleServiceTaskStatusUpdate = async (taskId, newStatus) => {
    const serviceEntryId = activeConversation?.context_id;
    if (!serviceEntryId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update task');

      setTasks(prevTasks =>
        prevTasks.map(t =>
          String(t.id) === String(taskId) ? { ...t, status: newStatus } : t
        )
      );
      toast.success(`Task marked as ${newStatus}`);
    } catch (err) {
      console.error('Error updating task:', err);
      toast.error('Failed to update task');
    }
  };

  const handleNormalTaskStatusUpdate = async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      await fetchTasks();
      toast.success(`Task marked as ${newStatus}`);

      setMessages(prev => {
        const convId = activeConversation?.id;
        if (!convId || !prev[convId]) return prev;

        const updated = prev[convId].map(msg => {
          if (msg.messageType === 'task') {
            if (String(msg.text) === String(taskId) || (msg.live_task_data && String(msg.live_task_data.id) === String(taskId))) {
              return {
                ...msg,
                live_task_data: { ...(msg.live_task_data || {}), status: newStatus }
              };
            }
          }
          return msg;
        });

        return { ...prev, [convId]: updated };
      });
    } catch (err) {
      console.error('Error updating task:', err);
      toast.error('Failed to update task');
    }
  };

  const fetchCentres = async () => {
    if (currentUser.role !== "superadmin") {
      return;
    }
    setCentresLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/centres`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setCentres(data);
      const map = {};
      data.forEach(centre => { map[centre.id] = centre.name; });
      setCentresMap(map);
    } catch (err) {
      console.error("Failed to fetch centres:", err);
    } finally {
      setCentresLoading(false);
    }
  };

  const fetchCalendarData = async () => {
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      let url = `${API_BASE_URL}/api/calendar`;
      if (currentUser.role !== "superadmin" && currentUser.centreId) {
        url += `?centre_id=${currentUser.centreId}`;
      }
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      setCalendarData(await res.json());
    } catch (err) {
      setCalendarError(err.message);
      setCalendarData([]);
    } finally {
      setCalendarLoading(false);
    }
  };

  const fetchLeavesData = async () => {
    try {
      let allLeavesData = [];

      if (currentUser.role === "superadmin") {
        if (centres.length === 0) return;
        const promises = centres.map(async (centre) => {
          try {
            const url = new URL(`${API_BASE_URL}/api/salary/leaves`);
            url.searchParams.append('centre_id', centre.id);
            const res = await fetch(url, {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (!res.ok) return [];
            return (await res.json()).map(leave => ({
              ...leave,
              centre_id: centre.id,
              centre_name: centre.name,
              type: 'leave'
            }));
          } catch (err) {
            console.error(`Error fetching leaves for centre ${centre.id}:`, err);
            return [];
          }
        });
        allLeavesData = (await Promise.all(promises)).flat();
      } else {
        if (!currentUser.centreId) return;
        const url = new URL(`${API_BASE_URL}/api/salary/leaves`);
        url.searchParams.append('centre_id', currentUser.centreId);
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        const centreName = currentUser.role === "superadmin"
          ? (centresMap[currentUser.centreId] || `Centre ${currentUser.centreId}`)
          : (user?.centre_name || `Centre ${currentUser.centreId}`);
        allLeavesData = data.map(leave => ({
          ...leave,
          centre_name: centreName,
          type: 'leave'
        }));
      }

      setLeavesData(allLeavesData);
    } catch (err) {
      console.error("Failed to fetch leaves data:", err);
      setLeavesData([]);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    setApiError(null);
    try {
      let url = `${API_BASE_URL}/api/tasks/all`;
      if (currentUser.role !== "superadmin" && currentUser.centreId) {
        url += `?centre_id=${currentUser.centreId}`;
      }
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();

      const tasksWithCentre = data.map(task => ({
        ...task,
        centre_name: centresMap[task.centre_id] || `Centre ${task.centre_id}`
      }));

      setTasks(tasksWithCentre);
    } catch (err) {
      setApiError("Could not load tasks");
      console.error("Error fetching tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      let url = `${API_BASE_URL}/api/tasks/templates`;
      if (currentUser.role !== "superadmin" && currentUser.centreId) {
        url += `?centre_id=${currentUser.centreId}`;
      }
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      setTemplates(await res.json());
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    }
  };

  useEffect(() => {
    if (currentUser.role === "superadmin") {
      fetchCentres();
    } else {
      if (currentUser.centreId) {
        setCentresMap({
          [currentUser.centreId]: user?.centre_name || `Centre ${currentUser.centreId}`
        });
      }
    }
    fetchTasks();
    fetchTemplates();
    fetchStaff();
    fetchConversations();
  }, [currentUser.role, currentUser.centreId]);

  useEffect(() => {
    if (Object.keys(centresMap).length > 0) {
      setTasks(prev => prev.map(task => ({
        ...task,
        centre_name: centresMap[task.centre_id] || `Centre ${task.centre_id}`
      })));
    }
  }, [centresMap]);

  useEffect(() => {
    fetchCalendarData();
    fetchLeavesData();
  }, [currentUser.role, currentUser.centreId, centres.length]);

  const canCreateRecurring = () => currentUser.role === "admin" || currentUser.role === "superadmin";
  const canCreateGlobal = () => currentUser.role === "superadmin";
  const canEditTemplate = (template) => currentUser.role === "superadmin" || (currentUser.role === "admin" && !template.is_global);

  const handleTaskFormChange = (e) => setTaskForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleTemplateFormChange = (e) => setTemplateForm(prev => ({ ...prev, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const handleEventFormChange = (e) => setEventForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const resetTaskForm = () => setTaskForm({ title: "", description: "", assignee: "", dueDate: "", priority: "medium" });
  const resetTemplateForm = () => {
    setTemplateForm({
      title: "", description: "", priority: "medium", isRecurring: true, recurrenceType: "weekly", recurrenceInterval: 1, recurrenceDay: 1, recurrenceDate: 1, assignmentMode: "centre_admin", specificAssignee: "", dueOffsetDays: 0, isGlobal: false, isActive: true
    });
    setEditingTemplate(null);
  };

  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) return alert("Please enter a task title");
    if (!taskForm.assignee) return alert("Please select an assignee");

    setLoading(true);
    try {
      const taskData = {
        title: taskForm.title,
        description: taskForm.description,
        assigned_to: parseInt(taskForm.assignee),
        due_date: taskForm.dueDate || null,
        priority: taskForm.priority
      };

      const res = await fetch(`${API_BASE_URL}/api/tasks/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(taskData)
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setTasks(prev => [{
        ...data,
        centre_name: centresMap[data.centre_id] || `Centre ${data.centre_id}`
      }, ...prev]);

      await fetchCalendarData();
      resetTaskForm();
      setIsTaskModalOpen(false);
      toast.success("Task created successfully");
    } catch (err) {
      alert(`Failed to create task: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.title.trim()) return alert("Please enter a template title");
    if (templateForm.assignmentMode === "specific_staff" && !templateForm.specificAssignee) return alert("Please select a staff member");

    setLoading(true);
    try {
      const templateData = {
        title: templateForm.title,
        description: templateForm.description,
        priority: templateForm.priority,
        recurrence_type: templateForm.recurrenceType,
        recurrence_interval: parseInt(templateForm.recurrenceInterval),
        due_offset_days: parseInt(templateForm.dueOffsetDays),
        assignment_mode: templateForm.assignmentMode,
        is_global: canCreateGlobal() ? templateForm.isGlobal : false
      };

      if (templateForm.recurrenceType === 'weekly') {
        templateData.recurrence_day = parseInt(templateForm.recurrenceDay);
      } else if (templateForm.recurrenceType === 'monthly') {
        templateData.recurrence_date = parseInt(templateForm.recurrenceDate);
      }

      if (templateForm.assignmentMode === "specific_staff") {
        templateData.assigned_to = parseInt(templateForm.specificAssignee);
      }

      let url = `${API_BASE_URL}/api/tasks/add`;
      let method = "POST";

      if (editingTemplate) {
        url = `${API_BASE_URL}/api/tasks/template/${editingTemplate.id}`;
        method = "PATCH";
        templateData.is_active = templateForm.isActive;
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(templateData)
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      if (editingTemplate) {
        await fetchTemplates();
        toast.success("Template updated successfully");
      } else {
        setTemplates(prev => [data.template || data, ...prev]);
        toast.success("Template created successfully");
      }

      resetTemplateForm();
      setIsTemplateModalOpen(false);
    } catch (err) {
      alert(`Failed to save template: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleTemplateStatus = async (templateId, currentStatus) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/template/${templateId}/toggle`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, is_active: !currentStatus } : t));
      toast.success(`Template ${!currentStatus ? 'activated' : 'paused'} successfully`);
    } catch (err) {
      alert(`Failed to update template: ${err.message}`);
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/template/${templateId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success("Template deleted successfully");
    } catch (err) {
      alert(`Failed to delete template: ${err.message}`);
    }
  };

  const toggleTaskCompletion = async (taskId, currentStatus) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      await fetchTasks();
      await fetchCalendarData();
      toast.success(`Task marked as ${newStatus}`);
    } catch (err) {
      alert(`Failed to update task: ${err.message}`);
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      await fetchTasks();
      await fetchCalendarData();
      toast.success("Task deleted successfully");
    } catch (err) {
      alert(`Failed to delete task: ${err.message}`);
    }
  };

  const openTaskModal = () => {
    resetTaskForm();
    setIsTaskModalOpen(true);
  };

  const openTemplateModal = (template = null) => {
    if (template && canEditTemplate(template)) {
      setEditingTemplate(template);
      setTemplateForm({
        title: template.title,
        description: template.description || "",
        priority: template.priority,
        recurrenceType: template.recurrence_type,
        recurrenceInterval: template.recurrence_interval || 1,
        recurrenceDay: template.recurrence_day || 1,
        recurrenceDate: template.recurrence_date || 1,
        assignmentMode: template.assignment_mode || "centre_admin",
        specificAssignee: template.assigned_to || "",
        dueOffsetDays: template.due_offset_days || 0,
        isGlobal: template.is_global || false,
        isActive: template.is_active
      });
    } else {
      resetTemplateForm();
    }
    setIsTemplateModalOpen(true);
  };

  const getFilteredTasks = () => {
    switch (taskFilter) {
      case "pending": return tasks.filter(task => task.status === "pending" || !task.status);
      case "in_progress": return tasks.filter(task => task.status === "in_progress");
      case "completed": return tasks.filter(task => task.status === "completed");
      default: return tasks;
    }
  };

  const handleSaveEvent = async () => {
    if (!eventForm.date) return alert("Please select a date");
    setLoading(true);
    try {
      let centreIdToUse = currentUser.role === "superadmin" ? null : currentUser.centreId;

      if (currentUser.role === "superadmin" && !eventForm.centre_id) {
        alert("Please select a centre from the dropdown in the modal");
        setLoading(false);
        return;
      }

      if (currentUser.role !== "superadmin" && !centreIdToUse) {
        throw new Error("No centre selected");
      }

      const eventData = {
        ...eventForm,
        centre_id: currentUser.role === "superadmin" ? eventForm.centre_id : centreIdToUse
      };

      let url = `${API_BASE_URL}/api/calendar`;
      let method = "POST";
      if (editingEvent) {
        url = `${API_BASE_URL}/api/calendar/${editingEvent.id}`;
        method = "PUT";
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(eventData)
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      await fetchCalendarData();
      setIsEventModalOpen(false);
      setEditingEvent(null);
      setEventForm({ date: "", type: "working", description: "" });
      toast.success("Event saved successfully");
    } catch (err) {
      alert(`Failed to save event: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (event) => {
    if (event.type === 'task') return alert("Tasks cannot be deleted from calendar.");
    if (!window.confirm("Are you sure you want to delete this event?")) return;

    try {
      let centreIdToUse = currentUser.role === "superadmin" ? event.centre_id : currentUser.centreId;
      const url = new URL(`${API_BASE_URL}/api/calendar/${event.id}`);
      url.searchParams.append('centre_id', centreIdToUse);

      const res = await fetch(url, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      await fetchCalendarData();
      toast.success("Event deleted successfully");
    } catch (err) {
      alert(`Failed to delete event: ${err.message}`);
    }
  };

  const handleUpdateEvent = async (eventId, updatedEvent) => {
    try {
      let centreIdToUse = currentUser.role === "superadmin" ? updatedEvent.centre_id : currentUser.centreId;
      const res = await fetch(`${API_BASE_URL}/api/calendar/${eventId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ...updatedEvent, centre_id: centreIdToUse })
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      await fetchCalendarData();
      toast.success("Event moved successfully");
    } catch (err) {
      throw err;
    }
  };

  const openAddEventModal = () => {
    setEditingEvent(null);
    setEventForm({
      date: new Date().toISOString().split('T')[0],
      type: "working",
      description: "",
      centre_id: currentUser.role === "superadmin" ? "" : currentUser.centreId
    });
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (event) => {
    if (event.type === 'task') return alert("Tasks cannot be edited from calendar.");
    setEditingEvent(event);
    setEventForm({
      date: event.date,
      type: event.type,
      description: event.description || "",
      centre_id: event.centre_id
    });
    setIsEventModalOpen(true);
  };

  const filteredConversations = conversations.filter(
    (conv) => {
      let displayName = conv.name;
      if (!displayName && !conv.is_group) {
        if (conv.channel === 'whatsapp') {
          displayName = conv.context_name || conv.context_identifier || 'WhatsApp User';
        } else if (conv.participants) {
          const otherParticipants = conv.participants.filter(p => p.staff_id !== currentUser.id);
          if (otherParticipants.length > 0) {
            displayName = otherParticipants.map(p => p.name).join(', ');
          }
        }
      }
      if (!displayName) displayName = 'Unknown Chat';

      const lastMessageText = conv.last_message || conv.lastMessage || '';
      const searchLower = searchQuery.toLowerCase();
      return (displayName.toLowerCase().includes(searchLower)) ||
        (lastMessageText && lastMessageText.toLowerCase().includes(searchLower));
    }
  );

  // ============== RENDER FUNCTIONS ==============

  const renderConversationList = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/80 overflow-hidden">
      {/* Modern Header */}
      <div className="flex-none px-5 pt-5 pb-4 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-sm w-11 h-11 rounded-xl flex items-center justify-center border border-white/20 shadow-lg">
                <FiSend className="text-white" size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Messages</h2>
                <p className="text-[11px] text-indigo-200/80 font-medium">
                  {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button className="p-2.5 rounded-xl hover:bg-white/10 transition relative text-white/90 hover:text-white">
                <FiBell size={17} />
                {conversations.reduce((acc, conv) => acc + (conv.unread || 0), 0) > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-400 rounded-full ring-2 ring-slate-800 animate-pulse"></span>
                )}
              </button>
              <button
                onClick={() => setIsNewChatModalOpen(true)}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition text-white border border-white/10 shadow-sm"
                title="New Chat"
              >
                <FiPlus size={17} />
              </button>
            </div>
          </div>
          <div className="relative">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search conversations..."
              className="pl-10 pr-4 py-2.5 w-full rounded-xl bg-white/10 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 placeholder:text-slate-300 text-white text-sm border border-white/10 transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        <div className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Recent Chats
        </div>
        {filteredConversations.length > 0 ? (
          filteredConversations.map((c) => {
            let displayName = c.name;
            if (!displayName && !c.is_group) {
              if (c.channel === 'whatsapp') {
                displayName = c.context_name || c.context_identifier || 'WhatsApp User';
              } else if (c.participants) {
                const otherParticipants = c.participants.filter(p => p.staff_id !== currentUser.id);
                if (otherParticipants.length > 0) {
                  displayName = otherParticipants.map(p => p.name).join(', ');
                }
              }
            }
            if (!displayName) displayName = 'Unknown Chat';

            const isAnyOnline = c.channel !== 'whatsapp' && c.participants?.some(p => p.staff_id !== currentUser.id && onlineUsers.has(String(p.staff_id)));

            const otherParticipants = c.participants ? c.participants.filter(p => String(p.staff_id) !== String(currentUser.id)) : [];
            const isFunctionallyGroup = c.is_group || otherParticipants.length > 1;

            let avatarPhoto = null;
            if (!isFunctionallyGroup && otherParticipants.length === 1) {
              if (otherParticipants[0]?.photo) {
                avatarPhoto = getAvatarUrl(otherParticipants[0].photo);
              }
            }

            let lastMessageText = c.last_message || c.lastMessage || '';
            const lastMessageSenderName = c.last_message_sender;
            const lastMessageSenderId = c.last_message_sender_id;

            if (!isNaN(lastMessageText) && lastMessageText.trim() !== '') {
              lastMessageText = "📋 Sent a task";
            } else if (lastMessageSenderId && String(lastMessageSenderId) !== String(currentUser.id) && lastMessageSenderName) {
              lastMessageText = `${lastMessageSenderName}: ${lastMessageText}`;
            }

            if (!lastMessageText) {
              lastMessageText = 'No messages yet';
            }

            const isActive = activeConversation?.id === c.id;
            const hasUnread = c.unread > 0;

            return (
              <motion.div
                key={c.id}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setActiveConversation(c)}
                className={`mx-2 my-1 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-3 ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-50 to-indigo-50/30 border border-indigo-100 shadow-sm"
                    : "hover:bg-slate-50 border border-transparent"
                }`}
              >
                <div className="relative flex-shrink-0">
                  {avatarPhoto ? (
                    <img
                      src={avatarPhoto}
                      alt={displayName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-slate-100"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}

                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold shadow-sm ring-1 ring-white/50 ${c.avatarColor || 'bg-navy-700'} ${avatarPhoto ? 'hidden' : ''}`}>
                    {isFunctionallyGroup ? <FiUsers size={20} /> : displayName.charAt(0).toUpperCase()}
                  </div>

                  {!isFunctionallyGroup && isAnyOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm"></span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`truncate text-sm ${hasUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                          {displayName}
                        </span>
                        {c.channel === 'whatsapp' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 whitespace-nowrap flex items-center gap-1 font-semibold">
                            <FiSmartphone size={9} /> WhatsApp
                          </span>
                        )}
                        {c.context_type === 'service_entry' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100 whitespace-nowrap font-semibold">
                            Service
                          </span>
                        )}
                      </div>
                      {!isFunctionallyGroup && otherParticipants[0]?.centre_name && (
                        <span className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center gap-1 font-medium">
                          <FiMapPin size={9} /> {otherParticipants[0].centre_name}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] whitespace-nowrap font-medium ${hasUnread ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>

                  <div className="flex items-center mt-1.5 gap-2">
                    <p className={`text-xs truncate flex-1 ${hasUnread ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                      {lastMessageText}
                    </p>
                    {hasUnread && (
                      <span className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-[10px] text-white rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 font-bold flex-shrink-0 shadow-sm">
                        {c.unread}
                      </span>
                    )}
                  </div>

                  {typingUsers[c.id]?.length > 0 && (
                    <p className="text-[11px] text-indigo-600 italic mt-1 font-medium flex items-center gap-1">
                      <span className="flex gap-0.5">
                        <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </span>
                      {typingUsers[c.id].map(u => u.name).join(', ')} typing...
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FiMessageSquare className="text-slate-400" size={28} />
            </div>
            <p className="text-slate-700 font-semibold mb-1">No conversations yet</p>
            <p className="text-slate-400 text-xs mb-3">Start chatting with your team</p>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="text-indigo-600 font-semibold hover:text-indigo-700 text-sm hover:underline"
            >
              + Start a new chat
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderContactPanel = () => {
    if (!activeConversation) return null;

    const onlineParticipants = activeConversation.participants?.filter(
      p => p.staff_id !== currentUser.id && onlineUsers.has(String(p.staff_id))
    ) || [];

    let displayName = activeConversation.name;
    if (!displayName && !activeConversation.is_group) {
      if (activeConversation.channel === 'whatsapp') {
        displayName = activeConversation.context_name || activeConversation.context_identifier || 'WhatsApp User';
      } else if (activeConversation.participants) {
        const otherParticipants = activeConversation.participants.filter(p => p.staff_id !== currentUser.id);
        if (otherParticipants.length > 0) {
          displayName = otherParticipants.map(p => p.name).join(', ');
        }
      }
    }
    if (!displayName) displayName = 'Unknown Chat';

    const otherPanelParticipants = activeConversation.participants ? activeConversation.participants.filter(p => String(p.staff_id) !== String(currentUser.id)) : [];
    const isFunctionallyGroup = activeConversation.is_group || otherPanelParticipants.length > 1;

    let avatarPhoto = null;
    if (!isFunctionallyGroup && otherPanelParticipants.length === 1) {
      if (otherPanelParticipants[0]?.photo) {
        avatarPhoto = getAvatarUrl(otherPanelParticipants[0].photo);
      }
    }

    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white border-l border-slate-200/80 overflow-hidden">
        {/* Profile Header */}
        <div className="flex-none p-6 flex flex-col items-center border-b border-slate-200/80 bg-white relative">
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-br from-indigo-50 to-transparent" />
          <div className="relative">
            {avatarPhoto ? (
              <img
                src={avatarPhoto}
                alt={displayName}
                className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg ring-1 ring-slate-100"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
              />
            ) : null}
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg ring-4 ring-white ${avatarPhoto ? 'hidden' : ''}`}>
              {displayName?.[0] || '?'}
            </div>
            {!activeConversation.is_group && onlineParticipants.length > 0 && (
              <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-white shadow-sm"></span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-800 mt-3 text-center">{displayName}</h3>

          {!isFunctionallyGroup && otherPanelParticipants[0]?.centre_name && (
            <p className="text-slate-500 text-xs flex items-center mt-1.5 text-center font-medium">
              <FiMapPin className="mr-1" size={12} /> {otherPanelParticipants[0].centre_name}
            </p>
          )}

          {activeConversation.channel === 'whatsapp' && (
            <span className="text-emerald-700 text-[11px] flex items-center mt-2 font-semibold bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
              <FiSmartphone className="mr-1" size={12} /> WhatsApp
            </span>
          )}
          {!activeConversation.is_group && activeConversation.channel !== 'whatsapp' && (
            <p className="text-slate-500 flex items-center mt-2 text-xs font-medium">
              <BsCircleFill className={`${onlineParticipants.length > 0 ? 'text-emerald-500' : 'text-slate-400'} mr-1.5 text-[8px]`} />
              {onlineParticipants.length > 0 ? 'Online' : 'Offline'}
            </p>
          )}
          {activeConversation.is_group && (
            <p className="text-slate-500 mt-1.5 text-xs font-medium">
              {activeConversation.participants?.length || 0} members
              {onlineParticipants.length > 0 && (
                <span className="ml-1.5 text-emerald-600 font-semibold">
                  ({onlineParticipants.length} online)
                </span>
              )}
            </p>
          )}
          {!socketConnected && (
            <p className="text-[11px] text-amber-600 mt-2 flex items-center gap-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded-full font-medium">
              <FiAlertCircle size={11} />
              Reconnecting...
            </p>
          )}

          {(activeConversation.channel === 'whatsapp' || activeConversation.context_type === 'customer') && (
            <div className="mt-4 w-full">
              <p className="text-[10px] text-slate-500 mb-1.5 font-bold uppercase tracking-widest">Assign To</p>
              <select
                value={activeConversation.assigned_staff_id || ""}
                onChange={(e) => handleAssignChat(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition shadow-sm"
              >
                <option value="">Unassigned</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.role ? `(${s.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 custom-scrollbar">
          {/* Participants */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm mb-4">
            <h4 className="font-bold text-slate-700 text-xs mb-3 flex items-center uppercase tracking-widest">
              <FiUsers className="mr-2 text-indigo-600" size={13} /> Participants
            </h4>
            <div className="space-y-3">
              {activeConversation.participants?.map((p, index) => {
                const isOnline = onlineUsers.has(String(p.staff_id));
                const isCurrentUserParticipant = p.staff_id === currentUser.id;
                const pPhoto = getAvatarUrl(p.photo);

                return (
                  <div key={index} className="flex items-center">
                    <div className="relative mr-3 flex-shrink-0">
                      {pPhoto ? (
                        <img src={pPhoto} alt={p.name} className="w-9 h-9 rounded-full object-cover border border-slate-200" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                      ) : null}
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 border border-slate-100 ${pPhoto ? 'hidden' : ''}`}>
                        {p.name?.[0] || '?'}
                      </div>
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 font-semibold text-sm truncate">
                        {p.name} {isCurrentUserParticipant && <span className="text-slate-400 font-normal">(You)</span>}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{p.role || 'Member'} {p.centre_name && `• ${p.centre_name}`}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Service Details */}
          {activeConversation.context_type === 'service_entry' && (
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm mb-4">
              <h4 className="font-bold text-slate-700 text-xs mb-3 flex items-center uppercase tracking-widest">
                <FiBriefcase className="mr-2 text-indigo-600" size={13} /> Service Details
              </h4>

              <div className="bg-slate-50/50 border border-slate-100 rounded-lg p-3 mb-3">
                <p className="text-sm font-bold text-slate-900 truncate" title={activeConversation.context_name}>
                  {activeConversation.context_name || 'Service Request'}
                </p>
                {activeConversation.context_identifier && (
                  <p className="text-[10px] text-indigo-600 mt-1 font-mono font-semibold">
                    App #: {activeConversation.context_identifier}
                  </p>
                )}
              </div>

              {loadingServiceDetails ? (
                <div className="animate-pulse space-y-2 py-2">
                  <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                </div>
              ) : serviceDetails ? (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-slate-500 mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Type</p>
                      <p className="font-semibold text-slate-800 text-xs">{serviceDetails.category_name || serviceDetails.service_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Subcategory</p>
                      <p className="font-semibold text-slate-800 text-xs">{serviceDetails.subcategory_name || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-slate-500 mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Status</p>
                      <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${
                        serviceDetails.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        serviceDetails.status === 'processing' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {serviceDetails.status?.replace('-', ' ') || 'Pending'}
                      </span>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Step</p>
                      <p className="font-semibold text-indigo-700 truncate text-xs" title={serviceDetails.current_step}>
                        {serviceDetails.current_step || 'Initial Phase'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-slate-500 mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Priority</p>
                      <p className={`font-semibold text-xs ${
                        serviceDetails.priority === 'High' ? 'text-rose-600' :
                        serviceDetails.priority === 'Medium' ? 'text-amber-600' :
                        'text-slate-800'
                      }`}>
                        {serviceDetails.priority || 'Normal'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Avg Time</p>
                      <p className="font-semibold text-slate-800 flex items-center gap-1 text-xs">
                        <FiClock size={10}/> {serviceDetails.average_time || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-slate-500 mb-0.5 text-[10px] uppercase tracking-wider font-semibold">Assigned To</p>
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                      <FiUser size={12}/> {serviceDetails.assigned_staff_name || serviceDetails.staff_name || 'Unassigned'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-center text-slate-500 py-2">
                  Unable to load service details.
                </div>
              )}

              <button
                onClick={() => navigate(`/dashboard/staff/track_service/${activeConversation.context_id}`)}
                className="w-full mt-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl font-semibold shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 text-xs"
              >
                <FiMapPin size={14} /> Open Tracking
              </button>
            </div>
          )}

          {/* Shared Files */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm mb-4">
            <h4 className="font-bold text-slate-700 text-xs mb-3 flex items-center uppercase tracking-widest">
              <FiFile className="mr-2 text-indigo-600" size={13} /> Shared Files
            </h4>
            <div className="space-y-2">
              {messages[activeConversation.id]?.filter(m => m.isFile && !m.isOptimistic).slice(0, 5).map(file => (
                <motion.div
                  key={file.id}
                  whileHover={{ x: 3 }}
                  className="flex items-center p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition border border-transparent hover:border-slate-100"
                  onClick={() => {
                    if (file.fileUrl) {
                      const fullUrl = file.fileUrl.startsWith('http') ? file.fileUrl : `${API_BASE_URL}${file.fileUrl}`;
                      window.open(fullUrl, '_blank');
                    }
                  }}
                >
                  <div className="bg-indigo-50 p-2 rounded-lg mr-2.5 border border-indigo-100">
                    {file.messageType === 'image' ? (
                      <FiImage className="text-indigo-600" size={14} />
                    ) : (
                      <FiFile className="text-indigo-600" size={14} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 font-semibold text-xs truncate">{file.fileName || 'File'}</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                  <FiDownload className="text-slate-400" size={14} />
                </motion.div>
              ))}
              {(!messages[activeConversation.id]?.filter(m => m.isFile && !m.isOptimistic).length) && (
                <p className="text-xs text-slate-400 text-center py-3 font-medium">No files shared yet</p>
              )}
            </div>
          </div>

          {/* Notes */}
          {activeConversation.channel !== 'whatsapp' && (
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm mb-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-slate-700 text-xs flex items-center uppercase tracking-widest">
                  <FiStar className="mr-2 text-amber-500" size={13} /> Notes
                </h4>
                <button
                  onClick={() => setIsQuickNoteModalOpen(true)}
                  className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 rounded-md transition font-bold"
                >
                  + Add Note
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {conversationNotes.map(note => (
                  <div key={note.id} className="bg-gradient-to-br from-amber-50 to-yellow-50/50 border border-amber-100 p-3 rounded-xl hover:shadow-sm transition">
                    <p className="font-bold text-xs text-amber-900 truncate">{note.title || 'Note'}</p>
                    <p className="text-[11px] text-amber-800 mt-1 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    {note.origin_message_id && (
                      <span className="text-[9px] text-amber-600 mt-2 inline-flex items-center gap-1 font-bold bg-amber-100/70 px-1.5 py-0.5 rounded">
                        <FiMessageSquare size={9} /> Converted from message
                      </span>
                    )}
                  </div>
                ))}
                {conversationNotes.length === 0 && (
                  <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <FiStar className="mx-auto text-slate-300 text-xl mb-1" />
                    <p className="text-[11px] text-slate-500 font-medium">No notes attached yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tasks */}
          {activeConversation.channel !== 'whatsapp' && (
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
              <h4 className="font-bold text-slate-700 text-xs mb-3 flex items-center uppercase tracking-widest">
                <FiCheckSquare className="mr-2 text-indigo-600" size={13} /> Tasks
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {(() => {
                  let relevantTasks = [];

                  if (activeConversation.context_type === 'service_entry') {
                    relevantTasks = tasks.filter(t => String(t.related_service_entry_id) === String(activeConversation.context_id));
                  } else {
                    const uniqueTaskIds = new Set();
                    const chatMessages = messages[activeConversation.id] || [];
                    const taskMessages = chatMessages.filter(m => m.messageType === 'task' && !m.isDeleted);

                    taskMessages.forEach(msg => {
                      const taskObj = msg.live_task_data || tasks.find(t => String(t.id) === String(msg.text));
                      if (taskObj && !uniqueTaskIds.has(String(taskObj.id))) {
                        uniqueTaskIds.add(String(taskObj.id));
                        relevantTasks.push(taskObj);
                      }
                    });
                  }

                  if (relevantTasks.length === 0) {
                    return (
                      <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <FiCheckSquare className="mx-auto text-slate-300 text-xl mb-1" />
                        <p className="text-[11px] text-slate-500 font-medium">No tasks in this conversation</p>
                      </div>
                    );
                  }

                  return relevantTasks.map(task => (
                    <div key={task.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className={`font-semibold text-xs truncate ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}`} title={task.title}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-[10px] text-slate-500 mt-1 line-clamp-2" title={task.description}>
                              {task.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1 mt-2">
                            {task.assigned_to_name && (
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1">
                                <FiUser size={9}/> {task.assigned_to_name}
                              </span>
                            )}
                            {task.due_date && (
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1">
                                <FiCalendar size={9}/> {new Date(task.due_date).toLocaleDateString('en-IN')}
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              task.priority === 'high' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                              task.priority === 'medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                              'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            }`}>
                              {task.priority || 'Normal'}
                            </span>
                          </div>
                        </div>

                        {task.status !== 'completed' ? (
                          <button
                            onClick={() => {
                              if (task.related_service_entry_id) {
                                handleServiceTaskStatusUpdate(task.id, 'completed');
                              } else {
                                handleNormalTaskStatusUpdate(task.id, task.status);
                              }
                            }}
                            className="shrink-0 p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors border border-emerald-200"
                            title="Mark Complete"
                          >
                            <FiCheck size={12} />
                          </button>
                        ) : (
                          <div className="shrink-0 p-1.5 bg-slate-50 text-slate-400 rounded-lg border border-slate-100" title="Completed">
                            <FiCheck size={12} />
                          </div>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleCreateQuickNote = async () => {
    if (!quickNoteForm.content.trim()) return toast.error("Note content is required");
    setLoading(true);
    try {
      const payload = {
        title: quickNoteForm.title || null,
        content: quickNoteForm.content,
        related_conversation_id: activeConversation?.id,
        related_service_entry_id: activeConversation?.context_type === 'service_entry' ? activeConversation?.context_id : null
      };

      const res = await fetch(`${API_BASE_URL}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to create note");
      const newNote = await res.json();

      setConversationNotes(prev => [newNote, ...prev]);
      setIsQuickNoteModalOpen(false);
      setQuickNoteForm({ title: "", content: "" });
      toast.success("Note saved to conversation ⭐");
    } catch (err) {
      toast.error("Failed to save note");
    } finally {
      setLoading(false);
    }
  };

  const renderQuickNoteModal = () => (
    <AnimatePresence>
      {isQuickNoteModalOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setIsQuickNoteModalOpen(false)}
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.98 }}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200/60"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <span className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center border border-amber-100"><FiStar className="text-amber-500" size={16}/></span>
                  Add Quick Note
                </h3>
                <button onClick={() => setIsQuickNoteModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                  <IoMdClose size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Title (Optional)</label>
                  <input type="text" value={quickNoteForm.title} onChange={e => setQuickNoteForm({ ...quickNoteForm, title: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm" placeholder="e.g. Needs Follow-up" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Content *</label>
                  <textarea value={quickNoteForm.content} onChange={e => setQuickNoteForm({ ...quickNoteForm, content: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm resize-none" placeholder="Type your secure note here..." rows={4} />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setIsQuickNoteModalOpen(false)} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-100 transition text-sm">Cancel</button>
                <button onClick={handleCreateQuickNote} disabled={loading || !quickNoteForm.content.trim()} className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-800 transition disabled:opacity-50 flex items-center gap-2 shadow-md shadow-indigo-500/20 text-sm">
                  <FiStar size={14} /> Save Note
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderRegularTaskModal = () => (
    <AnimatePresence>
      {isTaskModalOpen && (
        <motion.div
          key="task-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setIsTaskModalOpen(false)}
        >
          <motion.div
            key="task-modal-content"
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200/60"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <span className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100"><FiCheckSquare className="text-indigo-600" size={16}/></span>
                  Create New Task
                </h3>
                <button onClick={() => setIsTaskModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                  <IoMdClose size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Task Title *</label>
                  <input type="text" name="title" value={taskForm.title} onChange={handleTaskFormChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm" placeholder="What needs to be done?" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Description</label>
                  <textarea name="description" value={taskForm.description} onChange={handleTaskFormChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm resize-none" placeholder="Add details..." rows={3} />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Assign To *</label>
                  <select name="assignee" value={taskForm.assignee} onChange={handleTaskFormChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm">
                    <option value="">Select assignee</option>
                    {!staffList.some(s => String(s.id) === String(currentUser.id)) && (
                      <option value={currentUser.id}>{currentUser.name} (Me)</option>
                    )}
                    {staffList.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} ({staff.role || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Due Date</label>
                    <input type="date" name="dueDate" value={taskForm.dueDate} onChange={handleTaskFormChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Priority</label>
                    <select name="priority" value={taskForm.priority} onChange={handleTaskFormChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setIsTaskModalOpen(false)} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-100 transition text-sm">Cancel</button>
                <button onClick={handleCreateTask} disabled={loading} className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-800 transition disabled:opacity-50 shadow-md shadow-indigo-500/20 text-sm">{loading ? "Creating..." : "Create Task"}</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderEventModal = () => (
    <AnimatePresence>
      {isEventModalOpen && (
        <motion.div
          key="event-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { setIsEventModalOpen(false); setEditingEvent(null); }}
        >
          <motion.div
            key="event-modal-content"
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200/60"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <span className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100"><FiCalendar className="text-indigo-600" size={16}/></span>
                  {editingEvent ? "Edit Event" : "Add Calendar Event"}
                </h3>
                <button onClick={() => { setIsEventModalOpen(false); setEditingEvent(null); }} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"><IoMdClose size={20} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Date *</label>
                  <input type="date" name="date" value={eventForm.date} onChange={handleEventFormChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Event Type *</label>
                  <select name="type" value={eventForm.type} onChange={handleEventFormChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm">
                    <option value="working">Working Day</option>
                    <option value="holiday">Holiday</option>
                    <option value="weekend">Weekend</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Description</label>
                  <textarea name="description" value={eventForm.description} onChange={handleEventFormChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm resize-none" placeholder="Add description..." rows={3} />
                </div>

                {currentUser.role === "superadmin" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Centre *</label>
                    <select name="centre_id" value={eventForm.centre_id || ""} onChange={handleEventFormChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm" required>
                      <option value="">Select a centre</option>
                      {centres.map(centre => (<option key={centre.id} value={centre.id}>{centre.name}</option>))}
                    </select>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => { setIsEventModalOpen(false); setEditingEvent(null); }} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-100 transition text-sm">Cancel</button>
                <button onClick={handleSaveEvent} disabled={loading} className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-800 transition disabled:opacity-50 shadow-md shadow-indigo-500/20 text-sm">{loading ? "Saving..." : (editingEvent ? "Update Event" : "Add Event")}</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderTemplateModal = () => (
    <AnimatePresence>
      {isTemplateModalOpen && (
        <motion.div
          key="template-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { setIsTemplateModalOpen(false); resetTemplateForm(); }}
        >
          <motion.div
            key="template-modal-content"
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh] border border-slate-200/60 custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  <span className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center border border-purple-100"><FiRepeat className="text-purple-600" size={16}/></span>
                  {editingTemplate ? "Edit Recurring Template" : "Create Recurring Template"}
                </h3>
                <button onClick={() => { setIsTemplateModalOpen(false); resetTemplateForm(); }} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"><IoMdClose size={20} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Template Title *</label>
                  <input type="text" name="title" value={templateForm.title} onChange={handleTemplateFormChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm" placeholder="e.g., Weekly Team Sync" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Description</label>
                  <textarea name="description" value={templateForm.description} onChange={handleTemplateFormChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white outline-none transition text-sm resize-none" placeholder="Template description..." rows={2} />
                </div>

                <div className="p-5 bg-gradient-to-br from-indigo-50/60 to-blue-50/40 rounded-2xl border border-indigo-100">
                  <h4 className="font-bold text-indigo-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <FiRepeat size={14} /> Recurrence Settings
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Repeat</label>
                      <select name="recurrenceType" value={templateForm.recurrenceType} onChange={handleTemplateFormChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition text-sm">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Every (n)</label>
                      <input type="number" name="recurrenceInterval" value={templateForm.recurrenceInterval} onChange={handleTemplateFormChange} min="1" max="30" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition text-sm" />
                    </div>

                    {templateForm.recurrenceType === 'weekly' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Day of Week</label>
                        <select name="recurrenceDay" value={templateForm.recurrenceDay} onChange={handleTemplateFormChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition text-sm">
                          <option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option><option value="0">Sunday</option>
                        </select>
                      </div>
                    )}

                    {templateForm.recurrenceType === 'monthly' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Day of Month</label>
                        <input type="number" name="recurrenceDate" value={templateForm.recurrenceDate} onChange={handleTemplateFormChange} min="1" max="31" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition text-sm" />
                      </div>
                    )}

                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Assign To</label>
                      <div className="flex gap-4 mb-2 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="assignmentMode" value="centre_admin" checked={templateForm.assignmentMode === "centre_admin"} onChange={handleTemplateFormChange} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                          <span className="flex items-center gap-1 text-xs font-medium text-slate-700"><FiUser size={12} />Centre Admin</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="assignmentMode" value="all_staff" checked={templateForm.assignmentMode === "all_staff"} onChange={handleTemplateFormChange} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                          <span className="flex items-center gap-1 text-xs font-medium text-slate-700"><FiUsers size={12} />All Staff</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="assignmentMode" value="specific_staff" checked={templateForm.assignmentMode === "specific_staff"} onChange={handleTemplateFormChange} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                          <span className="flex items-center gap-1 text-xs font-medium text-slate-700"><FiUserPlus size={12} />Specific Staff</span>
                        </label>
                      </div>

                      {templateForm.assignmentMode === "specific_staff" && (
                        <div className="mt-2">
                          <select name="specificAssignee" value={templateForm.specificAssignee} onChange={handleTemplateFormChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition text-sm" required>
                            <option value="">Select staff member</option>
                            {staffList.map(staff => (<option key={staff.id} value={staff.id}>{staff.name} ({staff.role || 'Staff'})</option>))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Due After (days)</label>
                      <input type="number" name="dueOffsetDays" value={templateForm.dueOffsetDays} onChange={handleTemplateFormChange} min="0" max="30" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition text-sm" />
                      <p className="text-[10px] text-slate-500 mt-1 font-medium">Days from generation</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Priority</label>
                      <select name="priority" value={templateForm.priority} onChange={handleTemplateFormChange} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition text-sm">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>

                  {canCreateGlobal() && (
                    <div className="mt-4 pt-4 border-t border-indigo-200/60">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" name="isGlobal" checked={templateForm.isGlobal} onChange={handleTemplateFormChange} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                        <span className="flex items-center gap-2 text-xs font-semibold text-slate-700"><FiGlobe className="text-purple-600" size={14} />Make this a global template (applies to all centres)</span>
                      </label>
                    </div>
                  )}

                  <div className="mt-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" name="isActive" checked={templateForm.isActive} onChange={handleTemplateFormChange} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                      <span className="text-xs font-semibold text-slate-700">Template is active (will generate tasks on schedule)</span>
                    </label>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                  <FiInfo className="mt-0.5 shrink-0" size={14} />
                  <span>This template will not create tasks immediately. It will generate tasks on its next scheduled cycle (daily at 1 AM).{editingTemplate && " Changes will only affect future tasks, not existing ones."}</span>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => { setIsTemplateModalOpen(false); resetTemplateForm(); }} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-100 transition text-sm">Cancel</button>
                <button onClick={handleSaveTemplate} disabled={loading} className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-800 transition disabled:opacity-50 flex items-center gap-2 shadow-md shadow-indigo-500/20 text-sm">
                  {loading ? "Saving..." : (<><FiCheck size={14} />{editingTemplate ? "Update Template" : "Create Template"}</>)}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderTask = (task) => {
    const priorityColors = { high: "bg-rose-100 text-rose-800 border-rose-200", medium: "bg-amber-100 text-amber-800 border-amber-200", low: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    const assignee = staffList.find(s => s.id === task.assigned_to);
    const isFromTemplate = task.template_id !== null && task.template_id !== undefined;

    return (
      <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-3 flex-1">
            <button onClick={() => toggleTaskCompletion(task.id, task.status)} className={`mt-1 p-1 rounded-md flex-shrink-0 ${task.status === 'completed' ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-transparent hover:border-indigo-500'}`}><FiCheck size={14} /></button>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className={`font-semibold text-sm ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</h4>
                {isFromTemplate && (<span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold uppercase tracking-wider"><FiRepeat size={9} />Recurring</span>)}
                {task.centre_name && (<span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">{task.centre_name}</span>)}
              </div>
              {task.description && (<p className="text-xs text-slate-500 mt-1">{task.description}</p>)}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${priorityColors[task.priority] || priorityColors.medium}`}>{task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1) || 'Medium'}</span>
                {task.due_date && (<div className="flex items-center gap-1 text-xs text-slate-500 font-medium"><FiCalendar size={12} /><span>{new Date(task.due_date).toLocaleDateString()}</span></div>)}
                <div className="flex items-center gap-1 text-xs text-slate-500 font-medium"><FiUser size={12} /><span>{assignee?.name || `Staff #${task.assigned_to}`}</span></div>
              </div>
            </div>
          </div>
          <button onClick={() => deleteTask(task.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition flex-shrink-0"><FiTrash2 size={14} /></button>
        </div>
      </motion.div>
    );
  };

  const renderTemplate = (template) => {
    const getRecurrenceText = () => {
      const interval = template.recurrence_interval || 1;
      const type = template.recurrence_type;
      if (type === 'daily') return `Every ${interval} day${interval > 1 ? 's' : ''}`;
      if (type === 'weekly') { const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; return `Every ${interval} week${interval > 1 ? 's' : ''} on ${days[template.recurrence_day]}`; }
      if (type === 'monthly') return `Every ${interval} month${interval > 1 ? 's' : ''} on day ${template.recurrence_date}`;
      return '';
    };

    const getAssignmentText = () => {
      switch (template.assignment_mode) {
        case "centre_admin": return "Centre Admin";
        case "all_staff": return "All Staff";
        case "specific_staff": const assignee = staffList.find(s => s.id === template.assigned_to); return assignee ? assignee.name : "Specific Staff";
        default: return "Unknown";
      }
    };

    return (
      <motion.div key={template.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h4 className="font-semibold text-slate-800 text-sm">{template.title}</h4>
              {template.is_global && (<span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold uppercase tracking-wider"><FiGlobe size={9} />Global</span>)}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${template.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{template.is_active ? 'Active' : 'Paused'}</span>
            </div>
            {template.description && (<p className="text-xs text-slate-500 mb-2">{template.description}</p>)}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-1"><FiRepeat size={12} /><span>{getRecurrenceText()}</span></div>
              <div className="flex items-center gap-1"><FiUser size={12} /><span>{getAssignmentText()}</span></div>
              {template.due_offset_days > 0 && (<div className="flex items-center gap-1"><FiCalendar size={12} /><span>Due +{template.due_offset_days} days</span></div>)}
              {template.last_generated_at && (<div className="flex items-center gap-1"><FiClock size={12} /><span>Last: {new Date(template.last_generated_at).toLocaleDateString()}</span></div>)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => toggleTemplateStatus(template.id, template.is_active)} className={`p-2 rounded-lg transition ${template.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`} title={template.is_active ? 'Pause Template' : 'Activate Template'}>{template.is_active ? <FiPause size={15} /> : <FiPlay size={15} />}</button>
            {canEditTemplate(template) && (
              <>
                <button onClick={() => openTemplateModal(template)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Edit Template"><FiEdit size={15} /></button>
                <button onClick={() => deleteTemplate(template.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Delete Template"><FiTrash2 size={15} /></button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderTasksView = () => {
    const filteredTasks = getFilteredTasks();
    const pendingCount = tasks.filter(t => t.status === "pending" || !t.status).length;
    const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
    const completedCount = tasks.filter(t => t.status === "completed").length;

    const getAssigneeDetails = (task) => {
      if (!task.assigned_to) return null;
      if (String(task.assigned_to) === String(currentUser.id)) {
        const realName = localStorage.getItem("name") || task.assigned_to_name || currentUser.name;
        return {
          name: `${realName} (You)`,
          photo: user?.photo || localStorage.getItem('photo') || null
        };
      }
      return staffList.find(s => String(s.id) === String(task.assigned_to));
    };

    const getPriorityStyles = (priority) => {
      switch (priority?.toLowerCase()) {
        case 'high': return 'bg-rose-50 text-rose-700 border-rose-200';
        case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'low': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        default: return 'bg-slate-50 text-slate-700 border-slate-200';
      }
    };

    const getStatusStyles = (status) => {
      switch (status) {
        case 'completed': return 'bg-emerald-100 text-emerald-700';
        case 'in_progress': return 'bg-blue-100 text-blue-700';
        default: return 'bg-amber-100 text-amber-700';
      }
    };

    const columns = [
      { id: 'pending', title: 'To Do', icon: <FiCheckSquare className="text-slate-500 h-4 w-4" />, dot: 'bg-slate-400' },
      { id: 'in_progress', title: 'In Progress', icon: <FiPlayCircle className="text-blue-500 h-4 w-4" />, dot: 'bg-blue-500' },
      { id: 'completed', title: 'Completed', icon: <FiCheck className="text-emerald-500 h-4 w-4" />, dot: 'bg-emerald-500' }
    ];

    const updateTaskStatus = async (taskId, newStatus) => {
      setTasks(prev => prev.map(t => String(t.id) === String(taskId) ? { ...t, status: newStatus } : t));
      try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error();
        toast.success(`Task moved to ${newStatus.replace('_', ' ')}`);
        fetchCalendarData();
      } catch (err) {
        fetchTasks();
        toast.error("Failed to update task");
      }
    };

    const handleDragStart = (e, taskId) => {
      e.dataTransfer.setData('taskId', taskId);
      e.dataTransfer.effectAllowed = 'move';
    };
    const handleDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };
    const handleDrop = (e, status) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('taskId');
      const task = tasks.find(t => String(t.id) === taskId);
      if (task && task.status !== status) {
        updateTaskStatus(taskId, status);
      }
    };

    return (
      <div className="h-full overflow-y-auto p-6 bg-slate-50/60 custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                <span className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <FiCheckSquare className="text-white" size={18} />
                </span>
                Task Management
              </h1>
              <p className="text-slate-500 text-sm mt-1.5 font-medium ml-12">Manage tasks and recurring templates</p>
            </div>
            <div className="flex gap-3">
              {canCreateRecurring() && (
                <button onClick={() => openTemplateModal()} className="px-4 py-2.5 bg-white border border-purple-200 text-purple-700 rounded-xl hover:bg-purple-50 transition flex items-center gap-2 shadow-sm text-sm font-semibold">
                  <FiRepeat size={16} /> <span className="hidden sm:inline">New Template</span>
                </button>
              )}
              <button onClick={openTaskModal} className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition flex items-center gap-2 shadow-lg shadow-indigo-500/20 text-sm font-semibold">
                <FiPlusCircle size={16} /> <span className="hidden sm:inline">New Task</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { title: 'Total Tasks', value: tasks.length, gradient: 'from-slate-600 to-slate-700', icon: FiCheckSquare },
              { title: 'To Do', value: pendingCount, gradient: 'from-amber-500 to-amber-600', icon: FiAlertCircle },
              { title: 'In Progress', value: inProgressCount, gradient: 'from-blue-500 to-blue-600', icon: FiPlayCircle },
              { title: 'Completed', value: completedCount, gradient: 'from-emerald-500 to-emerald-600', icon: FiCheck },
            ].map(stat => (
              <motion.div key={stat.title} whileHover={{ y: -3 }} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-widest">{stat.title}</p>
                    <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-md`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Templates */}
          {canCreateRecurring() && templates.length > 0 && (
            <div className="mb-8">
              <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2 uppercase tracking-wider">
                <FiRepeat className="text-purple-600" size={16} /> Recurring Templates
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {templates.map(template => renderTemplate(template))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar w-full sm:w-auto">
              <FiFilter className="text-slate-400 ml-1 mr-1 h-4 w-4 flex-shrink-0" />
              {['all', 'pending', 'in_progress', 'completed'].map(f => (
                <button
                  key={f}
                  onClick={() => setTaskFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all whitespace-nowrap ${
                    taskFilter === f
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto justify-center">
              <button
                onClick={() => setTaskViewMode('board')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  taskViewMode === 'board' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <FiLayout size={14} /> Board
              </button>
              <button
                onClick={() => setTaskViewMode('list')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  taskViewMode === 'list' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <FiList size={14} /> List
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
              <p className="text-slate-500 mt-3 text-sm font-medium">Syncing tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200 shadow-sm">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FiCheckSquare className="text-slate-400" size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">No tasks assigned yet</h3>
              <p className="text-slate-500 text-sm mb-5">Get started by creating your first task.</p>
              <button onClick={openTaskModal} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition inline-flex items-center gap-2 text-sm font-semibold shadow-lg shadow-indigo-500/20">
                <FiPlusCircle size={16} /> Create New Task
              </button>
            </div>
          ) : taskViewMode === 'board' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              {columns.map(column => (
                <div
                  key={column.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.id)}
                  className="bg-slate-100/70 rounded-2xl p-3 min-h-[50vh] flex flex-col border border-slate-200/80 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between mb-3 px-1.5">
                    <div className="flex items-center gap-2">
                      {column.icon}
                      <h3 className="font-bold text-slate-800 text-sm">{column.title}</h3>
                    </div>
                    <span className="bg-white text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm border border-slate-200">
                      {tasks.filter(t => (t.status || 'pending') === column.id).length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-2.5">
                    <AnimatePresence>
                      {tasks.filter(t => (t.status || 'pending') === column.id).map(task => {
                        const assignee = getAssigneeDetails(task);
                        const assigneePhoto = assignee?.photo ? getAvatarUrl(assignee.photo) : null;

                        return (
                          <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <h4 className={`text-sm font-bold text-slate-900 leading-tight ${task.status === 'completed' ? 'line-through text-slate-400' : ''}`}>
                                {task.title}
                              </h4>
                              <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <FiTrash2 size={14} />
                              </button>
                            </div>

                            {task.description && (
                              <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            <div className="flex items-end justify-between mt-2 pt-2.5 border-t border-slate-100">
                              <div className="flex flex-col gap-1.5">
                                <span className={`w-fit text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-wider font-bold border ${getPriorityStyles(task.priority)}`}>
                                  {task.priority || 'Medium'}
                                </span>
                                {task.due_date && (
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold" title="Due Date">
                                    <FiCalendar size={10} /> {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 bg-slate-50 pl-1 pr-2 py-1 rounded-full border border-slate-100 shadow-sm" title={assignee?.name || 'Unassigned'}>
                                <div className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center text-[9px] font-bold text-indigo-700 border border-indigo-100 overflow-hidden shrink-0">
                                  {assigneePhoto ? (
                                    <img src={assigneePhoto} alt="Assignee" className="w-full h-full object-cover" />
                                  ) : (
                                    assignee?.name?.charAt(0) || 'U'
                                  )}
                                </div>
                                <span className="text-[10px] font-bold text-slate-700 truncate max-w-[65px]">
                                  {assignee?.name?.split(' ')[0] || 'Unassigned'}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                    {tasks.filter(t => (t.status || 'pending') === column.id).length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs font-medium">
                        Drop tasks here
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70">
                      <th className="py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest w-10">Status</th>
                      <th className="py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Task Name</th>
                      <th className="py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest w-40">Assignee</th>
                      <th className="py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest w-24">Priority</th>
                      <th className="py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest w-28">Due Date</th>
                      <th className="py-3 px-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest w-28">Stage</th>
                      <th className="py-3 px-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <AnimatePresence>
                      {filteredTasks.map(task => {
                        const assignee = getAssigneeDetails(task);
                        const assigneePhoto = assignee?.photo ? getAvatarUrl(assignee.photo) : null;

                        return (
                          <motion.tr
                            key={task.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="hover:bg-slate-50/80 transition-colors group"
                          >
                            <td className="py-3 px-4">
                              <button
                                onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                                className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                                  task.status === 'completed'
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'border-2 border-slate-300 text-transparent hover:border-emerald-500'
                                }`}
                              >
                                <FiCheck size={12} strokeWidth={3} />
                              </button>
                            </td>
                            <td className="py-3 px-4 min-w-[200px]">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-semibold text-slate-900 ${task.status === 'completed' ? 'line-through text-slate-400' : ''}`}>
                                  {task.title}
                                </p>
                                {task.template_id && (
                                  <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded flex items-center gap-1 uppercase font-bold tracking-wider">
                                    <FiRepeat size={8} /> Recurring
                                  </span>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-xs text-slate-500 truncate max-w-md mt-0.5">
                                  {task.description}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
                                <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-[10px] font-bold border border-indigo-100 overflow-hidden shrink-0 shadow-sm">
                                  {assigneePhoto ? (
                                    <img src={assigneePhoto} alt="Assignee" className="w-full h-full object-cover" />
                                  ) : (
                                    assignee?.name?.charAt(0) || 'U'
                                  )}
                                </div>
                                <span className="truncate max-w-[120px]">{assignee?.name || 'Unassigned'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-wider font-bold border ${getPriorityStyles(task.priority)}`}>
                                {task.priority || 'Medium'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {task.due_date ? (
                                <span className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                                  <FiCalendar className="text-slate-400" size={12} />
                                  {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider ${getStatusStyles(task.status || 'pending')}`}>
                                {(task.status || 'pending').replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button onClick={() => deleteTask(task.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100">
                                <FiTrash2 size={14} />
                              </button>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
                {filteredTasks.length === 0 && (
                  <div className="text-center py-10">
                    <FiList className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-500">No tasks match your filter.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCalendarView = () => {
    return (
      <div className="h-full overflow-y-auto p-6 bg-slate-50/60 custom-scrollbar">
        {calendarLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : calendarError ? (
          <div className="flex flex-col items-center justify-center h-64 text-rose-500">
            <FiAlertCircle size={48} className="mb-4" />
            <p className="text-lg font-bold">Error loading calendar</p>
            <p className="text-sm text-slate-500">{calendarError}</p>
            <button onClick={fetchCalendarData} className="mt-4 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition flex items-center gap-2 shadow-md shadow-indigo-500/20 font-semibold text-sm">
              <FiRefreshCw size={16} />Retry
            </button>
          </div>
        ) : (
          <CalendarView
            calendarData={calendarData}
            leavesData={leavesData}
            onAddEvent={openAddEventModal}
            onEditEvent={openEditEventModal}
            onDeleteEvent={handleDeleteEvent}
            onUpdateEvent={handleUpdateEvent}
            userRole={currentUser.role}
            centresMap={centresMap}
          />
        )}
      </div>
    );
  };

  const navItems = [
    { id: 'chats', label: 'Chats', icon: FiMessageSquare, badge: conversations.reduce((acc, conv) => acc + (conv.unread || 0), 0) },
    { id: 'activity', label: 'Activity', icon: FiActivity },
    { id: 'calendar', label: 'Calendar', icon: FiCalendar },
    { id: 'files', label: 'Files', icon: FiGrid },
    { id: 'tasks', label: 'Tasks', icon: FiCheckSquare },
    { id: 'schedules', label: 'Schedules', icon: FiClock },
  ];

  const renderNavigationSidebar = () => (
    <div className="hidden md:flex flex-col items-center py-5 w-[72px] bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 h-full flex-shrink-0 shadow-xl border-r border-slate-800/50">
      <div className="mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <FiSend className="text-white" size={18} />
        </div>
      </div>

      <nav className="flex-1 w-full px-3">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            return (
              <li key={item.id} className="relative group">
                <button
                  onClick={() => setActiveView(item.id)}
                  className={`relative w-full h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? "bg-white text-slate-900 shadow-lg"
                      : "text-slate-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon size={19} />
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-gradient-to-br from-rose-400 to-rose-500 text-white text-[10px] rounded-full flex items-center justify-center px-1 font-bold ring-2 ring-slate-900">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
                <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50 shadow-xl border border-slate-700/50">
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto w-full px-3">
        <div className="w-full h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 font-bold text-sm">
          {currentUser.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      </div>
    </div>
  );

  const renderPlaceholderView = (title) => (
    <div className="flex flex-col items-center justify-center p-6 text-center h-full bg-slate-50/60">
      <div className="w-20 h-20 bg-white border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
        {activeView === "chats" && <FiMessageSquare size={28} className="text-slate-400" />}
        {activeView === "activity" && <FiActivity size={28} className="text-slate-400" />}
        {activeView === "calendar" && <FiCalendar size={28} className="text-slate-400" />}
        {activeView === "files" && <FiGrid size={28} className="text-slate-400" />}
        {activeView === "tasks" && <FiCheckSquare size={28} className="text-slate-400" />}
        {activeView === "schedules" && <FiClock size={28} className="text-slate-400" />}
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">{title} View</h3>
      <p className="text-slate-500 max-w-md text-sm">{title} content will be displayed here. This is a placeholder view.</p>
    </div>
  );

  // ============== MAIN RETURN ==============

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden w-full">
      <AnimatePresence mode="wait">
        {isNewChatModalOpen && (<NewChatModal key="new-chat-modal" isOpen={isNewChatModalOpen} onClose={() => setIsNewChatModalOpen(false)} onCreate={handleCreateConversation} staffList={staffList} centresMap={centresMap} />)}
      </AnimatePresence>

      {renderRegularTaskModal()}
      {renderTemplateModal()}
      {renderEventModal()}
      {renderQuickNoteModal()}

      {apiError && (
        <div className="fixed top-0 left-0 right-0 bg-rose-500 text-white p-2 text-center z-50 shadow-lg">
          {apiError}
          <button onClick={() => setApiError(null)} className="ml-4 px-2 py-1 bg-white text-rose-500 rounded-md hover:bg-rose-50 transition font-semibold text-xs">
            Dismiss
          </button>
        </div>
      )}

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} className="bg-white w-4/5 h-full shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between p-4 border-b border-slate-200">
                <h2 className="text-slate-800 font-bold">Messages</h2>
                <FiX onClick={() => setIsMobileMenuOpen(false)} className="text-slate-500 cursor-pointer" size={24} />
              </div>
              {renderConversationList()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-gradient-to-r from-slate-900 to-indigo-900 text-white z-30 flex items-center px-4 shadow-lg">
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-white">
          <FiMenu size={24} />
        </button>
        <h2 className="text-lg font-bold ml-4 tracking-tight">
          {activeView === "chats" ? "Messages" : activeView === "tasks" ? "Tasks" : activeView === "calendar" ? "Calendar" : activeView === "files" ? "Files" : activeView === "activity" ? "Activity" : "Schedules"}
        </h2>
        <div className="ml-auto flex gap-3">
          <FiBell />
          {activeView === "chats" && (<FiPlus onClick={() => setIsNewChatModalOpen(true)} />)}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 w-full">
        <div className="hidden md:block flex-shrink-0">{renderNavigationSidebar()}</div>

        {activeView === "chats" && (
          <div className="hidden md:flex md:w-[340px] lg:w-[380px] h-full flex-col overflow-hidden border-r border-slate-200/80 flex-shrink-0">
            {renderConversationList()}
          </div>
        )}

        <div className={`flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-white ${activeView === "chats" && activeConversation && isContactPanelOpen ? 'lg:w-1/2' : ''}`}>
          <div className="md:hidden flex-none h-16 w-full"></div>
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 w-full">
            {activeView === "chats" ? (
              <div className="flex h-full">
                <Chat
                  activeConversation={activeConversation}
                  messages={messages}
                  currentUser={currentUser}
                  loadingChat={loadingChat}
                  typingUsers={typingUsers}
                  onSendMessage={handleSendMessage}
                  onDeleteMessage={handleDeleteMessage}
                  onOpenTaskModal={openTaskModal}
                  onOpenNewChatModal={() => setIsNewChatModalOpen(true)}
                  onBack={() => setActiveConversation(null)}
                  onlineUsers={onlineUsers}
                  serviceEntryId={activeConversation?.context_type === 'service_entry' ? activeConversation.context_id : null}
                  serviceInfo={{ tasks: tasks }}
                  allTasks={tasks}
                  onTaskStatusUpdate={handleServiceTaskStatusUpdate}
                  onNormalTaskStatusUpdate={handleNormalTaskStatusUpdate}
                  onDeleteConversation={handleDeleteConversation}
                />
              </div>
            ) : activeView === "activity" ? (
              <div className="h-full overflow-y-auto"><ActivityPanel token={token} userRole={currentUser.role} /></div>
            ) : activeView === "calendar" ? (
              <div className="h-full overflow-y-auto">{renderCalendarView()}</div>
            ) : activeView === "files" ? (
              <div className="h-full overflow-y-auto"><FilesView user={currentUser} /></div>
            ) : activeView === "tasks" ? (
              <div className="h-full overflow-y-auto">{renderTasksView()}</div>
            ) : activeView === "schedules" ? (
              <div className="h-full overflow-y-auto">{renderPlaceholderView("Schedules")}</div>
            ) : (
              <div className="h-full overflow-y-auto">{renderPlaceholderView("Chat")}</div>
            )}
          </div>
        </div>

        {activeView === "chats" && activeConversation && (
          <>
            <button
              onClick={() => setIsContactPanelOpen(!isContactPanelOpen)}
              className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 z-20 w-6 h-24 bg-white hover:bg-slate-100 border border-slate-200 rounded-l-xl items-center justify-center transition-all duration-300 cursor-pointer shadow-md ${isContactPanelOpen ? 'right-[25%]' : 'right-0'}`}
              style={{ transform: 'translateY(-50%)', marginRight: isContactPanelOpen ? '-12px' : '0' }}
            >
              <FiChevronRight className={`text-slate-600 transition-transform ${isContactPanelOpen ? '' : 'rotate-180'}`} />
            </button>
            <div className={`hidden lg:flex ${isContactPanelOpen ? 'lg:w-[25%] lg:min-w-[320px] lg:max-w-[400px]' : 'w-0'} h-full flex-col overflow-hidden border-l border-slate-200/80 flex-shrink-0 transition-all duration-300 relative`}>
              {renderContactPanel()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MessengerPage;

const styles = `
  :root { --navy-700: #4f46e5; --navy-800: #4338ca; }
  .bg-navy-700 { background-color: var(--navy-700); }
  .bg-navy-800 { background-color: var(--navy-800); }
  .text-navy-700 { color: var(--navy-700); }
  .hover\\:bg-navy-800:hover { background-color: var(--navy-800); }
  .hover\\:text-navy-700:hover { color: var(--navy-700); }
  .border-navy-700 { border-color: var(--navy-700); }
  .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.25); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.45); }
  .hide-scrollbar::-webkit-scrollbar { display: none; }
  .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  .fixed { -webkit-transform: translateZ(0); transform: translateZ(0); backface-visibility: hidden; perspective: 1000px; }
  .lg\\:flex.absolute { pointer-events: auto; z-index: 30; }
  .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
`;

export const MessengerStyle = () => <style>{styles}</style>;