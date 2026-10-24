import React, { useState, useEffect, useMemo } from 'react';
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
  FiCalendar,
  FiArrowRight,
  FiRefreshCw,
  FiAlertCircle,
  FiFlag,
  FiCheckCircle,
  FiHash,
  FiPhone,
  FiRotateCcw,
  FiExternalLink,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Chat from '@/components/Chat';
import { useServiceChat } from '/src/hooks/useServiceChat';
import { socket } from '@/services/socket';
import { AppNoDisplay } from './tracking/ApplicationNumberField';

const API_BASE_URL = import.meta.env.VITE_API_URL;

/* ══════════════════════════════════════════════════════════════════
   ERROR BOUNDARY
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
            <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiAlertCircle className="h-7 w-7 text-rose-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-600 mb-5">The workspace could not load. Refresh the page to try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 text-sm font-semibold bg-[#172a45] text-white rounded-lg hover:bg-[#1e3a5f]"
            >
              Refresh page
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

const initials = (name) =>
  (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();


/** Same as TrackServicePage: API status -> label */
const TRACKING_STATUS = {
  pending: { label: 'Pending', bg: 'bg-amber-100', color: 'text-amber-800', border: 'border-amber-300', dot: 'bg-amber-600' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-100', color: 'text-blue-800', border: 'border-blue-300', dot: 'bg-blue-600' },
  completed: { label: 'Completed', bg: 'bg-emerald-100', color: 'text-emerald-800', border: 'border-emerald-300', dot: 'bg-emerald-600' },
  rejected: { label: 'Delayed', bg: 'bg-rose-100', color: 'text-rose-800', border: 'border-rose-300', dot: 'bg-rose-600' },
  resubmit: { label: 'Resubmit', bg: 'bg-orange-100', color: 'text-orange-800', border: 'border-orange-300', dot: 'bg-orange-600' },
  paid: { label: 'Paid', bg: 'bg-green-100', color: 'text-green-800', border: 'border-green-300', dot: 'bg-green-600' },
};

const PRIORITY_CONFIG = {
  high: { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-600', label: 'High' },
  medium: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Medium' },
  low: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-600', label: 'Low' },
};

/** Task statuses */
const STATUS_CONFIG = {
  pending: { color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', label: 'To do' },
  in_progress: { color: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-600', label: 'In progress' },
  completed: { color: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-600', label: 'Done' },
};
const TASK_STATUSES = ['pending', 'in_progress', 'completed'];

const todayKeyIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const dateKeyIST = (d) => {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};
const isTaskOverdue = (t) => t.due_date && t.status !== 'completed' && dateKeyIST(t.due_date) < todayKeyIST();
const shortDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

const fieldCls =
  'w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#172a45] focus:border-[#172a45]';

/* ══════════════════════════════════════════════════════════════════
   PRIMITIVES
   ══════════════════════════════════════════════════════════════════ */
const Avatar = ({ name, size = 'md', className = '' }) => {
  const sizes = { xs: 'w-5 h-5 text-[9px]', sm: 'w-7 h-7 text-[10px]', md: 'w-8 h-8 text-xs', lg: 'w-10 h-10 text-sm' };
  return (
    <div
      className={`${sizes[size]} shrink-0 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold ${className}`}
      title={name}
    >
      {initials(name)}
    </div>
  );
};

const PriorityBadge = ({ priority = 'medium' }) => {
  const p = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${p.bg} ${p.border} ${p.color}`}>
      <FiFlag className="h-3 w-3" /> {p.label}
    </span>
  );
};

const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="text-center py-14 px-6">
    {Icon && <Icon className="mx-auto h-9 w-9 text-gray-300 mb-3" />}
    <p className="text-sm font-semibold text-gray-900">{title}</p>
    {description && <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">{description}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

const SectionHeader = ({ title, subtitle, action }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
    <div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

const PrimaryButton = ({ icon: Icon, children, className = '', ...rest }) => (
  <button
    {...rest}
    className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-[#172a45] text-white rounded-lg hover:bg-[#1e3a5f] transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {Icon && <Icon className="h-4 w-4" />}
    {children}
  </button>
);

const SecondaryButton = ({ icon: Icon, children, className = '', ...rest }) => (
  <button
    {...rest}
    className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition ${className}`}
  >
    {Icon && <Icon className="h-4 w-4" />}
    {children}
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

  const [workspaceClosed, setWorkspaceClosed] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeConfirmText, setCloseConfirmText] = useState('');
  const [closing, setClosing] = useState(false);

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

        if (convRes.status === 410) {
          setWorkspaceClosed(true);
          return; // finally{} still clears loading
        }
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
    if (!socket || !serviceEntryId) return;

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
      toast.success(`Task moved to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
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

  const handleCloseWorkspace = async () => {
    if (!serviceEntryId || closeConfirmText !== 'CLOSE') return;
    setClosing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/servicecollaboration/${serviceEntryId}/close`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to close workspace');
      toast.success('Workspace closed');
      navigate('/dashboard/staff/track_service');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setClosing(false);
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

  const canCloseWorkspace =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'superadmin' ||
    participants.some(p => p.role === 'owner' && String(p.staff_id) === String(currentUser?.id));

  const navItems = useMemo(
    () => [
      { id: 'board', label: 'Board', icon: FiGrid, count: null },
      { id: 'chat', label: 'Chat', icon: FiMessageSquare, count: null },
      { id: 'tasks', label: 'Tasks', icon: FiCheckSquare, count: tasks.length },
      { id: 'participants', label: 'People', icon: FiUsers, count: participants.length },
      { id: 'documents', label: 'Files', icon: FiFileText, count: documents.length },
    ],
    [tasks.length, participants.length, documents.length]
  );


  /* ----------------------------- loading -------------------------- */
  const trackingPath = `/dashboard/staff/track_service/${service?.id || selectedServiceId}`;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#172a45] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (workspaceClosed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center shadow-sm">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiCheckCircle className="h-7 w-7 text-gray-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Workspace closed</h2>
          <p className="text-sm text-gray-600 mb-6">
            The chat and tasks for this service were removed when the workspace was closed.
            Service tracking and documents are still available.
          </p>
          <PrimaryButton icon={FiArrowLeft} onClick={() => navigate(trackingPath)}>
            Back to the application
          </PrimaryButton>
        </div>
      </div>
    );
  }

  const trackingStatus = TRACKING_STATUS[service?.status] || null;
  const overdueCount = tasks.filter(isTaskOverdue).length;

  /* ------------------------------ render -------------------------- */
  return (
    <WorkspaceErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-4">
          {/* Top bar: same as the single application page */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => navigate(trackingPath)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-[#172a45]"
            >
              <FiArrowLeft className="h-4 w-4" /> Back to the application
            </button>
            <SecondaryButton icon={FiRefreshCw} onClick={() => window.location.reload()}>
              <span className="hidden sm:inline">Refresh</span>
            </SecondaryButton>
          </div>

          {/* Header card: matches the tracking detail header */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[#172a45] text-white flex items-center justify-center flex-shrink-0">
                  <FiGrid className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-gray-900 truncate">{service?.customer_name || 'Workspace'}</h1>
                    {trackingStatus && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${trackingStatus.bg} ${trackingStatus.color} ${trackingStatus.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${trackingStatus.dot}`} /> {trackingStatus.label}
                      </span>
                    )}
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                      Workspace
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 font-medium">
                    {service?.service_name || 'Service'}
                    {service?.subcategory_name && service.subcategory_name !== 'N/A' && (
                      <span className="text-gray-500 font-normal"> · {service.subcategory_name}</span>
                    )}
                  </p>
                  <div className="flex items-center gap-x-4 gap-y-1 mt-2 flex-wrap text-xs text-gray-600">
                    <button
                      onClick={() => navigate(trackingPath)}
                      className="inline-flex items-center gap-1 font-mono font-semibold text-gray-800 hover:text-[#172a45]"
                      title="Open service tracking"
                    >
                      <FiHash className="h-3.5 w-3.5 text-[#172a45]" />TR-{service?.id}
                    </button>
                    <span className="inline-flex items-center gap-1 text-gray-800">
                      <span className="text-gray-500 whitespace-nowrap">App no.</span>
                      <AppNoDisplay value={service?.application_number} className="font-semibold" empty="Not added yet" />
                    </span>
                    {service?.phone && (
                      <a href={`tel:${service.phone}`} className="inline-flex items-center gap-1 hover:text-[#172a45]">
                        <FiPhone className="h-3.5 w-3.5" />{service.phone}
                      </a>
                    )}
                    {service?.estimated_delivery && (
                      <span className="inline-flex items-center gap-1">
                        <FiCalendar className="h-3.5 w-3.5" /> Due {shortDate(service.estimated_delivery)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                {participants.length > 0 && (
                  <button
                    onClick={() => setActiveTab('participants')}
                    className="hidden sm:flex items-center -space-x-1.5 mr-1"
                    title={participants.map((p) => p.name).join(', ')}
                  >
                    {participants.slice(0, 4).map((p) => (
                      <Avatar key={p.staff_id} name={p.name} size="sm" className="ring-2 ring-white" />
                    ))}
                    {participants.length > 4 && (
                      <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold flex items-center justify-center ring-2 ring-white">
                        +{participants.length - 4}
                      </span>
                    )}
                  </button>
                )}
                <PrimaryButton icon={FiPlus} onClick={() => setShowTaskModal(true)}>New task</PrimaryButton>
                {canCloseWorkspace && (
                  <button
                    onClick={() => { setCloseConfirmText(''); setShowCloseModal(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50"
                  >
                    <FiX className="h-4 w-4" /> Close workspace
                  </button>
                )}
              </div>
            </div>

            {/* Task progress: one line instead of four KPI cards */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs mb-2">
                <span className="text-sm font-semibold text-gray-900">
                  {stats.total === 0 ? 'No tasks yet' : `${stats.completed} of ${stats.total} tasks done`}
                </span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-600">
                  {TASK_STATUSES.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s].dot}`} />
                      {STATUS_CONFIG[s].label}
                      <span className="font-semibold text-gray-900 tabular-nums">{tasksByStatus[s].length}</span>
                    </span>
                  ))}
                  {overdueCount > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                      <FiAlertCircle className="h-3.5 w-3.5" /> {overdueCount} overdue
                    </span>
                  )}
                </span>
              </div>
              <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-100">
                {stats.total > 0 && TASK_STATUSES.slice().reverse().map((s) => (
                  <div
                    key={s}
                    className={`${STATUS_CONFIG[s].dot} h-full`}
                    style={{ width: `${(tasksByStatus[s].length / stats.total) * 100}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Tabs + content: same card + tab bar style as the tracking page */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <nav className="flex overflow-x-auto border-b border-gray-200 bg-gray-50/60 hide-scrollbar">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      isActive ? 'border-[#172a45] text-[#172a45] bg-white' : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <item.icon className="h-4 w-4" /> {item.label}
                    {item.count > 0 && (
                      <span className="ml-0.5 text-[10px] bg-gray-200 text-gray-700 px-1.5 rounded-full">{item.count}</span>
                    )}
                  </button>
                );
              })}
            </nav>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className={activeTab === 'chat' ? '' : 'p-5'}
              >
                {/* ══════ BOARD ══════ */}
                {activeTab === 'board' && (
                  tasks.length === 0 ? (
                    <EmptyState
                      icon={FiCheckSquare}
                      title="No tasks yet"
                      description="Break this service into tasks and assign them to your team."
                      action={<PrimaryButton icon={FiPlus} onClick={() => setShowTaskModal(true)}>Create the first task</PrimaryButton>}
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {TASK_STATUSES.map((s) => (
                        <BoardColumn key={s} status={s} tasks={tasksByStatus[s]} onTaskMove={handleTaskStatusUpdate} />
                      ))}
                    </div>
                  )
                )}

                {/* ══════ CHAT ══════ */}
                {activeTab === 'chat' && (
                  <div className="h-[calc(100vh-330px)] min-h-[480px]">
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
                )}

                {/* ══════ TASKS ══════ */}
                {activeTab === 'tasks' && (
                  <>
                    <SectionHeader
                      title="All tasks"
                      subtitle={`${stats.completed} of ${stats.total} done`}
                      action={<PrimaryButton icon={FiPlus} onClick={() => setShowTaskModal(true)}>New task</PrimaryButton>}
                    />
                    {tasks.length === 0 ? (
                      <EmptyState icon={FiCheckSquare} title="No tasks yet" description="Tasks you create here also show in Messenger → Tasks." />
                    ) : (
                      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                        {[...tasks]
                          .sort((a, b) => (a.status === 'completed') - (b.status === 'completed'))
                          .map((task) => (
                            <TaskRow key={task.id} task={task} onStatusUpdate={handleTaskStatusUpdate} />
                          ))}
                      </ul>
                    )}
                  </>
                )}

                {/* ══════ PARTICIPANTS ══════ */}
                {activeTab === 'participants' && (
                  <>
                    <SectionHeader
                      title="People"
                      subtitle="Staff who can see this workspace's chat and tasks."
                      action={<PrimaryButton icon={FiPlus} onClick={() => setShowParticipantModal(true)}>Add person</PrimaryButton>}
                    />
                    {participants.length === 0 ? (
                      <EmptyState icon={FiUsers} title="No one added yet" description="Add staff to work on this service together." />
                    ) : (
                      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                        {participants.map((p) => (
                          <li key={p.staff_id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={p.name} size="md" />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                                <p className="text-xs text-gray-500 capitalize truncate">
                                  {p.role}{p.staff_role ? ` · ${p.staff_role}` : ''}
                                </p>
                              </div>
                            </div>
                            {p.role !== 'owner' && String(p.staff_id) !== String(service?.assigned_to) && (
                              <button
                                onClick={() => handleRemoveParticipant(p.staff_id)}
                                className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-rose-700 hover:bg-rose-50"
                              >
                                <FiTrash2 className="h-3.5 w-3.5" /> Remove
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                {/* ══════ DOCUMENTS ══════ */}
                {activeTab === 'documents' && (
                  <>
                    <SectionHeader
                      title="Shared files"
                      subtitle="Internal files for staff. Customer documents are on the application's Documents tab."
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
                            {uploadingDoc ? 'Uploading…' : 'Upload file'}
                          </PrimaryButton>
                        </>
                      }
                    />
                    {documents.length === 0 ? (
                      <EmptyState icon={FiFileText} title="No files yet" description="Upload files to share them with everyone in this workspace." />
                    ) : (
                      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                        {documents.map((doc) => (
                          <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-[#172a45]">
                                <FiFileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{doc.document_name}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {doc.uploaded_by_name || 'Staff'} · {shortDate(doc.created_at)}
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
                                className="p-2 rounded-lg text-gray-500 hover:text-[#172a45] hover:bg-blue-50"
                              >
                                <FiDownload className="h-4 w-4" />
                              </a>
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                title="Delete"
                                className="p-2 rounded-lg text-gray-500 hover:text-rose-700 hover:bg-rose-50"
                              >
                                <FiTrash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ══════════════════ MODALS ══════════════════ */}
        <AnimatePresence>
          {showParticipantModal && (
            <Modal
              title="Add person"
              onClose={() => setShowParticipantModal(false)}
              onSubmit={handleAddParticipant}
              submitLabel="Add"
              submitDisabled={!newParticipant.staffId}
            >
              <div className="space-y-4">
                <FormField label="Staff member" required>
                  <select
                    value={newParticipant.staffId}
                    onChange={(e) => setNewParticipant({ ...newParticipant, staffId: e.target.value })}
                    className={fieldCls}
                  >
                    <option value="">Select staff…</option>
                    {staffList
                      .filter((s) => !participants.some((p) => String(p.staff_id) === String(s.id)))
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                      ))}
                  </select>
                </FormField>
                <FormField label="Role" required>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    {[{ v: 'collaborator', l: 'Collaborator' }, { v: 'reviewer', l: 'Reviewer' }].map((r) => (
                      <button
                        key={r.v}
                        type="button"
                        onClick={() => setNewParticipant({ ...newParticipant, role: r.v })}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${
                          newParticipant.role === r.v ? 'bg-white shadow-sm text-[#172a45]' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {r.l}
                      </button>
                    ))}
                  </div>
                </FormField>
              </div>
            </Modal>
          )}

          {showTaskModal && (
            <Modal
              title="New task"
              onClose={() => setShowTaskModal(false)}
              onSubmit={handleCreateTask}
              submitLabel="Create task"
              submitDisabled={!newTask.title.trim()}
            >
              <div className="space-y-4">
                <FormField label="Title" required>
                  <input
                    type="text"
                    autoFocus
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="e.g. Verify customer documents"
                    className={fieldCls}
                  />
                </FormField>
                <FormField label="Description">
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    rows={3}
                    placeholder="Anything the assignee should know"
                    className={`${fieldCls} resize-none`}
                  />
                </FormField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Assign to">
                    <select
                      value={newTask.assignedTo}
                      onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                      className={fieldCls}
                    >
                      <option value="">Unassigned</option>
                      {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Due date">
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      className={fieldCls}
                    />
                  </FormField>
                </div>
                <FormField label="Priority">
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    {['low', 'medium', 'high'].map((p) => {
                      const active = newTask.priority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setNewTask({ ...newTask, priority: p })}
                          className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${
                            active ? `bg-white shadow-sm ${PRIORITY_CONFIG[p].color}` : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {PRIORITY_CONFIG[p].label}
                        </button>
                      );
                    })}
                  </div>
                </FormField>
              </div>
            </Modal>
          )}

          {showCloseModal && (
            <Modal
              title="Close workspace"
              onClose={() => !closing && setShowCloseModal(false)}
              onSubmit={handleCloseWorkspace}
              submitLabel={closing ? 'Closing…' : 'Close permanently'}
              submitDisabled={closing || closeConfirmText !== 'CLOSE'}
              danger
            >
              <div className="space-y-4">
                <div className="flex gap-3 p-3 rounded-lg bg-rose-50 border border-rose-200">
                  <FiAlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-rose-800">
                    <p className="font-semibold mb-1">This cannot be undone.</p>
                    <p>
                      All chat messages, chat files, {stats.total} task{stats.total === 1 ? '' : 's'} and the people list
                      will be permanently deleted. Pending scheduled staff reminders are cancelled. Service tracking and
                      customer documents are kept.
                    </p>
                  </div>
                </div>
                <FormField label='Type "CLOSE" to confirm' required>
                  <input
                    type="text"
                    value={closeConfirmText}
                    onChange={(e) => setCloseConfirmText(e.target.value)}
                    placeholder="CLOSE"
                    className={`${fieldCls} focus:ring-rose-500 focus:border-rose-500`}
                  />
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

// Move buttons are always visible (hover-only buttons don't work on touch screens)
const MOVES = {
  pending: [{ to: 'in_progress', label: 'Start', icon: FiArrowRight }],
  in_progress: [
    { to: 'pending', label: 'Back', icon: FiRotateCcw, subtle: true },
    { to: 'completed', label: 'Done', icon: FiCheckCircle },
  ],
  completed: [{ to: 'in_progress', label: 'Reopen', icon: FiRotateCcw, subtle: true }],
};

const BoardColumn = ({ status, tasks, onTaskMove }) => {
  const meta = STATUS_CONFIG[status];
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 flex flex-col md:min-h-[260px]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <span className={`w-2 h-2 rounded-full ${meta.dot}`} /> {meta.label}
        </span>
        <span className="text-xs font-semibold text-gray-500 tabular-nums">{tasks.length}</span>
      </div>
      <div className="flex-1 p-2.5 space-y-2.5">
        {tasks.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">Nothing here</p>
        ) : (
          tasks.map((task) => <BoardTaskCard key={task.id} task={task} onMove={onTaskMove} />)
        )}
      </div>
    </div>
  );
};

const BoardTaskCard = ({ task, onMove }) => {
  const overdue = isTaskOverdue(task);
  const done = task.status === 'completed';
  return (
    <div className={`bg-white rounded-lg border p-3 shadow-sm ${overdue ? 'border-rose-200' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-semibold leading-snug line-clamp-2 ${done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
          {task.title}
        </p>
        <PriorityBadge priority={task.priority} />
      </div>
      {task.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>}

      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-gray-100">
        <div className="flex items-center gap-2.5 text-[11px] text-gray-500 min-w-0">
          <span className="inline-flex items-center gap-1 min-w-0">
            <Avatar name={task.assigned_to_name || '?'} size="xs" />
            <span className="truncate max-w-[90px]">{task.assigned_to_name || 'Unassigned'}</span>
          </span>
          {task.due_date && (
            <span className={`inline-flex items-center gap-1 shrink-0 ${overdue ? 'text-rose-700 font-semibold' : ''}`}>
              <FiCalendar className="h-3 w-3" />
              {overdue ? 'Overdue ' : ''}{shortDate(task.due_date)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {MOVES[task.status]?.map((m) => (
            <button
              key={m.to}
              onClick={() => onMove(task.id, m.to).catch(() => {})}
              title={m.label}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition ${
                m.subtle ? 'text-gray-500 hover:bg-gray-100' : 'text-[#172a45] bg-blue-50 hover:bg-blue-100'
              }`}
            >
              <m.icon className="h-3 w-3" /> {m.subtle ? '' : m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const TaskRow = ({ task, onStatusUpdate }) => {
  const overdue = isTaskOverdue(task);
  const done = task.status === 'completed';
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{task.title}</p>
          <PriorityBadge priority={task.priority} />
          {overdue && <span className="text-[11px] font-semibold text-rose-700">Overdue</span>}
        </div>
        {task.description && <p className="text-xs text-gray-600 mt-0.5">{task.description}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={task.assigned_to_name || '?'} size="xs" />
            {task.assigned_to_name || 'Unassigned'}
          </span>
          {task.due_date && (
            <span className={`inline-flex items-center gap-1 ${overdue ? 'text-rose-700 font-semibold' : ''}`}>
              <FiCalendar className="h-3 w-3" />
              {new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
            </span>
          )}
        </div>
      </div>
      {/* Status: one click, same pattern as the tracking page's priority switch */}
      <div className="flex bg-gray-100 p-1 rounded-lg shrink-0 self-start sm:self-center">
        {TASK_STATUSES.map((s) => {
          const active = task.status === s;
          return (
            <button
              key={s}
              onClick={() => !active && onStatusUpdate(task.id, s).catch(() => {})}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                active ? `bg-white shadow-sm ${STATUS_CONFIG[s].color}` : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {STATUS_CONFIG[s].label}
            </button>
          );
        })}
      </div>
    </li>
  );
};

/* ------------------------------ Modal ------------------------------ */
const FormField = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1.5">
      {label}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const Modal = ({ title, children, onClose, onSubmit, submitLabel = 'Save', submitDisabled = false, danger = false }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
    className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 12, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="bg-white rounded-xl w-full max-w-lg shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close">
          <FiX className="h-4 w-4 text-gray-500" />
        </button>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (!submitDisabled) onSubmit(); }}
      >
        <div className="px-5 py-4 max-h-[65vh] overflow-y-auto">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitDisabled}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#172a45] hover:bg-[#1e3a5f]'
            }`}
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </motion.div>
  </motion.div>
);

export default ServiceWorkspace;