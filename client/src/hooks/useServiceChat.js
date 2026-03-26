import { useState, useEffect, useRef, useCallback } from 'react';
import { socket } from '../services/socket';
import { toast } from 'react-toastify';

// Helper to deduplicate messages by ID (keeps the last occurrence)
const deduplicateMessages = (messages) => {
  const map = new Map();
  messages.forEach(msg => {
    // Use a unique key: for optimistic messages, use tempId; for real messages, use id
    const key = msg.isOptimistic ? msg.tempId : msg.id;
    if (key) map.set(key, msg);
  });
  return Array.from(map.values());
};

export const useServiceChat = (conversationId, currentUser, token, apiBaseUrl) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const processedMessageIds = useRef(new Set());

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/chat/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      
      const formatted = data.map(msg => ({
        ...msg,
        text: msg.text,
        sender: msg.sender_name || (msg.sender_type === 'system' ? 'System' : 'Unknown User'),
        senderId: msg.sender_id,
        isFile: msg.type === 'file' || msg.type === 'image', 
        fileName: msg.file_name, 
        fileUrl: msg.file_url,
        fileSize: msg.file_size,
        messageType: msg.type,
        isCurrentUser: String(msg.sender_id) === String(currentUser.id),
        time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isOptimistic: false,
        isSystem: msg.sender_type === 'system',
      }));
      
      setMessages(deduplicateMessages(formatted));
      
      // Mark messages as read
      const unreadIds = formatted.filter(m => !m.isCurrentUser && !m.is_read_by_me).map(m => m.id);
      if (unreadIds.length && socket.connected) {
        socket.emit('mark_read', { messageIds: unreadIds, conversationId });
      }
    } catch (err) {
      console.error('Error fetching service chat messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, token, apiBaseUrl, currentUser.id]);

  // Join conversation room
  useEffect(() => {
    if (!conversationId) return;
    if (socket.connected) {
      socket.emit('join_conversation', conversationId);
    }
    return () => {
      if (socket.connected) {
        socket.emit('leave_conversation', conversationId);
      }
    };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    fetchMessages();

    const handleNewMessage = (msg) => {
      if (String(msg.conversation_id) !== String(conversationId)) return;

      // Skip if we've already processed this ID via API (prevent double add)
      if (processedMessageIds.current.has(msg.id)) return;

      const formatted = {
        id: msg.id,
        sender: msg.sender_name || (msg.sender_type === 'system' ? 'System' : 'Unknown'),
        senderId: msg.sender_id,
        text: msg.message,
        time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isFile: msg.message_type === 'file' || msg.message_type === 'image',
        fileName: msg.file_name, 
        fileUrl: msg.file_url,
        fileSize: msg.file_size,
        messageType: msg.message_type,
        isCurrentUser: String(msg.sender_id) === String(currentUser.id),
        is_read_by_me: String(msg.sender_id) === String(currentUser.id),
        isOptimistic: false,
        isSystem: msg.sender_type === 'system',
      };

      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        
        // FIX 1: Failsafe text-matching (Same logic MessengerPage uses)
        const filtered = prev.filter(m => {
          if (!m.isOptimistic) return true;
          const sameSender = String(msg.sender_id) === String(currentUser.id);
          const sameText = m.text === msg.message;
          if (sameSender && sameText) return false; 
          return true;
        });

        return deduplicateMessages([...filtered, formatted]);
      });

      processedMessageIds.current.add(msg.id);
      setTimeout(() => processedMessageIds.current.delete(msg.id), 60000);
    };

    const handleTyping = (data) => {
      if (data.conversationId !== conversationId || data.userId === currentUser.id) return;
      setTypingUsers(prev => {
        const exists = prev.some(u => u.userId === data.userId);
        if (data.isTyping && !exists) {
          return [...prev, { userId: data.userId, name: data.userName }];
        } else if (!data.isTyping && exists) {
          return prev.filter(u => u.userId !== data.userId);
        }
        return prev;
      });
    };

    socket.on('new_message', handleNewMessage);
    socket.on('typing', handleTyping);
    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('typing', handleTyping);
    };
  }, [conversationId, currentUser.id, fetchMessages]);

  const sendMessage = async (text, file, optimisticMessage) => {
    if (!conversationId) return;
    
    // FIX 2: Grab the exact tempId passed by Chat.jsx instead of creating a new one
    const tempId = optimisticMessage?.tempId || optimisticMessage?.id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const optimisticMsg = optimisticMessage || {
      id: tempId,
      tempId,
      sender: 'You',
      senderId: currentUser.id,
      text: text || (file ? (file.type?.startsWith('image/') ? '📷 Image' : '📎 File') : ''),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isFile: !!file,
      fileName: file?.name,
      fileUrl: null,
      fileSize: file?.size,
      messageType: file ? (file.type?.startsWith('image/') ? 'image' : 'file') : 'text',
      isCurrentUser: true,
      is_read_by_me: true,
      isOptimistic: true,
      isSystem: false,
    };
    
    setMessages(prev => deduplicateMessages([...prev, optimisticMsg]));

    const formData = new FormData();
    formData.append('conversation_id', conversationId);
    formData.append('message', text || '');
    formData.append('message_type', file ? (file.type?.startsWith('image/') ? 'image' : 'file') : 'text');
    if (file) formData.append('file', file);

    try {
      const res = await fetch(`${apiBaseUrl}/chat/message`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to send message');
      const newMsg = await res.json();

      processedMessageIds.current.add(newMsg.id);

      setMessages(prev => {
        // Now tempId perfectly matches the optimistic message in the state!
        const filtered = prev.filter(m => !(m.isOptimistic && (m.tempId === tempId || m.id === tempId)));
        
        if (filtered.some(m => m.id === newMsg.id)) {
          return deduplicateMessages(filtered);
        }
        const realMsg = {
          id: newMsg.id,
          sender: 'You',
          senderId: currentUser.id,
          text: text || (file ? (file.type?.startsWith('image/') ? '📷 Image' : '📎 File') : ''),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isFile: !!file,
          fileName: file?.name,
          fileUrl: newMsg.file_url,
          fileSize: file?.size,
          messageType: file ? (file.type?.startsWith('image/') ? 'image' : 'file') : 'text',
          isCurrentUser: true,
          is_read_by_me: true,
          isOptimistic: false,
          isSystem: false,
        };
        const newMessages = [...filtered, realMsg];
        return deduplicateMessages(newMessages);
      });
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
      setMessages(prev => prev.filter(m => !(m.isOptimistic && (m.tempId === tempId || m.id === tempId))));
    }
  };

  const sendTyping = (isTyping) => {
    if (!conversationId) return;
    if (socket.connected) {
      socket.emit('typing', {
        conversationId,
        userId: currentUser.id,
        userName: currentUser.name,
        isTyping,
      });
    }
    fetch(`${apiBaseUrl}/chat/typing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ conversation_id: conversationId, isTyping }),
    }).catch(console.error);
  };

  return {
    messages,
    loading,
    typingUsers,
    sendMessage,
    sendTyping,
  };
};