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
  FiUser,
  FiFile,
  FiClock,
  FiChevronRight,
  FiCalendar,
  FiArrowRight,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Chat from '@/components/Chat';
import { useServiceChat } from '/src/hooks/useServiceChat';
import { socket } from '@/services/socket';

const API_BASE_URL = import.meta.env.VITE_API_URL;

/* ------------------------------------------------------------------ */
/*  Design tokens                                                      */
/* ------------------------------------------------------------------ */

const PRIORITY = {
  high: { label: 'High', dot: 'bg-rose-500', pill: 'bg-rose-50 text-rose-700 border-rose-100' },
  medium: { label: 'Medium', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700 border-amber-100' },
  low: { label: 'Low', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
};

const STATUS = {
  pending: { label: 'To Do', dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-700 border-slate-200' },
  in_progress: { label: 'In Progress', dot: 'bg-indigo-500', pill: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  completed: { label: 'Done', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
};

const STATUS_OPTIONS = [
  { value: 'pending', label: 'To-do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Done' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return 'Invalid date';
  }
};

/* ------------------------------------------------------------------ */
/*  Small presentational primitives                                    */
/* ------------------------------------------------------------------ */

const Avatar = ({ name, size = 'md', className = '' }) => {
  const sizes = { sm: 'w-7 h-7 text-[10px]', md: 'w-8 h-8 text-xs', lg: 'w-10 h-10 text-sm' };
  return (
    <div
      className={`${sizes[size]} rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-semibold flex items-center justify-center ring-2 ring-white ${className}`}
    >
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
};

const PriorityBadge = ({ priority = 'medium' }) => {
  const p = PRIORITY[priority] || PRIORITY.medium;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${p.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  );
};

const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-slate-200">
    {Icon && (
      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4">
        <Icon size={22} />
      </div>
    )}
    <p className="text-sm font-semibold text-slate-800">{title}</p>
    {description && <p className="text-xs text-slate-500 mt-1 max-w-xs">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const ServiceWorkspace = () => {
  const { selectedServiceId } = useParams();
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
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: '',
    priority: 'medium',
  });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const token = localStorage.getItem('token');

  /* ----------------------------- data ----------------------------- */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const serviceRes = await fetch(`${API_BASE_URL}/api/servicetracking/${selectedServiceId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!serviceRes.ok) throw new Error('Failed to fetch service');
        const serviceData = await serviceRes.json();
        setService(serviceData);
        const actualServiceEntryId = serviceData.service_entry_id;
        setServiceEntryId(actualServiceEntryId);

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

  /* -------------------------- socket sync ------------------------- */
  useEffect(() => {
    if (!socket?.connected || !serviceEntryId) return;

    const handleTaskUpdated = (data) => {
      setTasks((prev) =>
        prev.map((t) => (String(t.id) === String(data.id) ? { ...t, status: data.status } : t))
      );
    };

    const handleTaskAssigned = (newTask) => {
      if (String(newTask.related_service_entry_id) === String(serviceEntryId)) {
        setTasks((prev) => {
          if (prev.some((t) => String(t.id) === String(newTask.id))) return prev;
          return [newTask, ...prev];
        });
      }
    };

    socket.on('taskUpdated', handleTaskUpdated);
    socket.on('taskAssigned', handleTaskAssigned);

    return () => {
      socket.off('taskUpdated', handleTaskUpdated);
      socket.off('taskAssigned', handleTaskAssigned);
    };
  }, [serviceEntryId]);

  /* -------------------------- participants ------------------------ */
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
      const res = await fetch(
        `${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/participants/${staffId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error('Failed to remove participant');
      toast.success('Participant removed');
      setParticipants((prev) => prev.filter((p) => p.staff_id !== staffId));
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  };

  /* ----------------------------- tasks ---------------------------- */
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
      const res = await fetch(
        `${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/tasks/${taskId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!res.ok) throw new Error('Failed to update task');

      setTasks((prev) =>
        prev.map((t) => (String(t.id) === String(taskId) ? { ...t, status: newStatus } : t))
      );
      toast.success(`Task marked as ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error(err.message);
      throw err;
    }
  };

  /* --------------------------- documents -------------------------- */
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
      const res = await fetch(
        `${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/documents/${docId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error('Delete failed');
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success('Document deleted');
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    }
  };

  /* ------------------------------ chat ---------------------------- */
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

  /* --------------------------- derived data ----------------------- */
  const serviceInfo = useMemo(() => {
    if (!service) return null;
    return {
      name: service.service_name,
      applicationNumber: service.application_number,
      phone: service.phone,
      tasks: tasks.map((task) => ({
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

  const tasksByStatus = useMemo(
    () => ({
      pending: tasks.filter((t) => t.status === 'pending'),
      in_progress: tasks.filter((t) => t.status === 'in_progress'),
      completed: tasks.filter((t) => t.status === 'completed'),
    }),
    [tasks]
  );

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    return { total, completed, progress: total ? Math.round((completed / total) * 100) : 0 };
  }, [tasks]);

  const tabs = useMemo(
    () => [
      { id: 'board', label: 'Board', icon: FiGrid, count: null },
      { id: 'chat', label: 'Chat', icon: FiMessageSquare, count: null },
      { id: 'tasks', label: 'Tasks', icon: FiCheckSquare, count: tasks.length },
      { id: 'participants', label: 'Participants', icon: FiUsers, count: participants.length },
      { id: 'documents', label: 'Documents', icon: FiFileText, count: documents.length },
    ],
    [tasks.length, participants.length, documents.length]
  );

  /* ----------------------------- loading -------------------------- */
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
            <div className="absolute inset-0 rounded-full border-[3px] border-indigo-600 border-t-transparent animate-spin" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">Loading workspace…</p>
        </div>
      </div>
    );
  }

  /* ------------------------------ render -------------------------- */
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* ============================ HEADER ============================ */}
      <header className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            {/* Left: back + title */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate('/dashboard/staff/track_service')}
                aria-label="Back to service tracking"
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                <FiArrowLeft size={17} />
              </button>

              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate leading-tight">
                  {service?.service_name || 'Service'}
                  <span className="text-slate-400 font-normal"> · Workspace</span>
                </h1>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 truncate">
                  <span className="inline-flex items-center gap-1.5">
                    <FiUser size={12} className="text-slate-400" />
                    {service?.customer_name || '—'}
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1.5">
                    <FiFile size={12} className="text-slate-400" />#{service?.application_number || '—'}
                  </span>
                  <span className="hidden md:inline-flex items-center gap-1.5">
                    <FiClock size={12} className="text-slate-400" />
                    {formatDate(service?.created_at || service?.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: progress + collaborators */}
            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-3 pr-4 border-r border-slate-200">
                <div className="text-right leading-tight">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Progress
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {stats.completed}
                    <span className="text-slate-400 font-normal">/{stats.total} tasks</span>
                  </p>
                </div>
                <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                    style={{ width: `${stats.progress}%` }}
                  />
                </div>
              </div>

              {participants.length > 0 && (
                <div className="flex items-center -space-x-2">
                  {participants.slice(0, 4).map((p) => (
                    <Avatar key={p.staff_id} name={p.name} />
                  ))}
                  {participants.length > 4 && (
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center ring-2 ring-white">
                      +{participants.length - 4}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================ TABS ============================ */}
        <div className="px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1 overflow-x-auto -mb-px">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative shrink-0 flex items-center gap-2 px-3.5 py-3 text-sm font-medium transition-colors ${
                    isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                  {tab.count !== null && tab.count > 0 && (
                    <span
                      className={`ml-0.5 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center ${
                        isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {isActive && (
                    <motion.span
                      layoutId="workspace-tab-underline"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-indigo-600"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ============================ CONTENT ============================ */}
      <main
        className={`flex-1 min-h-0 ${
          activeTab === 'chat' ? '' : 'overflow-auto p-4 sm:p-6 lg:p-8'
        }`}
      >
        <AnimatePresence mode="wait">
          {/* ---------------------------- BOARD ---------------------------- */}
          {activeTab === 'board' && (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
              className="h-full"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Task Board</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Track work across To Do, In Progress and Done.
                  </p>
                </div>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm shadow-indigo-600/20"
                >
                  <FiPlus size={16} /> New Task
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 h-[calc(100%-64px)] min-h-[420px]">
                <BoardColumn
                  title="To Do"
                  status="pending"
                  tasks={tasksByStatus.pending}
                  onTaskMove={handleTaskStatusUpdate}
                />
                <BoardColumn
                  title="In Progress"
                  status="in_progress"
                  tasks={tasksByStatus.in_progress}
                  onTaskMove={handleTaskStatusUpdate}
                />
                <BoardColumn
                  title="Done"
                  status="completed"
                  tasks={tasksByStatus.completed}
                  onTaskMove={handleTaskStatusUpdate}
                />
              </div>
            </motion.div>
          )}

          {/* ----------------------------- CHAT ---------------------------- */}
          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
              className="h-full bg-white"
            >
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
            </motion.div>
          )}

          {/* ----------------------------- TASKS --------------------------- */}
          {activeTab === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
              className="max-w-5xl mx-auto space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">All Tasks</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {stats.completed} of {stats.total} completed
                  </p>
                </div>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm shadow-indigo-600/20"
                >
                  <FiPlus size={16} /> New Task
                </button>
              </div>

              {tasks.length === 0 ? (
                <EmptyState
                  icon={FiCheckSquare}
                  title="No tasks yet"
                  description="Break this service down into tasks and assign them to your team."
                  action={
                    <button
                      onClick={() => setShowTaskModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                      <FiPlus size={16} /> Create your first task
                    </button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} onStatusUpdate={handleTaskStatusUpdate} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* -------------------------- PARTICIPANTS ----------------------- */}
          {activeTab === 'participants' && (
            <motion.div
              key="participants"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
              className="max-w-5xl mx-auto space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Collaborators</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    People with access to this service workspace.
                  </p>
                </div>
                <button
                  onClick={() => setShowParticipantModal(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm shadow-indigo-600/20"
                >
                  <FiPlus size={16} /> Add Participant
                </button>
              </div>

              {participants.length === 0 ? (
                <EmptyState
                  icon={FiUsers}
                  title="No collaborators"
                  description="Invite team members to collaborate on this service."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {participants.map((p) => (
                    <div
                      key={p.staff_id}
                      className="group bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={p.name} size="lg" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                          <p className="text-xs text-slate-500 capitalize truncate">
                            {p.role} · {p.staff_role}
                          </p>
                        </div>
                      </div>
                      {p.staff_id !== service?.assignedToId && (
                        <button
                          onClick={() => handleRemoveParticipant(p.staff_id)}
                          aria-label={`Remove ${p.name}`}
                          className="shrink-0 p-2 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* --------------------------- DOCUMENTS ------------------------- */}
          {activeTab === 'documents' && (
            <motion.div
              key="documents"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
              className="max-w-5xl mx-auto space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Shared Documents</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Files attached to this service workspace.
                  </p>
                </div>
                <div>
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
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm shadow-indigo-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {uploadingDoc ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <FiUpload size={16} /> Upload Document
                      </>
                    )}
                  </button>
                </div>
              </div>

              {documents.length === 0 ? (
                <EmptyState
                  icon={FiFileText}
                  title="No documents yet"
                  description="Upload files to share them with everyone in this workspace."
                />
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="group flex items-center justify-between gap-4 p-4 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
                          <FiFileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {doc.document_name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {doc.uploaded_by_name || 'Staff'} ·{' '}
                            {new Date(doc.created_at).toLocaleDateString()}
                            {doc.file_size ? ` · ${(doc.file_size / 1024).toFixed(1)} KB` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`${API_BASE_URL}/api/files/version/${doc.id}/download?token=${token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download"
                          className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <FiDownload size={17} />
                        </a>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          title="Delete"
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <FiTrash2 size={17} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ============================ MODALS ============================ */}
      <AnimatePresence>
        {showParticipantModal && (
          <Modal
            title="Add Participant"
            subtitle="Grant a team member access to this workspace."
            onClose={() => setShowParticipantModal(false)}
            onSubmit={handleAddParticipant}
            submitLabel="Add Participant"
          >
            <div className="space-y-4">
              <Field label="Staff Member">
                <select
                  value={newParticipant.staffId}
                  onChange={(e) => setNewParticipant({ ...newParticipant, staffId: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                >
                  <option value="">Select staff…</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Role">
                <select
                  value={newParticipant.role}
                  onChange={(e) => setNewParticipant({ ...newParticipant, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                >
                  <option value="collaborator">Collaborator</option>
                  <option value="reviewer">Reviewer</option>
                </select>
              </Field>
            </div>
          </Modal>
        )}

        {showTaskModal && (
          <Modal
            title="Create New Task"
            subtitle="Assign work and keep the service moving."
            onClose={() => setShowTaskModal(false)}
            onSubmit={handleCreateTask}
            submitLabel="Create Task"
          >
            <div className="space-y-4">
              <Field label="Title" required>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="e.g. Verify customer documents"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={3}
                  placeholder="Add any details the assignee should know…"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition resize-none"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Assign To">
                  <select
                    value={newTask.assignedTo}
                    onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                  >
                    <option value="">Unassigned</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Due Date">
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                  />
                </Field>
              </div>

              <Field label="Priority">
                <div className="grid grid-cols-3 gap-2">
                  {['low', 'medium', 'high'].map((p) => {
                    const active = newTask.priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewTask({ ...newTask, priority: p })}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium capitalize transition-all ${
                          active
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/20'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY[p].dot}`} />
                        {p}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Board column                                                       */
/* ------------------------------------------------------------------ */

const BoardColumn = ({ title, tasks, status, onTaskMove }) => {
  const meta = STATUS[status];

  const getNextStatus = (currentStatus) => {
    if (currentStatus === 'pending') return 'in_progress';
    if (currentStatus === 'in_progress') return 'completed';
    return null;
  };

  const getNextLabel = (currentStatus) => {
    if (currentStatus === 'pending') return 'Start';
    if (currentStatus === 'in_progress') return 'Complete';
    return null;
  };

  return (
    <div className="flex flex-col bg-slate-100/60 rounded-2xl border border-slate-200/70 overflow-hidden">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/60 border-b border-slate-200/70">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        </div>
        <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-500 flex items-center justify-center">
          {tasks.length}
        </span>
      </div>

      {/* Column body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-9 h-9 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-300">
              <FiCheckSquare size={16} />
            </div>
            <p className="text-xs text-slate-400 mt-2">Nothing here</p>
          </div>
        ) : (
          tasks.map((task) => (
            <BoardTaskCard
              key={task.id}
              task={task}
              nextStatus={getNextStatus(status)}
              nextLabel={getNextLabel(status)}
              onMove={onTaskMove}
            />
          ))
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Board task card                                                    */
/* ------------------------------------------------------------------ */

const BoardTaskCard = ({ task, nextStatus, nextLabel, onMove }) => {
  const priority = PRIORITY[task.priority] || PRIORITY.medium;

  return (
    <div className="group relative bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
      {/* Priority rail */}
      <span className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${priority.dot} opacity-70`} />

      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
          {task.title}
        </p>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description && (
        <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-3 text-[11px] text-slate-500 min-w-0">
          {task.assigned_to_name && (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Avatar name={task.assigned_to_name} size="sm" className="!w-5 !h-5 !text-[9px] !ring-0" />
              <span className="truncate">{task.assigned_to_name}</span>
            </span>
          )}
          {task.due_date && (
            <span className="inline-flex items-center gap-1 shrink-0">
              <FiCalendar size={11} className="text-slate-400" />
              {new Date(task.due_date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          )}
        </div>

        {nextStatus && (
          <button
            onClick={() => onMove(task.id, nextStatus)}
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            {nextLabel}
            <FiArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Task list card                                                     */
/* ------------------------------------------------------------------ */

const TaskCard = ({ task, onStatusUpdate }) => {
  const priority = PRIORITY[task.priority] || PRIORITY.medium;
  const status = STATUS[task.status] || STATUS.pending;

  return (
    <div className="group relative bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${priority.dot} opacity-70`} />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 pl-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
            <PriorityBadge priority={task.priority} />
          </div>

          {task.description && (
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{task.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-500">
            {task.assigned_to_name && (
              <span className="inline-flex items-center gap-1.5">
                <Avatar
                  name={task.assigned_to_name}
                  size="sm"
                  className="!w-5 !h-5 !text-[9px] !ring-0"
                />
                {task.assigned_to_name}
              </span>
            )}
            {task.due_date && (
              <span className="inline-flex items-center gap-1.5">
                <FiCalendar size={12} className="text-slate-400" />
                {new Date(task.due_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0">
          <select
            value={task.status}
            onChange={(e) => onStatusUpdate(task.id, e.target.value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${status.pill}`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Modal + Field                                                      */
/* ------------------------------------------------------------------ */

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
      {label}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const Modal = ({ title, subtitle, children, onClose, onSubmit, submitLabel = 'Save' }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
    className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ y: 16, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 16, opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="bg-white rounded-2xl w-full max-w-lg shadow-2xl shadow-slate-900/10 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <FiX size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">{children}</div>

      {/* Footer */}
      <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm shadow-indigo-600/20"
        >
          {submitLabel}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

export default ServiceWorkspace;