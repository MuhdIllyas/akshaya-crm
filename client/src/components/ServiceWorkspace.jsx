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
  FiCalendar,
  FiArrowRight,
  FiChevronRight,
  FiActivity,
  FiLayers,
  FiMoreHorizontal,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Chat from '@/components/Chat';
import { useServiceChat } from '/src/hooks/useServiceChat';
import { socket } from '@/services/socket';

const API_BASE_URL = import.meta.env.VITE_API_URL;

/* ═══════════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════════ */

const PRIORITY = {
  high:   { label: 'High',   dot: 'bg-rose-500',    pill: 'bg-rose-50 text-rose-700 ring-rose-600/10' },
  medium: { label: 'Medium', dot: 'bg-amber-500',   pill: 'bg-amber-50 text-amber-700 ring-amber-600/10' },
  low:    { label: 'Low',    dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' },
};

const STATUS = {
  pending:     { label: 'To Do',       dot: 'bg-slate-400',   pill: 'bg-slate-50 text-slate-700 ring-slate-600/10',   accent: 'from-slate-400 to-slate-500' },
  in_progress: { label: 'In Progress', dot: 'bg-indigo-500',  pill: 'bg-indigo-50 text-indigo-700 ring-indigo-600/10', accent: 'from-indigo-500 to-violet-500' },
  completed:   { label: 'Done',        dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10', accent: 'from-emerald-500 to-teal-500' },
};

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'To-do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Done' },
];

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

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
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'Invalid date';
  }
};

const initials = (name) =>
  (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/* ═══════════════════════════════════════════════════════════════════
   PRIMITIVES
   ═══════════════════════════════════════════════════════════════════ */

const Avatar = ({ name, size = 'md', className = '' }) => {
  const sizes = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-[11px]',
    lg: 'w-10 h-10 text-xs',
  };
  return (
    <div
      className={`${sizes[size]} shrink-0 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white font-semibold flex items-center justify-center ring-2 ring-white ${className}`}
      title={name}
    >
      {initials(name)}
    </div>
  );
};

const PriorityBadge = ({ priority = 'medium' }) => {
  const p = PRIORITY[priority] || PRIORITY.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset ${p.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  );
};

const MetaChip = ({ icon: Icon, children }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
    {Icon && <Icon size={12} className="text-slate-400" />}
    <span className="truncate">{children}</span>
  </span>
);

const Button = ({ variant = 'primary', size = 'md', icon: Icon, children, className = '', ...rest }) => {
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 shadow-sm',
    accent:  'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm shadow-indigo-600/20',
    secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:ring-slate-300',
    ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  };
  const sizes = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-9 px-3.5 text-sm gap-2',
    lg: 'h-10 px-4 text-sm gap-2',
    icon: 'h-9 w-9 justify-center',
  };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 15} />}
      {children}
    </button>
  );
};

