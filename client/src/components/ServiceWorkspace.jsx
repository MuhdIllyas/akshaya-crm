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
  FiChevronDown,
  FiAlertCircle,
  FiRefreshCw,
  FiMail,
  FiCreditCard,
  FiFlag,
  FiTrendingUp,
  FiAward,
  FiBarChart2,
  FiCheckCircle,
  FiMoreHorizontal,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Chat from '@/components/Chat';
import { useServiceChat } from '/src/hooks/useServiceChat';
import { socket } from '@/services/socket';

const API_BASE_URL = import.meta.env.VITE_API_URL;

/* ══════════════════════════════════════════════════════════════════
   ERROR BOUNDARY (matches TrackServicePage)
   ══════════════════════════════════════════════════════════════════ */
class WorkspaceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Workspace error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center shadow-sm">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiAlertCircle className="h-8 w-8 text-rose-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              There was an error loading the workspace. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ══════════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════════ */
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
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Invalid date';
  }
};

const formatTimelineDate = (dateString) => {
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(date)
      .replace(',', ' at');
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

/* ══════════════════════════════════════════════════════════════════
   DESIGN TOKENS (matched to TrackServicePage)
   ══════════════════════════════════════════════════════════════════ */
const PRIORITY_CONFIG = {
  high: {
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-600',
    label: 'High',
  },
  medium: {
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-600',
    label: 'Medium',
  },
  low: {
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-600',
    label: 'Low',
  },
};

const STATUS_CONFIG = {
  pending: {
    color: 'text-amber-800',
    bg: 'bg-amber-100',
    border: 'border-amber-300',
    dot: 'bg-amber-600',
    label: 'To Do',
  },
  in_progress: {
    color: 'text-blue-800',
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    dot: 'bg-blue-600',
    label: 'In Progress',
  },
  completed: {
    color: 'text-emerald-800',
    bg: 'bg-emerald-100',
    border: 'border-emerald-300',
    dot: 'bg-emerald-600',
    label: 'Done',
  },
};

const STATUS_OPTIONS = [
  { value: 'pending', label: 'To-do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Done' },
];

/* ══════════════════════════════════════════════════════════════════
   PRIMITIVES (matched to TrackServicePage styles)
   ══════════════════════════════════════════════════════════════════ */
const Avatar = ({ name, size = 'md', className = '' }) => {
  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-7 h-7 text-[11px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };
  return (
    <div
      className={`${sizes[size]} shrink-0 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm ${className}`}
      title={name}
    >
      {initials(name)}
    </div>
  );
};

const PriorityBadge = ({ priority = 'medium' }) => {
  const p = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center space-x-1 border ${p.bg} ${p.border}`}
    >
      <FiFlag className={`h-3 w-3 ${p.color}`} />
      <span className={p.color}>{p.label}</span>
    </span>
  );
};

const StatusBadge = ({ status = 'pending' }) => {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center space-x-1 border ${s.bg} ${s.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className={s.color}>{s.label}</span>
    </span>
  );
};

const KPIStat = ({ title, value, subtitle, trend, icon: Icon, color }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 group"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
        <div className="flex items-center space-x-2">
          {trend !== undefined && (
            <span className={`text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend > 0 ? '+' : ''}
              {trend}%
            </span>
          )}
          {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
        </div>
      </div>
      <div className={`p-3 rounded-xl ${color} transition-colors group-hover:scale-110`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </motion.div>
);

const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
    {Icon && <Icon className="mx-auto h-10 w-10 text-gray-300 mb-3" />}
    <p className="text-base font-medium text-gray-900">{title}</p>
    {description && <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

const SectionHeader = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-4 mb-4">
    <div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

const PrimaryButton = ({ icon: Icon, children, className = '', ...rest }) => (
  <button
    {...rest}
    className={`flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
  >
    {Icon && <Icon className="h-4 w-4" />}
    {children && <span>{children}</span>}
  </button>
);

const SecondaryButton = ({ icon: Icon, children, className = '', ...rest }) => (
  <button
    {...rest}
    className={`flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-all duration-200 ${className}`}
  >
    {Icon && <Icon className="h-4 w-4" />}
    {children && <span>{children}</span>}
  </button>
);

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */
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
    title: '',
    description: '',
    assignedTo: '',
    dueDate: '',
    priority: 'medium',
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

  /* ----------------------------- socket --------------------------- */
  useEffect(() => {
    if (!socket?.connected || !serviceEntryId) return;

    const handleTaskUpdated = (data) => {
      setTasks((prev) =>
        prev.map((t) => (String(t.id) === String(data.id) ? { ...t, status: data.status } : t))
      );
    };
    const handleTaskAssigned = (newTask) => {
      if (String(newTask.related_service_entry_id) === String(serviceEntryId)) {
        setTasks((prev) =>
          prev.some((t) => String(t.id) === String(newTask.id)) ? prev : [newTask, ...prev]
        );
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
      const partsRes = await fetch(
        `${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/participants`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
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
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
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
    if (!newTask.title.trim()) return toast.error('Task title is required');
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
      toast.success(`Task marked as ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
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
      const res = await fetch(
        `${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/documents`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
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
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
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
  const {
    messages,
    loading: chatLoading,
    typingUsers,
    sendMessage,
  } = useServiceChat(conversation?.id, currentUser, token, API_BASE_URL);

  const handleSendMessage = (text, file, optimisticMessage) =>
    sendMessage(text, file, optimisticMessage);

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
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const pending = tasks.filter((t) => t.status === 'pending').length;
    return {
      total,
      completed,
      inProgress,
      pending,
      progress: total ? Math.round((completed / total) * 100) : 0,
    };
  }, [tasks]);

  const tabs = useMemo(
    () => [
      { id: 'board', label: 'Board', icon: FiGrid, count: tasks.length },
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading service workspace...</p>
        </div>
      </div>
    );
  }

  /* ------------------------------ render -------------------------- */
  return (
    <WorkspaceErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* ══════════════════ HEADER ══════════════════ */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-[1600px] mx-auto px-6 py-4">
            {/* Top row */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center space-x-4 min-w-0">
                <button
                  onClick={() => navigate('/dashboard/staff/track_service')}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                  title="Back to Track Service"
                >
                  <FiArrowLeft className="h-5 w-5 text-gray-600" />
                </button>

                <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shrink-0">
                  <FiGrid className="h-5 w-5 text-white" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-gray-900 truncate">
                      {service?.service_name || 'Service Workspace'}
                    </h1>
                    <span className="px-2 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded-full border border-green-200">
                      Active
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <FiUser className="h-3 w-3" /> {service?.customer_name || '—'}
                    </span>
                    <span className="hidden sm:flex items-center gap-1">
                      <FiFile className="h-3 w-3" /> App #{service?.application_number || '—'}
                    </span>
                    <span className="hidden md:flex items-center gap-1">
                      <FiClock className="h-3 w-3" /> Created{' '}
                      {formatDate(service?.created_at || service?.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {participants.length > 0 && (
                  <div className="hidden lg:flex items-center -space-x-1.5 mr-2">
                    {participants.slice(0, 4).map((p) => (
                      <Avatar key={p.staff_id} name={p.name} size="sm" className="ring-2 ring-white" />
                    ))}
                    {participants.length > 4 && (
                      <div className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-semibold flex items-center justify-center ring-2 ring-white">
                        +{participants.length - 4}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all duration-200 shadow-sm"
                >
                  <FiRefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                <PrimaryButton icon={FiPlus} onClick={() => setShowTaskModal(true)}>
                  <span className="hidden sm:inline">New Task</span>
                </PrimaryButton>
              </div>
            </div>

            {/* Tabs row */}
            <nav className="flex -mb-px overflow-x-auto mt-4 hide-scrollbar">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {tab.count !== null && tab.count > 0 && (
                      <span
                        className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center ${
                          isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* ══════════════════ CONTENT ══════════════════ */}
        <div className="max-w-[1600px] mx-auto px-6 py-8">
          {/* KPI strip (always visible across tabs) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KPIStat
              title="Total Tasks"
              value={stats.total}
              subtitle="In this workspace"
              trend={0}
              icon={FiBarChart2}
              color="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <KPIStat
              title="In Progress"
              value={stats.inProgress}
              subtitle="Active now"
              trend={0}
              icon={FiTrendingUp}
              color="bg-gradient-to-br from-amber-500 to-amber-600"
            />
            <KPIStat
              title="Completed"
              value={stats.completed}
              subtitle="Successfully done"
              trend={0}
              icon={FiCheckCircle}
              color="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <KPIStat
              title="Collaborators"
              value={participants.length}
              subtitle="Working on this"
              trend={0}
              icon={FiAward}
              color="bg-gradient-to-br from-purple-500 to-purple-600"
            />
          </div>

          <AnimatePresence mode="wait">
            {/* ══════ BOARD ══════ */}
            {activeTab === 'board' && (
              <motion.div
                key="board"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            {/* ══════ CHAT ══════ */}
            {activeTab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                style={{ height: 'calc(100vh - 420px)', minHeight: '500px' }}
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <SectionHeader
                    title="All Tasks"
                    subtitle={`${stats.completed} of ${stats.total} completed`}
                    action={
                      <PrimaryButton icon={FiPlus} onClick={() => setShowTaskModal(true)}>
                        New Task
                      </PrimaryButton>
                    }
                  />

                  {tasks.length === 0 ? (
                    <EmptyState
                      icon={FiCheckSquare}
                      title="No tasks yet"
                      description="Break this service down into tasks and assign them to your team."
                      action={
                        <PrimaryButton icon={FiPlus} onClick={() => setShowTaskModal(true)}>
                          Create your first task
                        </PrimaryButton>
                      }
                    />
                  ) : (
                    <div className="space-y-3">
                      {tasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onStatusUpdate={handleTaskStatusUpdate}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ══════ PARTICIPANTS ══════ */}
            {activeTab === 'participants' && (
              <motion.div
                key="participants"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <SectionHeader
                    title="Collaborators"
                    subtitle="People with access to this service workspace."
                    action={
                      <PrimaryButton icon={FiPlus} onClick={() => setShowParticipantModal(true)}>
                        Add Participant
                      </PrimaryButton>
                    }
                  />

                  {participants.length === 0 ? (
                    <EmptyState
                      icon={FiUsers}
                      title="No collaborators"
                      description="Invite team members to collaborate on this service."
                      action={
                        <PrimaryButton icon={FiPlus} onClick={() => setShowParticipantModal(true)}>
                          Add a participant
                        </PrimaryButton>
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {participants.map((p) => (
                        <div
                          key={p.staff_id}
                          className="group bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-md transition-all"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <Avatar name={p.name} size="lg" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {p.name}
                              </p>
                              <p className="text-xs text-gray-500 capitalize truncate mt-0.5">
                                {p.role} · {p.staff_role}
                              </p>
                            </div>
                          </div>
                          {p.staff_id !== service?.assignedToId && (
                            <button
                              onClick={() => handleRemoveParticipant(p.staff_id)}
                              title="Remove"
                              className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ══════ DOCUMENTS ══════ */}
            {activeTab === 'documents' && (
              <motion.div
                key="documents"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
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
                        <PrimaryButton
                          icon={FiUpload}
                          onClick={() => document.getElementById('doc-upload').click()}
                          disabled={uploadingDoc}
                        >
                          {uploadingDoc ? 'Uploading…' : 'Upload Document'}
                        </PrimaryButton>
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
                    <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="group flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="shrink-0 w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                              <FiFileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {doc.document_name}
                              </p>
                              <p className="text-xs text-gray-500 truncate mt-0.5">
                                {doc.uploaded_by_name || 'Staff'} ·{' '}
                                {new Date(doc.created_at).toLocaleDateString()}
                                {doc.file_size
                                  ? ` · ${(doc.file_size / 1024).toFixed(1)} KB`
                                  : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={`${API_BASE_URL}/api/files/version/${doc.id}/download?token=${token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Download"
                              className="p-2 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            >
                              <FiDownload className="h-4 w-4" />
                            </a>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              title="Delete"
                              className="p-2 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ══════════════════ MODALS ══════════════════ */}
        <AnimatePresence>
          {showParticipantModal && (
            <Modal
              title="Add Participant"
              onClose={() => setShowParticipantModal(false)}
              onSubmit={handleAddParticipant}
              submitLabel="Add Participant"
            >
              <div className="space-y-4">
                <FormField label="Staff Member" required>
                  <select
                    value={newParticipant.staffId}
                    onChange={(e) =>
                      setNewParticipant({ ...newParticipant, staffId: e.target.value })
                    }
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="">Select staff…</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role})
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Role" required>
                  <select
                    value={newParticipant.role}
                    onChange={(e) =>
                      setNewParticipant({ ...newParticipant, role: e.target.value })
                    }
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="collaborator">Collaborator</option>
                    <option value="reviewer">Reviewer</option>
                  </select>
                </FormField>
              </div>
            </Modal>
          )}

          {showTaskModal && (
            <Modal
              title="Create New Task"
              onClose={() => setShowTaskModal(false)}
              onSubmit={handleCreateTask}
              submitLabel="Create Task"
            >
              <div className="space-y-4">
                <FormField label="Title" required>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="e.g. Verify customer documents"
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </FormField>

                <FormField label="Description">
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    rows={3}
                    placeholder="Add any details the assignee should know…"
                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Assign To">
                    <select
                      value={newTask.assignedTo}
                      onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    >
                      <option value="">Unassigned</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Due Date">
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </FormField>
                </div>

                <FormField label="Priority">
                  <div className="grid grid-cols-3 gap-2">
                    {['low', 'medium', 'high'].map((p) => {
                      const active = newTask.priority === p;
                      const meta = PRIORITY_CONFIG[p];
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setNewTask({ ...newTask, priority: p })}
                          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-medium capitalize transition-all ${
                            active
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/20'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </FormField>
              </div>
            </Modal>
          )}
        </AnimatePresence>

        <style>{`
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </div>
    </WorkspaceErrorBoundary>
  );
};

/* ══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════════ */

const BoardColumn = ({ title, tasks, status, onTaskMove }) => {
  const meta = STATUS_CONFIG[status];
  const nextStatus =
    status === 'pending' ? 'in_progress' : status === 'in_progress' ? 'completed' : null;
  const nextLabel = status === 'pending' ? 'Start' : status === 'in_progress' ? 'Complete' : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-[420px]">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <span className="min-w-[24px] h-6 px-2 rounded-full bg-gray-100 text-xs font-semibold text-gray-600 flex items-center justify-center">
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2">
              <FiCheckSquare className="h-5 w-5" />
            </div>
            <p className="text-xs text-gray-400">No tasks</p>
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
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  return (
    <div className="group bg-gray-50 rounded-xl border border-gray-200 p-3.5 hover:shadow-md hover:border-gray-300 transition-all">
      <div className="flex items-start justify-between gap-2.5 mb-2">
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 flex-1">
          {task.title}
        </p>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-3 text-xs text-gray-500 min-w-0">
          {task.assigned_to_name && (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Avatar name={task.assigned_to_name} size="xs" />
              <span className="truncate max-w-[80px]">{task.assigned_to_name}</span>
            </span>
          )}
          {task.due_date && (
            <span className="inline-flex items-center gap-1 shrink-0">
              <FiCalendar className="h-3 w-3" />
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
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {nextLabel}
            <FiArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};

const TaskCard = ({ task, onStatusUpdate }) => {
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-gray-900">{task.title}</h3>
            <PriorityBadge priority={task.priority} />
          </div>

          {task.description && (
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{task.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-gray-500">
            {task.assigned_to_name && (
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={task.assigned_to_name} size="xs" />
                {task.assigned_to_name}
              </span>
            )}
            {task.due_date && (
              <span className="inline-flex items-center gap-1.5">
                <FiCalendar className="h-3 w-3" />
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
            className={`text-xs font-bold rounded-md px-2.5 py-1.5 border outline-none shadow-sm cursor-pointer transition-all ${status.bg} ${status.color} ${status.border}`}
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

/* ------------------------------ Modal ------------------------------ */
const FormField = ({ label, required, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const Modal = ({ title, children, onClose, onSubmit, submitLabel = 'Save' }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
    className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ y: 16, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 16, opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="bg-white rounded-xl w-full max-w-lg shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <FiX className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">{children}</div>

      <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          {submitLabel}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

export default ServiceWorkspace;