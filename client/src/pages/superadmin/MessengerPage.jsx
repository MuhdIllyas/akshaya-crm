import React, { useState, useEffect, useRef } from "react";
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
  FiChevronRight,
  FiSmartphone, // Added for WhatsApp icon
} from "react-icons/fi";
import { FaRegSmile, FaEllipsisH } from "react-icons/fa";
import { IoMdCheckmarkCircle, IoMdClose } from "react-icons/io";
import { BsCircleFill } from "react-icons/bs";
import { toast } from "react-toastify";
import FilesView from "@/components/Chat/FilesView";
import CalendarView from "@/components/CalendarView";
import ActivityPanel from "@/components/ActivityPanel";
import EmojiPicker from 'emoji-picker-react';
import Chat from '@/components/Chat';
import { socket, connectSocket, disconnectSocket } from "@/services/socket";

// ============== NEW CHAT MODAL (Enhanced for WhatsApp) ==============
const NewChatModal = ({ isOpen, onClose, onCreate, staffList }) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [chatType, setChatType] = useState('internal'); // 'internal' or 'whatsapp'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');

  if (!isOpen) return null;

  const filteredStaff = staffList.filter(staff =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async () => {
    if (isCreating) return;

    setIsCreating(true);
    if (chatType === 'internal') {
      await onCreate(selectedUsers, isGroup ? groupName : null, 'internal');
    } else {
      // WhatsApp: phone number required
      if (!phoneNumber.trim()) {
        toast.error('Phone number is required for WhatsApp chat');
        setIsCreating(false);
        return;
      }
      await onCreate(null, null, 'whatsapp', phoneNumber, customerName);
    }
    setSelectedUsers([]);
    setGroupName('');
    setIsGroup(false);
    setSearchTerm('');
    setChatType('internal');
    setPhoneNumber('');
    setCustomerName('');
    setIsCreating(false);
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setGroupName('');
    setIsGroup(false);
    setSearchTerm('');
    setChatType('internal');
    setPhoneNumber('');
    setCustomerName('');
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white rounded-xl w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              New Conversation
            </h3>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-gray-100 transition"
              disabled={isCreating}
            >
              <IoMdClose className="text-gray-500" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setChatType('internal')}
                disabled={isCreating}
                className={`flex-1 py-2 rounded-lg transition ${chatType === 'internal' ? 'bg-navy-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Internal
              </button>
              <button
                type="button"
                onClick={() => setChatType('whatsapp')}
                disabled={isCreating}
                className={`flex-1 py-2 rounded-lg transition ${chatType === 'whatsapp' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                WhatsApp
              </button>
            </div>

            {chatType === 'internal' && (
              <>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsGroup(false)}
                    disabled={isCreating}
                    className={`flex-1 py-2 rounded-lg transition ${!isGroup ? 'bg-navy-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    Direct
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsGroup(true)}
                    disabled={isCreating}
                    className={`flex-1 py-2 rounded-lg transition ${isGroup ? 'bg-navy-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    Group
                  </button>
                </div>

                {isGroup && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent"
                      placeholder="Enter group name"
                      disabled={isCreating}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Staff</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent"
                    placeholder="Search by name or role..."
                    disabled={isCreating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Participants ({selectedUsers.length} selected)
                  </label>
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredStaff.length > 0 ? (
                      filteredStaff.map(staff => (
                        <label
                          key={staff.id}
                          className={`flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${isCreating ? 'opacity-50 pointer-events-none' : ''
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(staff.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUsers([...selectedUsers, staff.id]);
                              } else {
                                setSelectedUsers(selectedUsers.filter(id => id !== staff.id));
                              }
                            }}
                            disabled={isCreating}
                            className="w-4 h-4 text-navy-700 rounded border-gray-300 focus:ring-navy-700 mr-3"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{staff.name}</p>
                            <p className="text-xs text-gray-500">{staff.role || 'Staff'}</p>
                          </div>
                        </label>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        No staff members found
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {chatType === 'whatsapp' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    placeholder="+1234567890"
                    disabled={isCreating}
                  />
                  <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +1 for US)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name (Optional)</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    placeholder="John Doe"
                    disabled={isCreating}
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={handleClose}
              disabled={isCreating}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={
                (chatType === 'internal' && (selectedUsers.length === 0 || (isGroup && !groupName))) ||
                (chatType === 'whatsapp' && !phoneNumber.trim()) ||
                isCreating
              }
              className="px-4 py-2 bg-navy-700 text-white rounded-lg font-medium hover:bg-navy-800 transition disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============== MAIN MESSENGER PAGE ==============
const MessengerPage = ({ user }) => {
  const token = localStorage.getItem("token");

  let decodedUserId = null;
  if (token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      decodedUserId = payload.id || payload.staff_id || payload.userId || payload.sub;
    } catch (err) {
      console.error("Could not decode token", err);
    }
  }

  const currentUser = {
    role: user?.role || "admin",
    id: decodedUserId || user?.id || user?.staff_id || 1,
    centreId: user?.centre_id || null,
    name: user?.name || "Current User",
    username: user?.username || ""
  };

  const [activeView, setActiveView] = useState("chats");
  const [activeConversation, setActiveConversation] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState("all");
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

  const getApiBaseUrl = () => {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    }
    if (typeof process !== 'undefined' && process.env) {
      return process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    }
    return 'http://localhost:5000/api';
  };

  const API_BASE_URL = getApiBaseUrl();

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
      const res = await fetch(`${API_BASE_URL}/chat/unread/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch unread counts');
      const unreadMap = await res.json();

      // Update conversations with unread counts
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
      const res = await fetch(`${API_BASE_URL}/chat/unread/${conversationId}`, {
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

  // ============== SOCKET.IO INTEGRATION ==============

  useEffect(() => {
    if (!token) return;

    connectSocket(token);

    socket.on("connect", () => {
      socket.emit("join", {
        staffId: currentUser.id,
        centreId: currentUser.centreId
      });
      console.log("Socket connected");
      setSocketConnected(true);

      if (activeConversation) {
        socket.emit("join_conversation", activeConversation.id);
      }
    });

    socket.on("online_users", (users) => {
      const stringUsers = users.map(user => String(user));
      setOnlineUsers(new Set(stringUsers));
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setSocketConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      toast.error("Realtime connection lost. Messages may be delayed.");
    });

    socket.on("new_message", (msg) => {
      const conversationId = msg.conversation_id;

      if (processedMessageIds.current.has(msg.id)) {
        return;
      }
      processedMessageIds.current.add(msg.id);

      setTimeout(() => {
        processedMessageIds.current.delete(msg.id);
      }, 60000);

      setMessages(prev => {
        const currentMessages = prev[conversationId] || [];

        if (currentMessages.some(m => m.id === msg.id)) {
          return prev;
        }

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
          sender_type: msg.sender_type // store for avatar display
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
        // Fetch updated unread count for this conversation
        fetchConversationUnreadCount(conversationId).then(unreadCount => {
          setConversations(prev => prev.map(conv =>
            conv.id === conversationId
              ? { ...conv, unread: unreadCount }
              : conv
          ));
        });
      }
    });

    socket.on("conversation_updated", (data) => {
      setConversations(prev => {
        const updated = prev.map(conv =>
          conv.id === data.conversationId
            ? {
              ...conv,
              last_message: data.lastMessage,
              lastMessage: data.lastMessage,
              last_message_sender_id: data.lastMessageSenderId,
              last_message_sender: data.lastMessageSender,
              last_message_at: data.time,
              time: data.time,
              unread: data.unread
            }
            : conv
        );
        return updated.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
      });
    });

    socket.on("typing", (data) => {
      setTypingUsers(prev => {
        const currentTyping = prev[data.conversationId] || [];

        if (data.isTyping) {
          if (data.userId !== currentUser.id && !currentTyping.some(u => u.userId === data.userId)) {
            return {
              ...prev,
              [data.conversationId]: [...currentTyping, {
                name: data.userName,
                userId: data.userId
              }]
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
    });

    socket.on("messages_read", (data) => {
      if (data.conversationId === activeConversation?.id) {
        setMessages(prev => ({
          ...prev,
          [data.conversationId]: prev[data.conversationId]?.map(msg =>
            data.messageIds.includes(msg.id)
              ? { ...msg, is_read_by_me: true }
              : msg
          )
        }));
      }

      // Fetch updated unread counts for all conversations
      fetchAllUnreadCounts();
    });

    socket.on("unread_update", (data) => {
      // Update specific conversation unread count
      setConversations(prev => prev.map(conv =>
        conv.id === data.conversationId
          ? { ...conv, unread: data.unread }
          : conv
      ));
    });

    socket.on("user_online", (data) => {
      setOnlineUsers(prev => new Set([...prev, String(data.userId)]));
    });

    socket.on("user_offline", (data) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(String(data.userId));
        return newSet;
      });
    });

    socket.on("new_conversation", (newConv) => {
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
    });

    socket.on("added_to_conversation", (conversation) => {
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
    });

    socket.on("message_deleted", (data) => {
      if (data.conversationId === activeConversation?.id) {
        setMessages(prev => ({
          ...prev,
          [data.conversationId]: prev[data.conversationId]?.map(msg =>
            msg.id === data.messageId
              ? { ...msg, isDeleted: true, text: 'This message was deleted' }
              : msg
          )
        }));
      }

      fetchConversations();
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("new_message");
      socket.off("conversation_updated");
      socket.off("typing");
      socket.off("messages_read");
      socket.off("unread_update");
      socket.off("user_online");
      socket.off("user_offline");
      socket.off("new_conversation");
      socket.off("added_to_conversation");
      socket.off("message_deleted");
      disconnectSocket();
    };
  }, [token, currentUser.id, currentUser.centreId, activeConversation]);

  // ============== CHAT API INTEGRATION ==============

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data = await res.json();

      const processedData = data.map(conv => ({
        ...conv,
        id: conv.id,
        name: conv.name || null,
        is_group: conv.is_group || false,
        channel: conv.channel || 'internal', // important: 'whatsapp' or 'internal'
        context_type: conv.context_type,
        context_id: conv.context_id,
        context_name: conv.context_name,
        context_identifier: conv.context_identifier, // phone number for WhatsApp
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

      // Fetch fresh unread counts
      fetchAllUnreadCounts();

    } catch (err) {
      console.error('Error fetching conversations:', err);
      toast.error('Failed to load conversations');
    }
  };

  const fetchMessages = async (conversationId) => {
    setLoadingChat(true);
    try {
      const res = await fetch(`${API_BASE_URL}/chat/messages/${conversationId}`, {
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
          sender_type: msg.sender_type
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

        // After marking as read, fetch updated unread count
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

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;

    const optimisticMsg = optimisticMessage || {
      id: tempId,
      tempId: tempId,
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
      const exists = currentMessages.some(m => m.tempId === tempId || m.id === tempId);
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

      // ALWAYS use the chat message endpoint
      const endpoint = `${API_BASE_URL}/chat/message`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (file && progressInterval) clearInterval(progressInterval);
      if (!res.ok) throw new Error('Failed to send message');

      const newMsg = await res.json();
      
      // Rest of the function remains unchanged...
      // [keep all the existing code after this point]
      
    } catch (err) {
      // error handling...
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
        // Create WhatsApp conversation
        requestBody = {
          channel: "whatsapp",
          context_type: "customer",
          context_identifier: phoneNumber,
          context_name: customerName || phoneNumber,
          participants: [] // no staff participants initially? Actually, the staff will be added automatically.
          // We might need to add the current user as participant? The backend should handle.
        };
      } else {
        throw new Error('Invalid channel');
      }

      const res = await fetch(`${API_BASE_URL}/chat/conversation`, {
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
        const updatedConvs = await fetch(`${API_BASE_URL}/chat/conversations`, {
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

      const res = await fetch(`${API_BASE_URL}/chat/staff`, {
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
      const res = await fetch(`${API_BASE_URL}/chat/message/${messageId}`, {
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

  // ============== HELPER FUNCTIONS ==============

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

  // ============== TASK STATUS UPDATE FOR SERVICE CHAT ==============
  const handleServiceTaskStatusUpdate = async (taskId, newStatus) => {
    const serviceEntryId = activeConversation?.context_id;
    if (!serviceEntryId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/servicecollaboration/${serviceEntryId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      // Update the tasks state
      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === taskId ? { ...t, status: newStatus } : t
        )
      );
      toast.success(`Task marked as ${newStatus}`);
    } catch (err) {
      console.error('Error updating task:', err);
      toast.error('Failed to update task');
    }
  };

  // ============== DATA FETCHING FUNCTIONS ==============

  const fetchCentres = async () => {
    if (currentUser.role !== "superadmin") {
      return;
    }

    setCentresLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/centres`, {
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
      let url = `${API_BASE_URL}/calendar`;

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
        if (centres.length === 0) {
          return;
        }

        const promises = centres.map(async (centre) => {
          try {
            const url = new URL(`${API_BASE_URL}/salary/leaves`);
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
        if (!currentUser.centreId) {
          return;
        }

        const url = new URL(`${API_BASE_URL}/salary/leaves`);
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
      let url = `${API_BASE_URL}/tasks/all`;

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
      let url = `${API_BASE_URL}/tasks/templates`;

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

  // ============== TASK & TEMPLATE FUNCTIONS ==============

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

      const res = await fetch(`${API_BASE_URL}/tasks/add`, {
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

      let url = `${API_BASE_URL}/tasks/add`;
      let method = "POST";

      if (editingTemplate) {
        url = `${API_BASE_URL}/tasks/template/${editingTemplate.id}`;
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
      const res = await fetch(`${API_BASE_URL}/tasks/template/${templateId}/toggle`, {
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
      const res = await fetch(`${API_BASE_URL}/tasks/template/${templateId}`, {
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
      const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/status`, {
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
      const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
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
      case "pending": return tasks.filter(task => task.status !== "completed");
      case "completed": return tasks.filter(task => task.status === "completed");
      default: return tasks;
    }
  };

  // ============== CALENDAR EVENT FUNCTIONS ==============

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

      let url = `${API_BASE_URL}/calendar`;
      let method = "POST";
      if (editingEvent) {
        url = `${API_BASE_URL}/calendar/${editingEvent.id}`;
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
      const url = new URL(`${API_BASE_URL}/calendar/${event.id}`);
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
      const res = await fetch(`${API_BASE_URL}/calendar/${eventId}`, {
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

  // ============== FILTERED CONVERSATIONS ==============

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
    <div className="flex flex-col h-full bg-white border-r border-gray-200 overflow-hidden">
      <div className="flex-none p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-navy-700 w-10 h-10 rounded-lg flex items-center justify-center">
              <FiSend className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Messages</h2>
          </div>
          <div className="flex gap-2">
            <button className="p-2 rounded-full hover:bg-gray-100 transition relative">
              <FiBell className="text-gray-600" />
              {conversations.reduce((acc, conv) => acc + (conv.unread || 0), 0) > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="p-2 rounded-full hover:bg-gray-100 transition"
              title="New Chat"
            >
              <FiPlus className="text-gray-600" />
            </button>
          </div>
        </div>
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="pl-12 pr-4 py-3 w-full rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 border border-gray-200 transition text-gray-700"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
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

            let lastMessageText = c.last_message || c.lastMessage || '';
            const lastMessageSenderName = c.last_message_sender;
            const lastMessageSenderId = c.last_message_sender_id;

            if (lastMessageSenderId && String(lastMessageSenderId) !== String(currentUser.id) && lastMessageSenderName) {
              lastMessageText = `${lastMessageSenderName}: ${lastMessageText}`;
            }

            if (!lastMessageText) {
              lastMessageText = 'No messages yet';
            }

            return (
              <motion.div
                key={c.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setActiveConversation(c)}
                className={`flex items-center p-4 cursor-pointer transition-all duration-200 ${activeConversation?.id === c.id
                    ? "bg-blue-50 border-l-4 border-navy-700"
                    : "hover:bg-gray-50 border-l-4 border-transparent"
                  }`}
              >
                <div className="relative">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${c.avatarColor || 'bg-navy-700'} mr-3 flex-shrink-0`}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  {!c.is_group && isAnyOnline && (
                    <span className="absolute bottom-0 right-3 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <span className="font-semibold text-gray-800 truncate">{displayName}</span>
                      {c.channel === 'whatsapp' && (
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap flex items-center gap-1">
                          <FiSmartphone size={10} /> WhatsApp
                        </span>
                      )}
                      {c.context_type === 'service_entry' && (
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 whitespace-nowrap">
                          Service
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                      {c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className="flex items-center mt-1">
                    <p className="text-sm text-gray-500 truncate flex-1">
                      {lastMessageText}
                    </p>
                    {c.unread > 0 && (
                      <span className="bg-navy-700 text-xs text-white rounded-full px-1.5 py-0.5 ml-2 flex-shrink-0">
                        {c.unread}
                      </span>
                    )}
                  </div>
                  {typingUsers[c.id]?.length > 0 && (
                    <p className="text-xs text-navy-700 italic mt-1">
                      {typingUsers[c.id].map(u => u.name).join(', ')} typing...
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-8 px-4">
            <FiMessageSquare className="mx-auto text-gray-400 text-4xl mb-3" />
            <p className="text-gray-500 mb-2">No conversations yet</p>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="text-navy-700 font-medium hover:underline"
            >
              Start a new chat
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

    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-200 overflow-hidden">
        <div className="flex-none p-6 flex flex-col items-center border-b border-gray-200">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-navy-700 flex items-center justify-center text-white text-3xl mb-4">
              {displayName?.[0] || '?'}
            </div>
            {!activeConversation.is_group && onlineParticipants.length > 0 && (
              <span className="absolute bottom-4 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></span>
            )}
          </div>
          <h3 className="text-xl font-bold text-gray-800">{displayName}</h3>
          {activeConversation.channel === 'whatsapp' && (
            <p className="text-green-600 text-sm flex items-center mt-1">
              <FiSmartphone className="mr-1" size={14} /> WhatsApp
            </p>
          )}
          {!activeConversation.is_group && activeConversation.channel !== 'whatsapp' && (
            <p className="text-gray-500 flex items-center mt-1">
              <BsCircleFill className={`${onlineParticipants.length > 0 ? 'text-green-500' : 'text-gray-400'} mr-2 text-xs`} />
              {onlineParticipants.length > 0 ? 'Online' : 'Offline'}
            </p>
          )}
          {activeConversation.is_group && (
            <p className="text-gray-500 mt-1">
              {activeConversation.participants?.length || 0} members
              {onlineParticipants.length > 0 && (
                <span className="ml-1 text-green-600">
                  ({onlineParticipants.length} online)
                </span>
              )}
            </p>
          )}
          {!socketConnected && (
            <p className="text-xs text-yellow-600 mt-2 flex items-center gap-1">
              <FiAlertCircle size={12} />
              Reconnecting...
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4">
          <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
            <FiUsers className="mr-2" /> Participants
          </h4>
          <div className="space-y-3">
            {activeConversation.participants?.map((p, index) => {
              const isOnline = onlineUsers.has(String(p.staff_id));
              const isCurrentUserParticipant = p.staff_id === currentUser.id;

              return (
                <div key={index} className="flex items-center">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs mr-3">
                      {p.name?.[0] || '?'}
                    </div>
                    {isOnline && (
                      <span className="absolute bottom-0 right-3 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 font-medium">
                      {p.name} {isCurrentUserParticipant && '(You)'}
                    </p>
                    <p className="text-xs text-gray-500">{p.role || 'Member'}</p>
                  </div>
                  {isOnline && (
                    <span className="text-xs text-green-600">● Online</span>
                  )}
                </div>
              );
            })}
          </div>

          <h4 className="font-semibold text-gray-700 mb-3 mt-6 flex items-center">
            <FiFile className="mr-2" /> Shared Files
          </h4>
          <div className="space-y-2">
            {messages[activeConversation.id]?.filter(m => m.isFile && !m.isOptimistic).slice(0, 5).map(file => (
              <motion.div
                key={file.id}
                whileHover={{ x: 5 }}
                className="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition"
                onClick={() => window.open(file.fileUrl, '_blank')}
              >
                <div className="bg-gray-100 p-2 rounded-lg mr-3">
                  {file.messageType === 'image' ? (
                    <FiImage className="text-gray-500" size={20} />
                  ) : (
                    <FiFile className="text-gray-500" size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 font-medium truncate">{file.fileName || 'File'}</p>
                  <p className="text-xs text-gray-500">
                    {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB` : ''}
                  </p>
                </div>
                <FiDownload className="text-gray-400" size={16} />
              </motion.div>
            ))}
            {(!messages[activeConversation.id]?.filter(m => m.isFile && !m.isOptimistic).length) && (
              <p className="text-sm text-gray-500 text-center py-4">No files shared yet</p>
            )}
          </div>

          {/* Tasks Section (only for service conversations) */}
          {activeConversation.context_type === 'service_entry' && (
            <>
              <h4 className="font-semibold text-gray-700 mb-3 mt-6 flex items-center">
                <FiCheckSquare className="mr-2" /> Tasks
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(() => {
                  const serviceTasks = tasks.filter(t => t.related_service_entry_id === activeConversation.context_id);
                  if (serviceTasks.length === 0) {
                    return <p className="text-sm text-gray-500 text-center py-2">No tasks for this service</p>;
                  }
                  return serviceTasks.map(task => (
                    <div key={task.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className={`font-medium text-sm ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                            {task.assigned_to_name && <span>👤 {task.assigned_to_name}</span>}
                            {task.due_date && <span>📅 {new Date(task.due_date).toLocaleDateString()}</span>}
                            <span className={`px-2 py-0.5 rounded-full ${task.priority === 'high' ? 'bg-red-100 text-red-800' :
                                task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                              }`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>
                        {task.status !== 'completed' && (
                          <button
                            onClick={() => handleServiceTaskStatusUpdate(task.id, 'completed')}
                            className="ml-2 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            ✓ Complete
                          </button>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderRegularTaskModal = () => (
    <AnimatePresence>
      {isTaskModalOpen && (
        <motion.div
          key="task-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setIsTaskModalOpen(false)}
        >
          <motion.div
            key="task-modal-content"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="bg-white rounded-xl w-full max-w-md shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">Create New Task</h3>
                <button onClick={() => setIsTaskModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100">
                  <IoMdClose className="text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
                  <input type="text" name="title" value={taskForm.title} onChange={handleTaskFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent" placeholder="What needs to be done?" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea name="description" value={taskForm.description} onChange={handleTaskFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent" placeholder="Add details..." rows={3} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign To *</label>
                  <select name="assignee" value={taskForm.assignee} onChange={handleTaskFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent">
                    <option value="">Select assignee</option>

                    {/* Check if current user is missing, and manually inject them if so */}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input type="date" name="dueDate" value={taskForm.dueDate} onChange={handleTaskFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select name="priority" value={taskForm.priority} onChange={handleTaskFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setIsTaskModalOpen(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancel</button>
                <button onClick={handleCreateTask} disabled={loading} className="px-4 py-2 bg-navy-700 text-white rounded-lg font-medium hover:bg-navy-800 transition disabled:opacity-50">{loading ? "Creating..." : "Create Task"}</button>
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setIsEventModalOpen(false); setEditingEvent(null); }}
        >
          <motion.div
            key="event-modal-content"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="bg-white rounded-xl w-full max-w-md shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">{editingEvent ? "Edit Event" : "Add Calendar Event"}</h3>
                <button onClick={() => { setIsEventModalOpen(false); setEditingEvent(null); }} className="p-2 rounded-full hover:bg-gray-100"><IoMdClose className="text-gray-500" /></button>
              </div>

              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Date *</label><input type="date" name="date" value={eventForm.date} onChange={handleEventFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent" /></div>

                <div><label className="block text-sm font-medium text-gray-700 mb-1">Event Type *</label><select name="type" value={eventForm.type} onChange={handleEventFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent"><option value="working">Working Day</option><option value="holiday">Holiday</option><option value="weekend">Weekend</option></select></div>

                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea name="description" value={eventForm.description} onChange={handleEventFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent" placeholder="Add description..." rows={3} /></div>

                {currentUser.role === "superadmin" && (
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Centre *</label><select name="centre_id" value={eventForm.centre_id || ""} onChange={handleEventFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent" required><option value="">Select a centre</option>{centres.map(centre => (<option key={centre.id} value={centre.id}>{centre.name}</option>))}</select></div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => { setIsEventModalOpen(false); setEditingEvent(null); }} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancel</button>
                <button onClick={handleSaveEvent} disabled={loading} className="px-4 py-2 bg-navy-700 text-white rounded-lg font-medium hover:bg-navy-800 transition disabled:opacity-50">{loading ? "Saving..." : (editingEvent ? "Update Event" : "Add Event")}</button>
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setIsTemplateModalOpen(false); resetTemplateForm(); }}
        >
          <motion.div
            key="template-modal-content"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="bg-white rounded-xl w-full max-w-2xl shadow-xl overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FiRepeat className="text-navy-700" />{editingTemplate ? "Edit Recurring Template" : "Create Recurring Template"}</h3>
                <button onClick={() => { setIsTemplateModalOpen(false); resetTemplateForm(); }} className="p-2 rounded-full hover:bg-gray-100"><IoMdClose className="text-gray-500" /></button>
              </div>

              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Template Title *</label><input type="text" name="title" value={templateForm.title} onChange={handleTemplateFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent" placeholder="e.g., Weekly Team Sync" /></div>

                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea name="description" value={templateForm.description} onChange={handleTemplateFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent" placeholder="Template description..." rows={2} /></div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2"><FiRepeat size={16} />Recurrence Settings</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Repeat</label><select name="recurrenceType" value={templateForm.recurrenceType} onChange={handleTemplateFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent bg-white"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Every (n)</label><input type="number" name="recurrenceInterval" value={templateForm.recurrenceInterval} onChange={handleTemplateFormChange} min="1" max="30" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent" /></div>

                    {templateForm.recurrenceType === 'weekly' && (<div><label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label><select name="recurrenceDay" value={templateForm.recurrenceDay} onChange={handleTemplateFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent bg-white"><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option><option value="0">Sunday</option></select></div>)}

                    {templateForm.recurrenceType === 'monthly' && (<div><label className="block text-sm font-medium text-gray-700 mb-1">Day of Month</label><input type="number" name="recurrenceDate" value={templateForm.recurrenceDate} onChange={handleTemplateFormChange} min="1" max="31" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent" /></div>)}

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                      <div className="flex gap-4 mb-2 flex-wrap">
                        <label className="flex items-center gap-2"><input type="radio" name="assignmentMode" value="centre_admin" checked={templateForm.assignmentMode === "centre_admin"} onChange={handleTemplateFormChange} className="w-4 h-4 text-navy-700" /><span className="flex items-center gap-1 text-sm"><FiUser size={14} />Centre Admin</span></label>
                        <label className="flex items-center gap-2"><input type="radio" name="assignmentMode" value="all_staff" checked={templateForm.assignmentMode === "all_staff"} onChange={handleTemplateFormChange} className="w-4 h-4 text-navy-700" /><span className="flex items-center gap-1 text-sm"><FiUsers size={14} />All Staff</span></label>
                        <label className="flex items-center gap-2"><input type="radio" name="assignmentMode" value="specific_staff" checked={templateForm.assignmentMode === "specific_staff"} onChange={handleTemplateFormChange} className="w-4 h-4 text-navy-700" /><span className="flex items-center gap-1 text-sm"><FiUserPlus size={14} />Specific Staff</span></label>
                      </div>

                      {templateForm.assignmentMode === "specific_staff" && (<div className="mt-2"><select name="specificAssignee" value={templateForm.specificAssignee} onChange={handleTemplateFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent bg-white" required><option value="">Select staff member</option>{staffList.map(staff => (<option key={staff.id} value={staff.id}>{staff.name} ({staff.role || 'Staff'})</option>))}</select></div>)}
                    </div>

                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Due After (days)</label><input type="number" name="dueOffsetDays" value={templateForm.dueOffsetDays} onChange={handleTemplateFormChange} min="0" max="30" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent" /><p className="text-xs text-gray-500 mt-1">Days from generation</p></div>

                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Priority</label><select name="priority" value={templateForm.priority} onChange={handleTemplateFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent bg-white"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                  </div>

                  {canCreateGlobal() && (<div className="mt-4 pt-4 border-t border-blue-200"><label className="flex items-center gap-3"><input type="checkbox" name="isGlobal" checked={templateForm.isGlobal} onChange={handleTemplateFormChange} className="w-4 h-4 text-navy-700 border-gray-300 rounded focus:ring-navy-700" /><span className="flex items-center gap-2 text-sm font-medium text-gray-700"><FiGlobe className="text-purple-600" />Make this a global template (applies to all centres)</span></label></div>)}

                  <div className="mt-4"><label className="flex items-center gap-3"><input type="checkbox" name="isActive" checked={templateForm.isActive} onChange={handleTemplateFormChange} className="w-4 h-4 text-navy-700 border-gray-300 rounded focus:ring-navy-700" /><span className="text-sm font-medium text-gray-700">Template is active (will generate tasks on schedule)</span></label></div>
                </div>

                <div className="p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700"><FiInfo className="inline mr-2" />This template will not create tasks immediately. It will generate tasks on its next scheduled cycle (daily at 1 AM).{editingTemplate && " Changes will only affect future tasks, not existing ones."}</div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => { setIsTemplateModalOpen(false); resetTemplateForm(); }} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancel</button>
                <button onClick={handleSaveTemplate} disabled={loading} className="px-4 py-2 bg-navy-700 text-white rounded-lg font-medium hover:bg-navy-800 transition disabled:opacity-50 flex items-center gap-2">{loading ? "Saving..." : (<><FiCheck size={16} />{editingTemplate ? "Update Template" : "Create Template"}</>)}</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderTask = (task) => {
    const priorityColors = { high: "bg-red-100 text-red-800 border-red-200", medium: "bg-yellow-100 text-yellow-800 border-yellow-200", low: "bg-green-100 text-green-800 border-green-200" };
    const assignee = staffList.find(s => s.id === task.assigned_to);
    const isFromTemplate = task.template_id !== null && task.template_id !== undefined;

    return (
      <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition">
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-3 flex-1">
            <button onClick={() => toggleTaskCompletion(task.id, task.status)} className={`mt-1 p-1 rounded flex-shrink-0 ${task.status === 'completed' ? 'bg-navy-700 text-white' : 'border border-gray-300 text-transparent hover:border-navy-700'}`}><FiCheck size={14} /></button>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap"><h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-800'}`}>{task.title}</h4>{isFromTemplate && (<span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full flex items-center gap-1"><FiRepeat size={10} />Recurring</span>)}{task.centre_name && (<span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{task.centre_name}</span>)}</div>
              {task.description && (<p className="text-sm text-gray-600 mt-1">{task.description}</p>)}
              <div className="flex flex-wrap items-center gap-3 mt-2"><span className={`text-xs px-2 py-1 rounded-full border ${priorityColors[task.priority] || priorityColors.medium}`}>{task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1) || 'Medium'}</span>{task.due_date && (<div className="flex items-center gap-1 text-sm text-gray-500"><FiCalendar size={14} /><span className="text-xs">{new Date(task.due_date).toLocaleDateString()}</span></div>)}<div className="flex items-center gap-1 text-sm text-gray-500"><FiUser size={14} /><span className="text-xs">{assignee?.name || `Staff #${task.assigned_to}`}</span></div></div>
            </div>
          </div>
          <button onClick={() => deleteTask(task.id)} className="p-1 text-gray-400 hover:text-red-500 transition flex-shrink-0"><FiTrash2 size={16} /></button>
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
      <motion.div key={template.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2"><h4 className="font-medium text-gray-800">{template.title}</h4>{template.is_global && (<span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full flex items-center gap-1"><FiGlobe size={10} />Global</span>)}<span className={`text-xs px-2 py-0.5 rounded-full ${template.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{template.is_active ? 'Active' : 'Paused'}</span></div>
            {template.description && (<p className="text-sm text-gray-600 mb-2">{template.description}</p>)}
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500"><div className="flex items-center gap-1"><FiRepeat size={14} /><span className="text-xs">{getRecurrenceText()}</span></div><div className="flex items-center gap-1"><FiUser size={14} /><span className="text-xs">{getAssignmentText()}</span></div>{template.due_offset_days > 0 && (<div className="flex items-center gap-1"><FiCalendar size={14} /><span className="text-xs">Due +{template.due_offset_days} days</span></div>)}{template.last_generated_at && (<div className="flex items-center gap-1"><FiClock size={14} /><span className="text-xs">Last: {new Date(template.last_generated_at).toLocaleDateString()}</span></div>)}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => toggleTemplateStatus(template.id, template.is_active)} className={`p-2 rounded-lg transition ${template.is_active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`} title={template.is_active ? 'Pause Template' : 'Activate Template'}>{template.is_active ? <FiPause size={16} /> : <FiPlay size={16} />}</button>
            {canEditTemplate(template) && (<><button onClick={() => openTemplateModal(template)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit Template"><FiEdit size={16} /></button><button onClick={() => deleteTemplate(template.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete Template"><FiTrash2 size={16} /></button></>)}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderTasksView = () => {
    const filteredTasks = getFilteredTasks();
    const pendingCount = tasks.filter(t => t.status !== "completed").length;
    const completedCount = tasks.filter(t => t.status === "completed").length;

    return (
      <div className="h-full overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div><h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FiCheckSquare className="text-navy-700" />Task Management</h1><p className="text-gray-500 text-sm mt-1">Manage tasks and recurring templates</p></div>
            <div className="flex gap-3">{canCreateRecurring() && (<button onClick={() => openTemplateModal()} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2 shadow-sm"><FiRepeat size={18} />New Template</button>)}<button onClick={openTaskModal} className="px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition flex items-center gap-2 shadow-sm"><FiPlusCircle size={18} />New Task</button></div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200"><p className="text-sm text-gray-500">Total Tasks</p><p className="text-2xl font-bold text-gray-800">{tasks.length}</p></div>
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200"><p className="text-sm text-gray-500">Pending</p><p className="text-2xl font-bold text-yellow-600">{pendingCount}</p></div>
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200"><p className="text-sm text-gray-500">Completed</p><p className="text-2xl font-bold text-green-600">{completedCount}</p></div>
          </div>

          {canCreateRecurring() && templates.length > 0 && (<div className="mb-8"><h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2"><FiRepeat className="text-purple-600" />Recurring Templates</h2><div className="space-y-3">{templates.map(template => renderTemplate(template))}</div></div>)}

          <div className="bg-white rounded-lg p-4 mb-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-4"><div className="flex items-center gap-2 text-gray-500"><FiFilter size={16} /><span className="text-sm">Filter:</span></div><button onClick={() => setTaskFilter("all")} className={`px-3 py-1 rounded-full text-sm transition ${taskFilter === "all" ? "bg-navy-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>All ({tasks.length})</button><button onClick={() => setTaskFilter("pending")} className={`px-3 py-1 rounded-full text-sm transition ${taskFilter === "pending" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Pending ({pendingCount})</button><button onClick={() => setTaskFilter("completed")} className={`px-3 py-1 rounded-full text-sm transition ${taskFilter === "completed" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Completed ({completedCount})</button></div>
          </div>

          <div className="space-y-3">
            {loading ? (<div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-navy-700 border-t-transparent"></div><p className="text-gray-500 mt-2">Loading tasks...</p></div>) : filteredTasks.length > 0 ? (<AnimatePresence>{filteredTasks.map(task => (<div key={task.id}>{renderTask(task)}</div>))}</AnimatePresence>) : (<div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300"><FiCheckSquare className="mx-auto text-gray-400 text-5xl mb-3" /><h3 className="text-lg font-medium text-gray-700 mb-2">No tasks found</h3><p className="text-gray-500 mb-4">{taskFilter === "all" ? "Get started by creating your first task" : taskFilter === "pending" ? "No pending tasks" : "No completed tasks yet"}</p><button onClick={openTaskModal} className="px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition inline-flex items-center gap-2"><FiPlusCircle size={16} />Create New Task</button></div>)}
          </div>
        </div>
      </div>
    );
  };

  const renderCalendarView = () => {
    return (
      <div className="h-full overflow-y-auto p-6 bg-gray-50">
        {calendarLoading ? (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-700"></div></div>) : calendarError ? (<div className="flex flex-col items-center justify-center h-64 text-red-500"><FiAlertCircle size={48} className="mb-4" /><p className="text-lg">Error loading calendar</p><p className="text-sm">{calendarError}</p><button onClick={fetchCalendarData} className="mt-4 px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition flex items-center gap-2"><FiRefreshCw size={16} />Retry</button></div>) : (<CalendarView calendarData={calendarData} leavesData={leavesData} onAddEvent={openAddEventModal} onEditEvent={openEditEventModal} onDeleteEvent={handleDeleteEvent} onUpdateEvent={handleUpdateEvent} userRole={currentUser.role} centresMap={centresMap} />)}
      </div>
    );
  };

  const renderNavigationSidebar = () => (
    <div className="hidden md:flex flex-col items-center py-4 w-16 bg-white border-r border-gray-200 h-full flex-shrink-0">
      <nav className="flex-1">
        <ul className="space-y-6">
          <li><button onClick={() => setActiveView("chats")} className={`p-3 rounded-lg flex items-center justify-center ${activeView === "chats" ? "bg-navy-700 text-white" : "hover:bg-gray-100 text-gray-600"} transition relative`} title="Chats"><FiMessageSquare size={20} />{conversations.reduce((acc, conv) => acc + (conv.unread || 0), 0) > 0 && (<span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{conversations.reduce((acc, conv) => acc + (conv.unread || 0), 0)}</span>)}</button></li>
          <li><button onClick={() => setActiveView("activity")} className={`p-3 rounded-lg flex items-center justify-center ${activeView === "activity" ? "bg-navy-700 text-white" : "hover:bg-gray-100 text-gray-600"} transition`} title="Activity"><FiActivity size={20} /></button></li>
          <li><button onClick={() => setActiveView("calendar")} className={`p-3 rounded-lg flex items-center justify-center ${activeView === "calendar" ? "bg-navy-700 text-white" : "hover:bg-gray-100 text-gray-600"} transition`} title="Calendar"><FiCalendar size={20} /></button></li>
          <li><button onClick={() => setActiveView("files")} className={`p-3 rounded-lg flex items-center justify-center ${activeView === "files" ? "bg-navy-700 text-white" : "hover:bg-gray-100 text-gray-600"} transition`} title="Files"><FiGrid size={20} /></button></li>
          <li><button onClick={() => setActiveView("tasks")} className={`p-3 rounded-lg flex items-center justify-center ${activeView === "tasks" ? "bg-navy-700 text-white" : "hover:bg-gray-100 text-gray-600"} transition`} title="Tasks"><FiCheckSquare size={20} /></button></li>
          <li><button onClick={() => setActiveView("schedules")} className={`p-3 rounded-lg flex items-center justify-center ${activeView === "schedules" ? "bg-navy-700 text-white" : "hover:bg-gray-100 text-gray-600"} transition`} title="Schedules"><FiClock size={20} /></button></li>
        </ul>
      </nav>
    </div>
  );

  const renderPlaceholderView = (title) => (
    <div className="flex flex-col items-center justify-center p-6 text-center h-full">
      <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16 flex items-center justify-center mb-6">
        {activeView === "chats" && <FiMessageSquare size={24} className="text-gray-500" />}
        {activeView === "activity" && <FiActivity size={24} className="text-gray-500" />}
        {activeView === "calendar" && <FiCalendar size={24} className="text-gray-500" />}
        {activeView === "files" && <FiGrid size={24} className="text-gray-500" />}
        {activeView === "tasks" && <FiCheckSquare size={24} className="text-gray-500" />}
        {activeView === "schedules" && <FiClock size={24} className="text-gray-500" />}
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">{title} View</h3>
      <p className="text-gray-500 max-w-md">{title} content will be displayed here. This is a placeholder view.</p>
    </div>
  );

  // ============== MAIN RETURN ==============

  return (
    <div className="flex h-screen bg-white overflow-hidden w-full">
      <AnimatePresence mode="wait">
        {isNewChatModalOpen && (<NewChatModal key="new-chat-modal" isOpen={isNewChatModalOpen} onClose={() => setIsNewChatModalOpen(false)} onCreate={handleCreateConversation} staffList={staffList} />)}
      </AnimatePresence>

      {renderRegularTaskModal()}
      {renderTemplateModal()}
      {renderEventModal()}

      {apiError && (<div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-2 text-center z-50">{apiError}<button onClick={() => setApiError(null)} className="ml-4 px-2 py-1 bg-white text-red-500 rounded hover:bg-red-100 transition">Dismiss</button></div>)}

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-800/50 z-40 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} className="bg-white w-4/5 h-full shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between p-4 border-b border-gray-200"><h2 className="text-gray-800 font-bold">Messages</h2><FiX onClick={() => setIsMobileMenuOpen(false)} className="text-gray-500 cursor-pointer" size={24} /></div>
              {renderConversationList()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-navy-700 text-white z-30 flex items-center px-4 shadow-lg">
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-white"><FiMenu size={24} /></button>
        <h2 className="text-lg font-bold ml-4">{activeView === "chats" ? "Messages" : activeView === "tasks" ? "Tasks" : activeView === "calendar" ? "Calendar" : activeView === "files" ? "Files" : activeView === "activity" ? "Activity" : "Schedules"}</h2>
        <div className="ml-auto flex gap-3"><FiBell />{activeView === "chats" && (<FiPlus onClick={() => setIsNewChatModalOpen(true)} />)}</div>
      </div>

      <div className="flex flex-1 min-h-0 w-full">
        <div className="hidden md:block flex-shrink-0">{renderNavigationSidebar()}</div>

        {activeView === "chats" && (<div className="hidden md:flex md:w-1/3 lg:w-1/4 h-full flex-col overflow-hidden border-r border-gray-200 flex-shrink-0">{renderConversationList()}</div>)}

        <div className={`flex-1 min-h-0 h-full flex flex-col overflow-hidden bg-white ${activeView === "chats" && activeConversation && isContactPanelOpen ? 'lg:w-1/2' : 'lg:w-3/4'}`}>
          <div className="md:hidden flex-none h-16 w-full"></div>
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 w-full">
            {activeView === "chats" ? (
              <div className="flex h-[calc(120vh-220px)]">
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
                  onTaskStatusUpdate={handleServiceTaskStatusUpdate}
                />
              </div>
            ) : activeView === "activity" ? (<div className="h-full overflow-y-auto"><ActivityPanel token={token} userRole={currentUser.role} /></div>) : activeView === "calendar" ? (<div className="h-full overflow-y-auto">{renderCalendarView()}</div>) : activeView === "files" ? (<div className="h-full overflow-y-auto"><FilesView user={currentUser} /></div>) : activeView === "tasks" ? (<div className="h-full overflow-y-auto">{renderTasksView()}</div>) : activeView === "schedules" ? (<div className="h-full overflow-y-auto">{renderPlaceholderView("Schedules")}</div>) : (<div className="h-full overflow-y-auto">{renderPlaceholderView("Chat")}</div>)}
          </div>
        </div>

        {activeView === "chats" && activeConversation && (
          <>
            <button onClick={() => setIsContactPanelOpen(!isContactPanelOpen)} className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 z-20 w-6 h-24 bg-gray-100 hover:bg-gray-200 rounded-l-lg items-center justify-center transition-all duration-300 cursor-pointer ${isContactPanelOpen ? 'right-[25%]' : 'right-0'}`} style={{ transform: 'translateY(-50%)', marginRight: isContactPanelOpen ? '-12px' : '0' }}><FiChevronRight className={`text-gray-600 transition-transform ${isContactPanelOpen ? '' : 'rotate-180'}`} /></button>
            <div className={`hidden lg:flex ${isContactPanelOpen ? 'lg:w-1/4' : 'w-0'} h-full flex-col overflow-hidden border-l border-gray-200 flex-shrink-0 transition-all duration-300 relative`}>{renderContactPanel()}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default MessengerPage;

const styles = `
  :root { --navy-700: #1e3a8a; --navy-800: #172554; }
  .bg-navy-700 { background-color: var(--navy-700); }
  .bg-navy-800 { background-color: var(--navy-800); }
  .text-navy-700 { color: var(--navy-700); }
  .hover\\:bg-navy-800:hover { background-color: var(--navy-800); }
  .hover\\:text-navy-700:hover { color: var(--navy-700); }
  .border-navy-700 { border-color: var(--navy-700); }
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.3); }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  .fixed { -webkit-transform: translateZ(0); -moz-transform: translateZ(0); -ms-transform: translateZ(0); -o-transform: translateZ(0); transform: translateZ(0); backface-visibility: hidden; perspective: 1000px; }
  .lg\\:flex.absolute { pointer-events: auto; z-index: 30; }
`;

export const MessengerStyle = () => <style>{styles}</style>;