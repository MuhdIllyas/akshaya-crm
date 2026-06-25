import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft,
  FiGrid,
  FiMessageSquare,
  FiCheckSquare,
  FiUsers,
  FiFileText,
  FiPlus,
  FiTrash2,
  FiDownload,
  FiUpload,
  FiX,
  FiFlag,
  FiUser,
  FiFile,
  FiClock,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Chat from '@/components/Chat';
import { useServiceChat } from '/src/hooks/useServiceChat';
import { socket } from '@/services/socket';

const API_BASE_URL = import.meta.env.VITE_API_URL;

// Helper to get current user from token
const getCurrentUser = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    return {
      id: payload.id || payload.staff_id,
      name: payload.name || 'Staff',
      role: payload.role || 'staff',
    };
  } catch (e) {
    console.error('Failed to decode token', e);
    return null;
  }
};

// Helper to format date consistently
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
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

const ServiceWorkspace = () => {
  const { selectedServiceId } = useParams(); // This is the tracking ID
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('board');

  // Data states
  const [service, setService] = useState(null);
  const [serviceEntryId, setServiceEntryId] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI states
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ staffId: '', role: 'collaborator' });
  const [newTask, setNewTask] = useState({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium' });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const token = localStorage.getItem('token');

  // Fetch workspace data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Get the tracking entry to obtain the actual service_entry_id
        const serviceRes = await fetch(`${API_BASE_URL}/api/servicetracking/${selectedServiceId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!serviceRes.ok) throw new Error('Failed to fetch service');
        const serviceData = await serviceRes.json();
        setService(serviceData);
        const actualServiceEntryId = serviceData.service_entry_id;
        setServiceEntryId(actualServiceEntryId);

        // 2. Now fetch all collaboration data using the actual service_entry_id
        const [convRes, partsRes, tasksRes, docsRes, staffRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/servicecollaboration/${actualServiceEntryId}/conversation`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/servicecollaboration/${actualServiceEntryId}/participants`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/servicecollaboration/${actualServiceEntryId}/tasks`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/servicecollaboration/${actualServiceEntryId}/documents`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/chat/staff`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (convRes.ok) setConversation(await convRes.json());
        if (partsRes.ok) setParticipants(await partsRes.json());
        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (docsRes.ok) setDocuments(await docsRes.json());
        if (staffRes.ok) setStaffList(await staffRes.json());
      } catch (err) {
        console.error('Error fetching workspace data:', err);
        toast.error('Failed to load workspace');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedServiceId, token]);

  // Real-time Socket Listeners for Tasks
  useEffect(() => {
    if (!socket?.connected || !serviceEntryId) return;

    const handleTaskUpdated = (data) => {
      setTasks((prev) => prev.map((t) => (String(t.id) === String(data.id) ? { ...t, status: data.status } : t)));
    };

    const handleTaskAssigned = (newTask) => {
      if (String(newTask.related_service_entry_id) === String(serviceEntryId)) {
        setTasks((prev) => {
          if (prev.some(t => String(t.id) === String(newTask.id))) return prev;
          return [newTask, ...prev];
        });
      }
    };

    socket.on("taskUpdated", handleTaskUpdated);
    socket.on("taskAssigned", handleTaskAssigned);

    return () => {
      socket.off("taskUpdated", handleTaskUpdated);
      socket.off("taskAssigned", handleTaskAssigned);
    };
  }, [serviceEntryId]);

  // --- Participants handlers ---
  const handleAddParticipant = async () => {
    if (!serviceEntryId) return;
    if (!newParticipant.staffId) {
      toast.error('Please select a staff member');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          staffId: parseInt(newParticipant.staffId),
          role: newParticipant.role,
        }),
      });
      if (!res.ok) throw new Error('Failed to add participant');
      toast.success('Participant added');
      const partsRes = await fetch(`${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/participants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setParticipants(await partsRes.json());
      setShowParticipantModal(false);
      setNewParticipant({ staffId: '', role: 'collaborator' });
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  };

  const handleRemoveParticipant = async (staffId) => {
    if (!serviceEntryId) return;
    if (!window.confirm('Remove this participant from the service?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/participants/${staffId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to remove participant');
      toast.success('Participant removed');
      setParticipants((prev) => prev.filter((p) => p.staff_id !== staffId));
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  };

  // --- Tasks handlers ---
  const handleCreateTask = async () => {
    if (!serviceEntryId) return;
    if (!newTask.title.trim()) {
      toast.error('Task title is required');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description,
          assigned_to: newTask.assignedTo ? parseInt(newTask.assignedTo) : null,
          due_date: newTask.dueDate || null,
          priority: newTask.priority,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      const createdTask = await res.json();
      setTasks((prev) => [createdTask, ...prev]);
      setShowTaskModal(false);
      setNewTask({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium' });
      toast.success('Task created');
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  };

  const handleTaskStatusUpdate = async (taskId, newStatus) => {
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
      
      setTasks((prev) => prev.map((t) => (String(t.id) === String(taskId) ? { ...t, status: newStatus } : t)));
      toast.success(`Task marked as ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error(err.message);
      throw err; // Crucial for Chat.jsx to know it failed and stop the spinner
    }
  };

  // --- Documents handlers ---
  const handleDocumentUpload = async (e) => {
    if (!serviceEntryId) return;
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', 'other');
    formData.append('document_name', file.name);
    try {
      const res = await fetch(`${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const newDoc = await res.json();
      setDocuments((prev) => [newDoc, ...prev]);
      toast.success('Document uploaded');
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!serviceEntryId) return;
    if (!window.confirm('Delete this document?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success('Document deleted');
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  };

  // --- Chat integration (via hook) ---
  const { messages, loading: chatLoading, typingUsers, sendMessage, sendTyping } = useServiceChat(
    conversation?.id,
    currentUser,
    token,
    API_BASE_URL
  );

  const handleSendMessage = (text, file, optimisticMessage) => {
    sendMessage(text, file, optimisticMessage);
  };

  const handleDeleteMessage = async (messageId, conversationId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/message/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Message deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete message');
    }
  };

  // Build serviceInfo for the Chat component
  const serviceInfo = useMemo(() => {
    if (!service) return null;
    return {
      name: service.service_name,
      applicationNumber: service.application_number,
      phone: service.phone,
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        assigned_to_name: task.assigned_to_name,
        due_date: task.due_date,
        priority: task.priority,
        status: task.status,
      })),
    };
  }, [service, tasks]);

  // Group tasks by status for Kanban
  const tasksByStatus = {
    pending: tasks.filter((t) => t.status === 'pending'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    completed: tasks.filter((t) => t.status === 'completed'),
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard/staff/track_service')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
          >
            <FiArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              {service?.service_name || 'Service'} Workspace
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <FiUser size={14} /> {service?.customer_name}
              </span>
              <span className="flex items-center gap-1">
                <FiFile size={14} /> App #{service?.application_number}
              </span>
              <span className="flex items-center gap-1">
                <FiClock size={14} /> Created {formatDate(service?.created_at || service?.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white/50 backdrop-blur-sm px-6 sticky top-[73px] z-10">
        {[
          { id: 'board', label: 'Board', icon: FiGrid },
          { id: 'chat', label: 'Chat', icon: FiMessageSquare },
          { id: 'tasks', label: 'Tasks', icon: FiCheckSquare },
          { id: 'participants', label: 'Participants', icon: FiUsers },
          { id: 'documents', label: 'Documents', icon: FiFileText },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 transition-all duration-200 ${
              activeTab === tab.id
                ? 'border-purple-600 text-purple-700 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon size={18} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          {/* Board Tab */}
          {activeTab === 'board' && (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                <BoardColumn
                  title="To Do"
                  tasks={tasksByStatus.pending}
                  status="pending"
                  onTaskMove={handleTaskStatusUpdate}
                />
                <BoardColumn
                  title="In Progress"
                  tasks={tasksByStatus.in_progress}
                  status="in_progress"
                  onTaskMove={handleTaskStatusUpdate}
                />
                <BoardColumn
                  title="Done"
                  tasks={tasksByStatus.completed}
                  status="completed"
                  onTaskMove={handleTaskStatusUpdate}
                />
              </div>
            </motion.div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full flex flex-col">
                <div className="flex-1 min-h-0">
                  <Chat
                    activeConversation={conversation}
                    messages={{ [conversation?.id]: messages }}
                    currentUser={currentUser}
                    loadingChat={chatLoading}
                    typingUsers={{ [conversation?.id]: typingUsers }}
                    onSendMessage={handleSendMessage}
                    onDeleteMessage={handleDeleteMessage}
                    onOpenTaskModal={() => setShowTaskModal(true)}
                    onOpenNewChatModal={() => {}}
                    onBack={() => {}}
                    onlineUsers={new Set()}
                    serviceInfo={serviceInfo}
                    serviceEntryId={serviceEntryId}
                    onTaskStatusUpdate={handleTaskStatusUpdate}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Tasks Tab (List View) */}
          {activeTab === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">All Tasks</h2>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition shadow-sm"
                >
                  <FiPlus size={18} /> New Task
                </button>
              </div>
              <div className="space-y-3">
                {tasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border border-gray-200">
                    No tasks yet. Create one!
                  </div>
                ) : (
                  tasks.map((task) => (
                    <TaskCard key={task.id} task={task} onStatusUpdate={handleTaskStatusUpdate} />
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* Participants Tab */}
          {activeTab === 'participants' && (
            <motion.div
              key="participants"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">Collaborators</h2>
                <button
                  onClick={() => setShowParticipantModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition shadow-sm"
                >
                  <FiPlus size={18} /> Add Participant
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {participants.map((p) => (
                  <div
                    key={p.staff_id}
                    className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-semibold">
                        {p.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">
                          {p.role} • {p.staff_role}
                        </p>
                      </div>
                    </div>
                    {p.staff_id !== service?.assignedToId && (
                      <button
                        onClick={() => handleRemoveParticipant(p.staff_id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <motion.div
              key="documents"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">Shared Documents</h2>
                <div className="relative">
                  <input
                    type="file"
                    id="doc-upload"
                    className="hidden"
                    onChange={handleDocumentUpload}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                  <button
                    onClick={() => document.getElementById('doc-upload').click()}
                    disabled={uploadingDoc}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition shadow-sm disabled:opacity-50"
                  >
                    {uploadingDoc ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <FiUpload size={18} /> Upload Document
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {documents.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border border-gray-200">
                    No documents yet.
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <FiFileText className="text-gray-600" size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{doc.document_name}</p>
                          <p className="text-xs text-gray-500">
                            Uploaded by {doc.uploaded_by_name || 'Staff'} on{' '}
                            {new Date(doc.created_at).toLocaleDateString()}
                            {doc.file_size && ` • ${(doc.file_size / 1024).toFixed(1)} KB`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`${API_BASE_URL}/api/files/version/${doc.id}/download?token=${token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-500 hover:text-purple-600 transition"
                          title="Download"
                        >
                          <FiDownload size={18} />
                        </a>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-2 text-gray-500 hover:text-red-500 transition"
                          title="Delete"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showParticipantModal && (
          <Modal title="Add Participant" onClose={() => setShowParticipantModal(false)}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
                <select
                  value={newParticipant.staffId}
                  onChange={(e) => setNewParticipant({ ...newParticipant, staffId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Select staff</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newParticipant.role}
                  onChange={(e) => setNewParticipant({ ...newParticipant, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="collaborator">Collaborator</option>
                  <option value="reviewer">Reviewer</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowParticipantModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddParticipant}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition"
                >
                  Add
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showTaskModal && (
          <Modal title="Create New Task" onClose={() => setShowTaskModal(false)}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Task title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Task description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                <select
                  value={newTask.assignedTo}
                  onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">Select staff</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTask}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition"
                >
                  Create
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

// BoardColumn component (Kanban column)
const BoardColumn = ({ title, tasks, status, onTaskMove }) => {
  const getNextStatus = (currentStatus) => {
    if (currentStatus === 'pending') return 'in_progress';
    if (currentStatus === 'in_progress') return 'completed';
    return null;
  };

  const getButtonText = (currentStatus) => {
    if (currentStatus === 'pending') return '→ In Progress';
    if (currentStatus === 'in_progress') return '→ Done';
    return null;
  };

  return (
    <div className="bg-gray-100/80 rounded-2xl p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-700">{title}</h3>
        <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded-full">{tasks.length}</span>
      </div>
      <div className="space-y-3 flex-1 overflow-y-auto">
        {tasks.map((task) => (
          <div key={task.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
            <p className="font-medium text-gray-800">{task.title}</p>
            {task.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs">
              {task.assigned_to_name && <span>👤 {task.assigned_to_name}</span>}
              {task.due_date && <span>📅 {new Date(task.due_date).toLocaleDateString()}</span>}
              <span
                className={`px-2 py-0.5 rounded-full ${
                  task.priority === 'high'
                    ? 'bg-red-100 text-red-800'
                    : task.priority === 'medium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {task.priority}
              </span>
            </div>
            {status !== 'completed' && (
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => onTaskMove(task.id, getNextStatus(status))}
                  className="text-xs text-purple-600 hover:text-purple-800"
                >
                  {getButtonText(status)}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// TaskCard component (for list view)
const TaskCard = ({ task, onStatusUpdate }) => {
  const statusOptions = [
    { value: 'pending', label: 'To-do', color: 'bg-gray-100 text-gray-800' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
    { value: 'completed', label: 'Done', color: 'bg-green-100 text-green-800' },
  ];

  const currentStatus = statusOptions.find((s) => s.value === task.status) || statusOptions[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{task.title}</h3>
          {task.description && <p className="text-sm text-gray-600 mt-1">{task.description}</p>}
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
            {task.assigned_to_name && <span>👤 {task.assigned_to_name}</span>}
            {task.due_date && <span>📅 {new Date(task.due_date).toLocaleDateString()}</span>}
            <span
              className={`px-2 py-0.5 rounded-full ${
                task.priority === 'high'
                  ? 'bg-red-100 text-red-800'
                  : task.priority === 'medium'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {task.priority}
            </span>
          </div>
        </div>
        <select
          value={task.status}
          onChange={(e) => onStatusUpdate(task.id, e.target.value)}
          className={`text-xs px-2 py-1 rounded-full border ${currentStatus.color} focus:outline-none`}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

// Modal component
const Modal = ({ title, children, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="bg-white rounded-2xl w-full max-w-md shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <FiX className="text-gray-500" />
          </button>
        </div>
        {children}
      </div>
    </motion.div>
  </motion.div>
);

export default ServiceWorkspace;