const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-20 px-6 bg-white rounded-2xl ring-1 ring-slate-200/70">
    {Icon && (
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200/70 flex items-center justify-center text-slate-400 mb-5">
        <Icon size={24} strokeWidth={1.5} />
      </div>
    )}
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    {description && <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

const Field = ({ label, required, hint, children }) => (
  <div>
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
    </div>
    {children}
  </div>
);

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400 transition';

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

const ServiceWorkspace = () => {
  const { selectedServiceId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('board');

  const [service, setService] = useState(null);
  const [serviceEntryId, setServiceEntryId] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ staffId: '', role: 'collaborator' });
  const [newTask, setNewTask] = useState({
    title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium',
  });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const token = localStorage.getItem('token');

  /* ------------------------------ data ---------------------------- */
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
          fetch(`${API_BASE_URL}/api/servicecollaboration/${actualServiceEntryId}/conversation`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/servicecollaboration/${actualServiceEntryId}/participants`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/servicecollaboration/${actualServiceEntryId}/tasks`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/servicecollaboration/${actualServiceEntryId}/documents`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/chat/staff`, { headers: { Authorization: `Bearer ${token}` } }),
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

  /* ----------------------------- socket --------------------------- */
  useEffect(() => {
    if (!socket?.connected || !serviceEntryId) return;

    const handleTaskUpdated = (data) => {
      setTasks((prev) => prev.map((t) => (String(t.id) === String(data.id) ? { ...t, status: data.status } : t)));
    };
    const handleTaskAssigned = (newTask) => {
      if (String(newTask.related_service_entry_id) === String(serviceEntryId)) {
        setTasks((prev) => (prev.some((t) => String(t.id) === String(newTask.id)) ? prev : [newTask, ...prev]));
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
    if (!newParticipant.staffId) return toast.error('Please select a staff member');
    try {
      const res = await fetch(`${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ staffId: parseInt(newParticipant.staffId), role: newParticipant.role }),
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

  /* ----------------------------- tasks ---------------------------- */
  const handleCreateTask = async () => {
    if (!serviceEntryId) return;
    if (!newTask.title.trim()) return toast.error('Task title is required');
    try {
      const res = await fetch(`${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      setTasks((prev) => prev.map((t) => (String(t.id) === String(taskId) ? { ...t, status: newStatus } : t)));
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
    if (file.size > 10 * 1024 * 1024) return toast.error('File size must be less than 10MB');
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

  /* ------------------------------ chat ---------------------------- */
  const { messages, loading: chatLoading, typingUsers, sendMessage } = useServiceChat(
    conversation?.id,
    currentUser,
    token,
    API_BASE_URL
  );

  const handleSendMessage = (text, file, optimisticMessage) => sendMessage(text, file, optimisticMessage);

  const handleDeleteMessage = async (messageId) => {
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

  /* --------------------------- derived ---------------------------- */
  const serviceInfo = useMemo(() => {
    if (!service) return null;
    return {
      name: service.service_name,
      applicationNumber: service.application_number,
      phone: service.phone,
      tasks: tasks.map((task) => ({
        id: task.id, title: task.title, description: task.description,
        assigned_to_name: task.assigned_to_name, due_date: task.due_date,
        priority: task.priority, status: task.status,
      })),
    };
  }, [service, tasks]);

  const tasksByStatus = useMemo(() => ({
    pending: tasks.filter((t) => t.status === 'pending'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    completed: tasks.filter((t) => t.status === 'completed'),
  }), [tasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    return { total, completed, inProgress, progress: total ? Math.round((completed / total) * 100) : 0 };
  }, [tasks]);

  const nav = useMemo(() => ([
    { id: 'board',        label: 'Board',        icon: FiGrid,         count: null },
    { id: 'chat',         label: 'Chat',         icon: FiMessageSquare, count: null },
    { id: 'tasks',        label: 'Tasks',        icon: FiCheckSquare,  count: tasks.length },
    { id: 'participants', label: 'Participants', icon: FiUsers,        count: participants.length },
    { id: 'documents',    label: 'Documents',    icon: FiFileText,     count: documents.length },
  ]), [tasks.length, participants.length, documents.length]);

  /* ----------------------------- loading -------------------------- */
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-[2.5px] border-slate-200" />
            <div className="absolute inset-0 rounded-full border-[2.5px] border-slate-900 border-t-transparent animate-spin" />
          </div>
          <p className="mt-4 text-xs font-medium text-slate-500 tracking-wide">Loading workspace…</p>
        </div>
      </div>
    );
  }

  /* ------------------------------ render -------------------------- */
  return (
    <div className="h-screen flex bg-slate-50 text-slate-900 antialiased">

      {/* ═══════════════════════ SIDEBAR ═══════════════════════ */}
      <aside className="hidden md:flex w-[228px] shrink-0 flex-col bg-white border-r border-slate-200/80">
        {/* Brand */}
        <div className="px-4 h-14 flex items-center gap-2.5 border-b border-slate-200/80">
          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center">
            <FiLayers size={14} className="text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-slate-900">Workspace</p>
            <p className="text-[10px] text-slate-400 tracking-wide uppercase">Service Ops</p>
          </div>
        </div>

        {/* Service summary */}
        <div className="px-3 pt-4 pb-3">
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-white ring-1 ring-slate-200/80 p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold">
                {(service?.service_name || 'S').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-900 truncate">
                  {service?.service_name || 'Service'}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  App #{service?.application_number || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 overflow-y-auto">
          <p className="px-2 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
            Workspace
          </p>
          <ul className="space-y-0.5">
            {nav.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <item.icon
                      size={15}
                      className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.count !== null && item.count > 0 && (
                      <span
                        className={`min-w-[18px] h-[18px] px-1 rounded-md text-[10px] font-semibold flex items-center justify-center ${
                          isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Progress footer */}
        <div className="p-3 border-t border-slate-200/80">
          <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200/80 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Progress
              </span>
              <span className="text-[11px] font-semibold text-slate-900">
                {stats.progress}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-slate-900 to-slate-700 transition-all duration-700"
                style={{ width: `${stats.progress}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              {stats.completed} of {stats.total} tasks complete
            </p>
          </div>
        </div>
      </aside>

      {/* ═══════════════════════ MAIN ═══════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ─────────── HEADER ─────────── */}
        <header className="shrink-0 bg-white/85 backdrop-blur-xl border-b border-slate-200/80">
          <div className="px-6 lg:px-8">
            {/* Breadcrumb */}
            <div className="pt-4 flex items-center gap-1.5 text-[11px] text-slate-400">
              <button onClick={() => navigate('/dashboard/staff')} className="hover:text-slate-600 transition-colors">
                Dashboard
              </button>
              <FiChevronRight size={11} />
              <button
                onClick={() => navigate('/dashboard/staff/track_service')}
                className="hover:text-slate-600 transition-colors"
              >
                Track Service
              </button>
              <FiChevronRight size={11} />
              <span className="text-slate-700 font-medium truncate">
                {service?.service_name || 'Workspace'}
              </span>
            </div>

            {/* Title row */}
            <div className="pt-3 pb-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <button
                  onClick={() => navigate('/dashboard/staff/track_service')}
                  aria-label="Back"
                  className="mt-0.5 shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  <FiArrowLeft size={16} />
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-semibold text-slate-900 tracking-tight truncate">
                      {service?.service_name || 'Service Workspace'}
                    </h1>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </div>

                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-1.5">
                    <MetaChip icon={FiUser}>{service?.customer_name || '—'}</MetaChip>
                    <span className="hidden sm:block w-px h-3 bg-slate-200" />
                    <MetaChip icon={FiFile}>App #{service?.application_number || '—'}</MetaChip>
                    <span className="hidden md:block w-px h-3 bg-slate-200" />
                    <MetaChip icon={FiClock}>
                      Created {formatDate(service?.created_at || service?.createdAt)}
                    </MetaChip>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                {/* Collaborators */}
                {participants.length > 0 && (
                  <div className="hidden lg:flex items-center -space-x-2">
                    {participants.slice(0, 4).map((p) => (
                      <Avatar key={p.staff_id} name={p.name} size="md" />
                    ))}
                    {participants.length > 4 && (
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold flex items-center justify-center ring-2 ring-white">
                        +{participants.length - 4}
                      </div>
                    )}
                  </div>
                )}

                <Button variant="accent" icon={FiPlus} onClick={() => setShowTaskModal(true)}>
                  New Task
                </Button>
              </div>
            </div>

            {/* Segmented tabs (mobile nav fallback + desktop) */}
            <div className="md:hidden pb-3 flex gap-1 overflow-x-auto">
              {nav.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <item.icon size={13} />
                    {item.label}
                    {item.count > 0 && (
                      <span className={`text-[10px] ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* ─────────── CONTENT ─────────── */}
        <main className={`flex-1 min-h-0 ${activeTab === 'chat' ? 'bg-white' : 'overflow-auto'}`}>
          <AnimatePresence mode="wait">
            {/* ══════ BOARD ══════ */}
            {activeTab === 'board' && (
              <motion.div
                key="board"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="p-6 lg:p-8 h-full flex flex-col"
              >
                {/* Metrics strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <MetricCard
                    label="Total Tasks"
                    value={stats.total}
                    accent="from-slate-500 to-slate-700"
                    icon={FiLayers}
                  />
                  <MetricCard
                    label="In Progress"
                    value={stats.inProgress}
                    accent="from-indigo-500 to-violet-500"
                    icon={FiActivity}
                  />
                  <MetricCard
                    label="Completed"
                    value={stats.completed}
                    accent="from-emerald-500 to-teal-500"
                    icon={FiCheckSquare}
                  />
                  <MetricCard
                    label="Collaborators"
                    value={participants.length}
                    accent="from-amber-500 to-orange-500"
                    icon={FiUsers}
                  />
                </div>

                {/* Kanban */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1 min-h-0">
                  <BoardColumn title="To Do"       status="pending"     tasks={tasksByStatus.pending}     onTaskMove={handleTaskStatusUpdate} />
                  <BoardColumn title="In Progress" status="in_progress" tasks={tasksByStatus.in_progress} onTaskMove={handleTaskStatusUpdate} />
                  <BoardColumn title="Done"        status="completed"   tasks={tasksByStatus.completed}   onTaskMove={handleTaskStatusUpdate} />
                </div>
              </motion.div>
            )}

            {/* ══════ CHAT ══════ */}
            {activeTab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
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

            {/* ══════ TASKS ══════ */}
            {activeTab === 'tasks' && (
              <motion.div
                key="tasks"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="p-6 lg:p-8 max-w-5xl mx-auto"
              >
                <SectionHeader
                  title="All Tasks"
                  subtitle={`${stats.completed} of ${stats.total} completed`}
                  action={<Button variant="accent" size="sm" icon={FiPlus} onClick={() => setShowTaskModal(true)}>New Task</Button>}
                />
                {tasks.length === 0 ? (
                  <EmptyState
                    icon={FiCheckSquare}
                    title="No tasks yet"
                    description="Break this service down into tasks and assign them to your team."
                    action={
                      <Button variant="accent" size="sm" icon={FiPlus} onClick={() => setShowTaskModal(true)}>
                        Create your first task
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-2.5">
                    {tasks.map((task) => (
                      <TaskCard key={task.id} task={task} onStatusUpdate={handleTaskStatusUpdate} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ══════ PARTICIPANTS ══════ */}
            {activeTab === 'participants' && (
              <motion.div
                key="participants"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="p-6 lg:p-8 max-w-5xl mx-auto"
              >
                <SectionHeader
                  title="Collaborators"
                  subtitle="People with access to this service workspace."
                  action={<Button variant="accent" size="sm" icon={FiPlus} onClick={() => setShowParticipantModal(true)}>Add Participant</Button>}
                />
                {participants.length === 0 ? (
                  <EmptyState
                    icon={FiUsers}
                    title="No collaborators"
                    description="Invite team members to collaborate on this service."
                    action={
                      <Button variant="accent" size="sm" icon={FiPlus} onClick={() => setShowParticipantModal(true)}>
                        Add a participant
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {participants.map((p) => (
                      <div
                        key={p.staff_id}
                        className="group bg-white rounded-xl ring-1 ring-slate-200/70 p-4 hover:ring-slate-300 hover:shadow-[0_4px_16px_-4px_rgba(15,23,42,0.06)] transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar name={p.name} size="lg" />
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-slate-900 truncate">{p.name}</p>
                              <p className="text-[11px] text-slate-500 capitalize truncate mt-0.5">
                                {p.role} · {p.staff_role}
                              </p>
                            </div>
                          </div>
                          {p.staff_id !== service?.assignedToId && (
                            <button
                              onClick={() => handleRemoveParticipant(p.staff_id)}
                              aria-label={`Remove ${p.name}`}
                              className="shrink-0 p-1.5 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ══════ DOCUMENTS ══════ */}
            {activeTab === 'documents' && (
              <motion.div
                key="documents"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="p-6 lg:p-8 max-w-5xl mx-auto"
              >
                <SectionHeader
                  title="Shared Documents"
                  subtitle="Files attached to this service workspace."
                  action={
                    <>
                      <input
                        type="file"
                        id="doc-upload"
                        className="hidden"
                        onChange={handleDocumentUpload}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      />
                      <Button
                        variant="accent"
                        size="sm"
                        icon={FiUpload}
                        onClick={() => document.getElementById('doc-upload').click()}
                        disabled={uploadingDoc}
                      >
                        {uploadingDoc ? 'Uploading…' : 'Upload Document'}
                      </Button>
                    </>
                  }
                />
                {documents.length === 0 ? (
                  <EmptyState
                    icon={FiFileText}
                    title="No documents yet"
                    description="Upload files to share them with everyone in this workspace."
                  />
                ) : (
                  <div className="bg-white rounded-xl ring-1 ring-slate-200/70 overflow-hidden divide-y divide-slate-100">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="group flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50/60 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0 w-9 h-9 rounded-lg bg-slate-50 ring-1 ring-slate-200/70 flex items-center justify-center text-slate-500">
                            <FiFileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-slate-900 truncate">{doc.document_name}</p>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {doc.uploaded_by_name || 'Staff'} · {new Date(doc.created_at).toLocaleDateString()}
                              {doc.file_size ? ` · ${(doc.file_size / 1024).toFixed(1)} KB` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <a
                            href={`${API_BASE_URL}/api/files/version/${doc.id}/download?token=${token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download"
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          >
                            <FiDownload size={15} />
                          </a>
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            title="Delete"
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <FiTrash2 size={15} />
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
      </div>

      {/* ═══════════════════════ MODALS ═══════════════════════ */}
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
              <Field label="Staff Member" required>
                <select
                  value={newParticipant.staffId}
                  onChange={(e) => setNewParticipant({ ...newParticipant, staffId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select staff…</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </Field>
              <Field label="Role" required>
                <select
                  value={newParticipant.role}
                  onChange={(e) => setNewParticipant({ ...newParticipant, role: e.target.value })}
                  className={inputClass}
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
                  className={inputClass}
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={3}
                  placeholder="Add any details the assignee should know…"
                  className={`${inputClass} resize-none`}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Assign To">
                  <select
                    value={newTask.assignedTo}
                    onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Unassigned</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Due Date">
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className={inputClass}
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
                            ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : PRIORITY[p].dot}`} />
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

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

const MetricCard = ({ label, value, accent, icon: Icon }) => (
  <div className="relative bg-white rounded-xl ring-1 ring-slate-200/70 p-4 overflow-hidden">
    <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accent}`} />
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${accent} flex items-center justify-center text-white shadow-sm`}>
        <Icon size={13} />
      </div>
    </div>
    <p className="text-2xl font-semibold text-slate-900 tracking-tight tabular-nums">{value}</p>
  </div>
);

const SectionHeader = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-4 mb-5">
    <div>
      <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/* ------------------------------ Board ------------------------------ */
const BoardColumn = ({ title, tasks, status, onTaskMove }) => {
  const meta = STATUS[status];
  const nextStatus = status === 'pending' ? 'in_progress' : status === 'in_progress' ? 'completed' : null;
  const nextLabel = status === 'pending' ? 'Start' : status === 'in_progress' ? 'Complete' : null;

  return (
    <div className="flex flex-col bg-slate-100/50 rounded-2xl ring-1 ring-slate-200/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/70 bg-white/50">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          <h3 className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider">{title}</h3>
        </div>
        <span className="min-w-[22px] h-[22px] px-1.5 rounded-md bg-white ring-1 ring-slate-200 text-[11px] font-semibold text-slate-600 flex items-center justify-center tabular-nums">
          {tasks.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-300">
              <FiCheckSquare size={16} />
            </div>
            <p className="text-[11px] text-slate-400 mt-2.5">No tasks</p>
          </div>
        ) : (
          tasks.map((task) => (
            <BoardTaskCard
              key={task.id}
              task={task}
              nextStatus={nextStatus}
              nextLabel={nextLabel}
              onMove={onTaskMove}
            />
          ))
        )}
      </div>
    </div>
  );
};

const BoardTaskCard = ({ task, nextStatus, nextLabel, onMove }) => {
  const priority = PRIORITY[task.priority] || PRIORITY.medium;
  return (
    <div className="group relative bg-white rounded-xl ring-1 ring-slate-200/70 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:ring-slate-300 hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.06)] transition-all">
      <span className={`absolute left-0 top-3.5 bottom-3.5 w-0.5 rounded-r-full ${priority.dot}`} />

      <div className="flex items-start justify-between gap-2.5">
        <p className="text-[13px] font-medium text-slate-900 leading-snug line-clamp-2 flex-1">
          {task.title}
        </p>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description && (
        <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2.5 text-[10px] text-slate-500 min-w-0">
          {task.assigned_to_name && (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Avatar name={task.assigned_to_name} size="xs" className="!ring-0" />
              <span className="truncate max-w-[80px]">{task.assigned_to_name}</span>
            </span>
          )}
          {task.due_date && (
            <span className="inline-flex items-center gap-1 shrink-0">
              <FiCalendar size={10} className="text-slate-400" />
              {new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>

        {nextStatus && (
          <button
            onClick={() => onMove(task.id, nextStatus)}
            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-900 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            {nextLabel}
            <FiArrowRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
};

/* ----------------------------- TaskCard ---------------------------- */
const TaskCard = ({ task, onStatusUpdate }) => {
  const priority = PRIORITY[task.priority] || PRIORITY.medium;
  const status = STATUS[task.status] || STATUS.pending;

  return (
    <div className="group relative bg-white rounded-xl ring-1 ring-slate-200/70 hover:ring-slate-300 hover:shadow-[0_4px_16px_-4px_rgba(15,23,42,0.06)] transition-all overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${priority.dot}`} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3.5 pl-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[13px] font-semibold text-slate-900">{task.title}</h3>
            <PriorityBadge priority={task.priority} />
          </div>

          {task.description && (
            <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{task.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
            {task.assigned_to_name && (
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={task.assigned_to_name} size="xs" className="!ring-0" />
                {task.assigned_to_name}
              </span>
            )}
            {task.due_date && (
              <span className="inline-flex items-center gap-1.5">
                <FiCalendar size={11} className="text-slate-400" />
                {new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0">
          <select
            value={task.status}
            onChange={(e) => onStatusUpdate(task.id, e.target.value)}
            className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg ring-1 ring-inset cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${status.pill}`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------ Modal ------------------------------ */
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
      initial={{ y: 12, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 12, opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white rounded-2xl w-full max-w-lg shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 -mt-1 -mr-1 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <FiX size={16} />
        </button>
      </div>

      <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">{children}</div>

      <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50/60 border-t border-slate-100">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="accent" onClick={onSubmit}>{submitLabel}</Button>
      </div>
    </motion.div>
  </motion.div>
);

export default ServiceWorkspace;