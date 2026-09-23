import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  FiUser, FiPhone, FiClock, FiCheckCircle, FiAlertCircle, 
  FiRefreshCw, FiSearch, FiEdit, FiMessageSquare, FiChevronDown, 
  FiFileText, FiBarChart2, FiDollarSign, FiCalendar,
  FiTrendingUp, FiMail, FiDownload, FiFilter, FiMoreHorizontal,
  FiPrinter, FiAward, FiTarget, FiPlus, FiGrid, FiCreditCard, FiFlag,
  FiArrowLeft, FiMessageCircle, FiUpload, FiTrash2, FiEye, FiEyeOff,
  FiPaperclip, FiX, FiCommand, FiChevronRight, FiChevronLeft,
  FiExternalLink, FiSliders, FiSend, FiCheck, FiInbox, FiLayers,
  FiActivity, FiSave, FiStar, FiCopy, FiZap
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  getTrackingEntries, 
  getTrackingEntryById,
  updateTrackingEntry, 
  updateTrackingStatus, 
  notifyCustomer, 
  getStaff, 
  getCategories, 
  getServiceEntries,
  getTrackingStats, 
  getTrackingActivity,
  getTrackingDocuments,
  uploadTrackingDocument,
  toggleTrackingDocumentVisibility,
  deleteTrackingDocument
} from '/src/services/serviceService';
import { useParams, useNavigate } from 'react-router-dom';
import NotesPanel from '/src/components/notes/NotesPanel';

/* ============================================================
   CONSTANTS
   ============================================================ */

const STATUS_MAP = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  rejected: 'Delayed',
  resubmit: 'Resubmit',
  paid: 'Paid'
};

const REVERSE_STATUS_MAP = {
  Pending: 'pending',
  'In Progress': 'in_progress',
  Completed: 'completed',
  Delayed: 'rejected',
  Resubmit: 'resubmit',
  Paid: 'paid'
};

const STATUS_CONFIG = {
  Pending: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  'In Progress': { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' },
  Delayed: { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' },
  Completed: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  Resubmit: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' },
  Paid: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500' }
};

const PRIORITY_CONFIG = {
  low: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Low' },
  medium: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Medium' },
  high: { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', label: 'High' }
};

const PAYMENT_STATUS_CONFIG = {
  'Not Applicable': { color: 'text-slate-600', bg: 'bg-slate-100' },
  Received: { color: 'text-emerald-700', bg: 'bg-emerald-50' },
  Partial: { color: 'text-amber-700', bg: 'bg-amber-50' },
  Pending: { color: 'text-rose-700', bg: 'bg-rose-50' },
  Processing: { color: 'text-blue-700', bg: 'bg-blue-50' }
};

const STEP_OPTIONS = [
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Initial Review', label: 'Initial Review' },
  { value: 'Document Verification', label: 'Document Verification' },
  { value: 'Final Approval', label: 'Final Approval' }
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
];

const STEP_ORDER_MAP = { Submitted: 1, 'Initial Review': 2, 'Document Verification': 3, 'Final Approval': 4 };

/* ============================================================
   UTILITIES
   ============================================================ */

const formatDate = (dateString) => {
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return 'Invalid date'; }
};

const formatTimelineDate = (dateString) => {
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).format(date);
  } catch { return 'Invalid date'; }
};

const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch { return ''; }
};

const calculateProgress = (status, currentStep) => {
  const stepProgress = { Submitted: 25, 'Initial Review': 50, 'Document Verification': 75, 'Final Approval': 100 };
  if (status === 'Completed' || status === 'Paid') return 100;
  return stepProgress[currentStep] || 25;
};

/* ============================================================
   ERROR BOUNDARY
   ============================================================ */

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('Error caught by boundary:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-md text-center">
            <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiAlertCircle className="h-7 w-7 text-rose-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-600 mb-4">There was an error loading the page.</p>
            <button onClick={() => window.location.reload()} className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ============================================================
   SHARED SMALL COMPONENTS
   ============================================================ */

const StatusPill = ({ status, size = 'sm' }) => {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.Pending;
  const padding = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center gap-1 ${padding} rounded-full font-medium ${c.bg} ${c.color} border ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {status}
    </span>
  );
};

const PriorityPill = ({ priority }) => {
  const c = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${c.bg} ${c.color} border ${c.border}`}>
      <FiFlag className="h-2.5 w-2.5" />
      {c.label}
    </span>
  );
};

const FilterChip = ({ active, onClick, children, dot }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-all whitespace-nowrap ${
      active
        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
    }`}
  >
    {dot && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : dot}`} />}
    {children}
  </button>
);

const IconButton = ({ icon: Icon, onClick, tooltip, variant = 'default', className = '' }) => {
  const styles = {
    default: 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 bg-white',
    primary: 'text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 shadow-sm',
    ghost: 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-transparent'
  };
  return (
    <button onClick={onClick} title={tooltip}
      className={`p-2 rounded-lg transition-all ${styles[variant]} ${className}`}>
      <Icon className="h-4 w-4" />
    </button>
  );
};

const MiniStat = ({ label, value, icon: Icon, color = 'indigo' }) => {
  const colors = {
    indigo: 'text-indigo-600 bg-indigo-50',
    blue: 'text-blue-600 bg-blue-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    rose: 'text-rose-600 bg-rose-50',
    violet: 'text-violet-600 bg-violet-50',
    amber: 'text-amber-600 bg-amber-50'
  };
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-slate-200">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</p>
        <p className="text-base font-bold text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, message, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
      <Icon className="h-7 w-7 text-slate-400" />
    </div>
    <p className="text-sm font-semibold text-slate-900 mb-1">{title}</p>
    <p className="text-xs text-slate-500 max-w-xs">{message}</p>
    {action}
  </div>
);

const Stars = ({ value }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <FiStar key={i} className={`h-3.5 w-3.5 ${i <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
    ))}
    <span className="text-xs text-slate-500 ml-1.5">({value}/5)</span>
  </div>
);

/* ============================================================
   INLINE EDITABLE ROW
   ============================================================ */

const EditableRow = ({ label, value, displayValue, type = 'text', options, placeholder, multiline, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value ?? '');
  const inputRef = useRef(null);

  useEffect(() => { setTemp(value ?? ''); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = () => {
    if (temp !== value) onSave(temp);
    setEditing(false);
  };
  const cancel = () => { setTemp(value ?? ''); setEditing(false); };
  const onKey = (e) => {
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') cancel();
  };

  const displayText = displayValue !== undefined ? displayValue : (value || null);

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 group transition-colors">
      <span className="text-xs text-slate-500 flex-shrink-0 pt-1">{label}</span>
      {editing ? (
        options ? (
          <select ref={inputRef} value={temp} onChange={e => setTemp(e.target.value)}
            onBlur={commit} onKeyDown={onKey}
            className="text-sm bg-white border border-indigo-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none min-w-[140px]">
            <option value="">— None —</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : multiline ? (
          <textarea ref={inputRef} value={temp} onChange={e => setTemp(e.target.value)}
            onBlur={commit} onKeyDown={onKey} rows={3}
            className="text-sm bg-white border border-indigo-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none w-64 resize-none" />
        ) : (
          <input ref={inputRef} type={type} value={temp} onChange={e => setTemp(e.target.value)}
            onBlur={commit} onKeyDown={onKey}
            className="text-sm bg-white border border-indigo-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none w-48 text-right" />
        )
      ) : (
        <button onClick={() => setEditing(true)}
          className="text-sm font-medium text-slate-800 px-2 py-1 rounded-md hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-1.5 max-w-[280px] text-right group-hover:bg-indigo-50/60">
          <span className="truncate">{displayText || <span className="text-slate-400 italic">{placeholder || '—'}</span>}</span>
          <FiEdit className="h-3 w-3 opacity-0 group-hover:opacity-60 flex-shrink-0" />
        </button>
      )}
    </div>
  );
};

/* ============================================================
   COMMAND PALETTE
   ============================================================ */

const CommandPalette = ({ open, onClose, services, onSelect, onAction }) => {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQuery(''); setIndex(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? services.filter(s =>
          s.customerName?.toLowerCase().includes(q) ||
          s.phone?.toString().includes(q) ||
          s.applicationNumber?.toLowerCase().includes(q) ||
          s.aadhaar?.toString().includes(q) ||
          s.serviceType?.toLowerCase().includes(q) ||
          s.assignedTo?.toLowerCase().includes(q)
        )
      : services;
    return filtered.slice(0, 12);
  }, [query, services]);

  const quickActions = useMemo(() => [
    { id: 'excel', label: 'Export to Excel', icon: FiDownload, run: () => onAction('excel') },
    { id: 'pdf', label: 'Export to PDF', icon: FiFileText, run: () => onAction('pdf') },
    { id: 'refresh', label: 'Refresh Data', icon: FiRefreshCw, run: () => onAction('refresh') },
    { id: 'pending', label: 'Filter: Pending', icon: FiClock, run: () => onAction('filter:pending') },
    { id: 'progress', label: 'Filter: In Progress', icon: FiActivity, run: () => onAction('filter:in_progress') },
    { id: 'completed', label: 'Filter: Completed', icon: FiCheckCircle, run: () => onAction('filter:completed') }
  ], [onAction]);

  const showingActions = !query.trim();

  useEffect(() => { setIndex(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, (showingActions ? quickActions : results).length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (showingActions) {
          quickActions[index]?.run(); onClose();
        } else if (results[index]) {
          onSelect(results[index]); onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, index, results, quickActions, showingActions, onClose, onSelect]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] bg-slate-900/40 backdrop-blur-sm px-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.15 }}
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 border-b border-slate-100">
          <FiSearch className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search services, jump to anything…"
            className="flex-1 py-3.5 text-sm bg-transparent outline-none placeholder:text-slate-400" />
          <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-100 rounded font-mono text-slate-500">ESC</kbd>
        </div>
        <div className="max-h-[380px] overflow-y-auto py-2">
          {showingActions ? (
            <div>
              <p className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-medium">Quick Actions</p>
              {quickActions.map((a, i) => (
                <button key={a.id}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => { a.run(); onClose(); }}
                  className={`w-[calc(100%-16px)] mx-2 text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${
                    i === index ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}>
                  <a.icon className={`h-4 w-4 ${i === index ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span className="text-sm text-slate-700">{a.label}</span>
                </button>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">No results found for "{query}"</div>
          ) : (
            <div>
              <p className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                Services ({results.length})
              </p>
              {results.map((s, i) => (
                <button key={s.id}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => { onSelect(s); onClose(); }}
                  className={`w-[calc(100%-16px)] mx-2 text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${
                    i === index ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${i === index ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                    <FiUser className={`h-4 w-4 ${i === index ? 'text-indigo-600' : 'text-slate-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">{s.customerName}</span>
                      {s.applicationNumber && <span className="text-[10px] text-slate-400 font-mono truncate">{s.applicationNumber}</span>}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{s.serviceType} · {s.phone}</div>
                  </div>
                  <StatusPill status={s.status} size="xs" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-slate-600">↑↓</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-slate-600">↵</kbd> Select</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* ============================================================
   FILTERS MODAL
   ============================================================ */

const FiltersModal = ({ open, onClose, staffList, categories, availableSubcategories, filters, setFilters, onClear }) => {
  if (!open) return null;

  const update = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const fieldClass = "w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500";
  const labelClass = "block text-xs font-medium text-slate-600 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.2 }}
        className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FiSliders className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Advanced Filters</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className={labelClass}>Time Range</label>
            <select value={filters.timeRange} onChange={e => update('timeRange', e.target.value)} className={fieldClass}>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Specific Date</label>
            <input type="date" value={filters.dateFilter} onChange={e => update('dateFilter', e.target.value)} className={fieldClass} />
          </div>

          <div>
            <label className={labelClass}>Service Category</label>
            <select value={filters.serviceFilter} onChange={e => { update('serviceFilter', e.target.value); update('subcategoryFilter', 'all'); }} className={fieldClass}>
              <option value="all">All Services</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Subcategory</label>
            <select value={filters.subcategoryFilter} onChange={e => update('subcategoryFilter', e.target.value)}
              disabled={filters.serviceFilter === 'all'}
              className={`${fieldClass} ${filters.serviceFilter === 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <option value="all">{filters.serviceFilter === 'all' ? 'Select a category first' : 'All Subcategories'}</option>
              {availableSubcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Assigned Staff</label>
            <select value={filters.staffFilter} onChange={e => update('staffFilter', e.target.value)} className={fieldClass}>
              <option value="all">Everyone</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Timeline</label>
            <select value={filters.expiryFilter} onChange={e => update('expiryFilter', e.target.value)} className={fieldClass}>
              <option value="all">Any Timeline</option>
              <option value="upcoming">Upcoming Expiry</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Aadhaar Number</label>
            <div className="relative">
              <FiCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input type="text" maxLength={12} placeholder="Enter 12-digit Aadhaar"
                value={filters.aadhaarSearch} onChange={e => update('aadhaarSearch', e.target.value)}
                className={`${fieldClass} pl-10`} />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex items-center gap-2 bg-slate-50">
          <button onClick={onClear}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100">
            Clear All
          </button>
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
            Apply
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ============================================================
   SERVICE LIST ITEM
   ============================================================ */

const ServiceListItem = ({ service, selected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-3 border-l-[3px] transition-all ${
      selected
        ? 'border-l-indigo-600 bg-indigo-50/70'
        : 'border-l-transparent hover:border-l-slate-300 hover:bg-slate-50'
    }`}
  >
    <div className="flex items-start justify-between gap-2 mb-1.5">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0">
          <FiUser className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 truncate">{service.customerName}</p>
          <p className="text-[11px] text-slate-500 truncate">{service.phone}</p>
        </div>
      </div>
      <StatusPill status={service.status} size="xs" />
    </div>
    <div className="flex items-center gap-1.5 mb-1.5 pl-9">
      <span className="text-xs text-slate-700 font-medium truncate">{service.serviceType}</span>
      {service.subcategoryName && service.subcategoryName !== 'N/A' && (
        <>
          <span className="text-slate-300">·</span>
          <span className="text-[11px] text-slate-500 truncate">{service.subcategoryName}</span>
        </>
      )}
    </div>
    <div className="flex items-center justify-between pl-9">
      <div className="flex items-center gap-1.5">
        <PriorityPill priority={service.priority} />
        {service.workSource === 'online' ? (
          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">Online</span>
        ) : (
          <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-1.5 py-0.5">Walk-in</span>
        )}
      </div>
      {service.applicationNumber && (
        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[100px]">{service.applicationNumber}</span>
      )}
    </div>
  </button>
);

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

const TrackServicePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [categories, setCategories] = useState([]);

  const [activityHistory, setActivityHistory] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');
  const [commandOpen, setCommandOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const getSavedFilters = () => {
    try {
      const saved = localStorage.getItem('staffServiceSavedView');
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error(e); }
    return { status: 'all', staff: 'all', expiry: 'all', date: '', service: 'all', subcategory: 'all' };
  };

  const initialFilters = getSavedFilters();

  const [searchTerm, setSearchTerm] = useState('');
  const [aadhaarSearch, setAadhaarSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [staffFilter, setStaffFilter] = useState(initialFilters.staff);
  const [expiryFilter, setExpiryFilter] = useState(initialFilters.expiry);
  const [dateFilter, setDateFilter] = useState(initialFilters.date || '');
  const [serviceFilter, setServiceFilter] = useState(initialFilters.service || 'all');
  const [subcategoryFilter, setSubcategoryFilter] = useState(initialFilters.subcategory || 'all');
  const [timeRange, setTimeRange] = useState('month');

  const [discoveredSubcategories, setDiscoveredSubcategories] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 50;

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedAadhaar, setDebouncedAadhaar] = useState('');

  const [globalStats, setGlobalStats] = useState({ total: 0, completed: 0, in_progress: 0, delayed: 0, pending: 0, sla_compliance: 100 });

  /* ---------------- Keyboard shortcut: Cmd/Ctrl + K ---------------- */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ---------------- Debounce search ---------------- */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAadhaar(aadhaarSearch), 400);
    return () => clearTimeout(t);
  }, [aadhaarSearch]);

  useEffect(() => { setCurrentPage(1); },
    [debouncedSearch, debouncedAadhaar, statusFilter, staffFilter, expiryFilter, timeRange, dateFilter, serviceFilter, subcategoryFilter]);

  /* ---------------- Discover subcategories ---------------- */
  useEffect(() => {
    setDiscoveredSubcategories(prev => {
      const next = { ...prev };
      services.forEach(s => {
        if (s.categoryId && s.subcategoryId) {
          if (!next[s.categoryId]) next[s.categoryId] = new Map();
          next[s.categoryId].set(s.subcategoryId, s.subcategoryName);
        }
      });
      return next;
    });
  }, [services]);

  const availableSubcategories = useMemo(() => {
    if (serviceFilter === 'all') return [];
    const selectedCat = categories.find(c => c.id.toString() === serviceFilter.toString());
    if (selectedCat && selectedCat.subcategories) return selectedCat.subcategories;
    if (discoveredSubcategories[serviceFilter]) {
      return Array.from(discoveredSubcategories[serviceFilter], ([id, name]) => ({ id, name }));
    }
    return [];
  }, [serviceFilter, categories, discoveredSubcategories]);

  /* ---------------- Transform backend data ---------------- */
  const transformBackendData = useCallback((trackingData) => trackingData.map((entry) => {
    const totalCharge = parseFloat(entry.total_charges || 0);
    const totalReceived = parseFloat(entry.total_received || 0);
    const payments = entry.payment_details_array || [];

    let paymentStatus = 'Pending';
    if (totalCharge <= 0) paymentStatus = 'Not Applicable';
    else if (totalReceived >= totalCharge) paymentStatus = 'Received';
    else if (totalReceived > 0) paymentStatus = 'Partial';

    const paymentDetailsStr = payments.length > 0
      ? payments.map(p => `${p.method === 'cash' ? 'Cash' : p.method === 'digital_wallet' ? 'Digital Wallet' : p.method}: ₹${Number(p.amount).toFixed(2)} (${p.status})`).join(', ')
      : 'No payments recorded';

    const createdDate = new Date(entry.created_at || entry.updated_at || Date.now());
    const dateStr = createdDate.toISOString().split('T')[0];
    const updatedDate = new Date(entry.updated_at || Date.now());
    const timeStr = updatedDate.toTimeString().split(' ')[0].substring(0, 5);

    const calculatedProgress = entry.progress || calculateProgress(STATUS_MAP[entry.status] || 'Pending', entry.current_step || 'Submitted');
    const workSource = entry.work_source || (entry.customer_service_id ? 'online' : 'offline');

    return {
      id: entry.id.toString(),
      serviceEntryId: entry.service_entry_id?.toString(),
      trackingId: `TR-${entry.id}`,
      applicationNumber: entry.application_number || `APP${entry.service_entry_id}`,
      customerName: entry.customer_name || 'Unknown',
      customerPhone: entry.phone || 'N/A',
      serviceType: entry.service_name || 'Unknown',
      subcategoryName: entry.subcategory_name || 'N/A',
      categoryId: entry.category_id,
      subcategoryId: entry.subcategory_id,
      staffName: entry.assigned_to_name || 'Unassigned',
      assignedTo: entry.assigned_to_name || 'Unassigned',
      assignedToId: entry.assigned_to,
      serviceCharge: parseFloat(entry.service_charges) || 0,
      departmentCharge: parseFloat(entry.department_charges) || 0,
      totalCharge,
      cost: totalCharge,
      status: STATUS_MAP[entry.status] || 'Pending',
      currentStep: entry.current_step || 'Submitted',
      progress: calculatedProgress,
      priority: entry.priority || 'medium',
      date: dateStr,
      time: timeStr,
      estimatedDelivery: entry.estimated_delivery && !isNaN(new Date(entry.estimated_delivery)) ? formatDate(entry.estimated_delivery) : 'Not set',
      expiryDate: entry.expiry_date && !isNaN(new Date(entry.expiry_date)) ? new Date(entry.expiry_date).toISOString() : 'N/A',
      createdAt: entry.created_at || entry.updated_at,
      updatedAt: entry.updated_at,
      notes: entry.notes || '',
      followUpRequired: entry.status === 'rejected' || entry.status === 'resubmit',
      paymentStatus,
      paymentDetails: paymentDetailsStr,
      payments,
      phone: entry.phone || 'N/A',
      email: entry.email || '',
      aadhaar: entry.aadhaar || '',
      steps: Array.isArray(entry.steps) ? entry.steps.map(step => ({
        id: step.id, name: step.name, completed: step.completed, date: step.date,
        created_at: step.created_at, step_order: step.step_order, estimated_days: step.estimated_days
      })) : [],
      averageTime: entry.average_time || '7 days',
      rawEstimatedDelivery: entry.estimated_delivery,
      rawExpiryDate: entry.expiry_date,
      workSource,
      serviceRating: entry.service_rating,
      staffRating: entry.staff_rating,
      reviewText: entry.review_text,
      reviewSubmittedAt: entry.submitted_at
    };
  }), []);

  /* ---------------- Fetchers ---------------- */
  const fetchStats = async () => {
    const apiStatus = REVERSE_STATUS_MAP[statusFilter] || statusFilter;
    const data = await getTrackingStats({
      timeRange: timeRange === 'all' ? undefined : timeRange,
      date: dateFilter || undefined,
      service: serviceFilter === 'all' ? undefined : serviceFilter,
      subcategory: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
      status: statusFilter === 'all' ? undefined : apiStatus,
      staff: staffFilter === 'all' ? undefined : staffFilter
    });
    setGlobalStats(data);
  };

  const fetchActivityHistory = async (trackingId) => {
    if (!trackingId) { setActivityHistory([]); return; }
    try {
      setActivityLoading(true);
      const response = await getTrackingActivity(trackingId);
      setActivityHistory(Array.isArray(response?.activities) ? response.activities : []);
    } catch (err) {
      console.error(err);
      setActivityHistory([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const fetchDocuments = async (trackingId) => {
    if (!trackingId) { setDocuments([]); return; }
    try {
      setDocumentsLoading(true);
      const data = await getTrackingDocuments(trackingId);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const fetchAllTrackingEntries = async () => {
    try {
      const apiStatus = REVERSE_STATUS_MAP[statusFilter] || statusFilter;
      const params = {
        page: currentPage, limit,
        timeRange: timeRange === 'all' ? undefined : timeRange,
        date: dateFilter || undefined,
        service: serviceFilter === 'all' ? undefined : serviceFilter,
        categoryId: serviceFilter === 'all' ? undefined : serviceFilter,
        subcategory: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
        subcategoryId: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
        status: statusFilter === 'all' ? undefined : apiStatus,
        staff: staffFilter === 'all' ? undefined : staffFilter,
        expiry: expiryFilter === 'all' ? undefined : expiryFilter,
        search: debouncedSearch || undefined,
        aadhaar: debouncedAadhaar || undefined
      };

      const [trackingRes, staffRes, categoriesRes] = await Promise.all([
        getTrackingEntries(params), getStaff(), getCategories()
      ]);

      if (trackingRes?.pagination) {
        setTotalRecords(trackingRes.pagination.totalRecords);
        setTotalPages(trackingRes.pagination.totalPages);
      }

      const trackingData = Array.isArray(trackingRes?.data) ? trackingRes.data : Array.isArray(trackingRes) ? trackingRes : [];
      const staffData = Array.isArray(staffRes?.data) ? staffRes.data : Array.isArray(staffRes) ? staffRes : [];
      const categoriesData = Array.isArray(categoriesRes?.data) ? categoriesRes.data : Array.isArray(categoriesRes) ? categoriesRes : [];

      setStaffList(staffData);
      setCategories(categoriesData);

      let transformed = transformBackendData(trackingData);

      if (serviceFilter !== 'all') transformed = transformed.filter(s => String(s.categoryId) === String(serviceFilter));
      if (subcategoryFilter !== 'all') transformed = transformed.filter(s => String(s.subcategoryId) === String(subcategoryFilter));

      setServices(transformed);
      return transformed;
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to fetch data');
      setStaffList([]);
      setCategories([]);
      return [];
    }
  };

  /* ---------------- Initial load ---------------- */
  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      try {
        const [transformed] = await Promise.all([fetchAllTrackingEntries(), fetchStats()]);
        if (id && transformed) {
          const found = transformed.find(s => s.id === id);
          if (found) await handleServiceSelect(found, true);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Filter reload ---------------- */
  useEffect(() => {
    const reload = async () => {
      try { await Promise.all([fetchAllTrackingEntries(), fetchStats()]); }
      catch (err) { console.error(err); }
    };
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch, debouncedAadhaar, statusFilter, staffFilter, expiryFilter, timeRange, dateFilter, serviceFilter, subcategoryFilter]);

  /* ---------------- Handlers ---------------- */
  const handleServiceSelect = async (service, preventNav = false) => {
    setSelectedService(service);
    setActiveTab('overview');
    await Promise.all([fetchActivityHistory(service.id), fetchDocuments(service.id)]);
    if (!preventNav) navigate(`/dashboard/staff/track_service/${service.id}`, { replace: true });
  };

  const handleUpdateStatus = async (serviceId, newStatus) => {
    try {
      const apiStatus = REVERSE_STATUS_MAP[newStatus] || newStatus;
      const service = services.find(s => s.id === serviceId);
      const newProgress = calculateProgress(newStatus, service?.currentStep);

      setServices(prev => prev.map(s => s.id === serviceId ? { ...s, status: newStatus, progress: newProgress } : s));
      if (selectedService?.id === serviceId) setSelectedService(prev => ({ ...prev, status: newStatus, progress: newProgress }));

      await updateTrackingStatus(serviceId, apiStatus);
      await fetchActivityHistory(serviceId);
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    }
  };

  const handleInlineTrackingUpdate = async (service, updates) => {
    try {
      const payload = {
        applicationNumber: updates.applicationNumber !== undefined ? updates.applicationNumber : service.applicationNumber,
        currentStep: updates.currentStep !== undefined ? updates.currentStep : service.currentStep,
        estimatedDelivery: updates.estimatedDelivery !== undefined ? updates.estimatedDelivery : service.rawEstimatedDelivery,
        averageTime: service.averageTime || '7 days',
        notes: updates.notes !== undefined ? updates.notes : service.notes,
        assignedTo: updates.assignedTo !== undefined ? (updates.assignedTo ? parseInt(updates.assignedTo) : null) : service.assignedToId,
        aadhaar: updates.aadhaar !== undefined ? updates.aadhaar : service.aadhaar,
        email: updates.email !== undefined ? updates.email : service.email,
        priority: updates.priority !== undefined ? updates.priority : service.priority,
        progress: updates.currentStep ? calculateProgress(service.status, updates.currentStep) : service.progress
      };

      const stepOrderMap = STEP_ORDER_MAP;
      if (updates.currentStep !== undefined && service.currentStep !== updates.currentStep) {
        const targetOrder = stepOrderMap[updates.currentStep] || 1;
        const nowIso = new Date().toISOString();
        if (service.steps && service.steps.length > 0) {
          updates.steps = service.steps.map(step => {
            const currentOrder = stepOrderMap[step.name] || step.step_order || 1;
            if (currentOrder <= targetOrder) {
              return { ...step, completed: true, date: (currentOrder === targetOrder) ? nowIso : (step.date || service.createdAt) };
            }
            return { ...step, completed: false };
          });
        }
        updates.updatedAt = nowIso;
      }

      setServices(prev => prev.map(s => s.id === service.id ? {
        ...s, ...updates,
        steps: updates.steps || s.steps,
        updatedAt: updates.updatedAt || s.updatedAt,
        assignedTo: updates.assignedTo !== undefined ? (staffList.find(st => st.id === parseInt(updates.assignedTo))?.name || 'Unassigned') : s.assignedTo,
        assignedToId: updates.assignedTo !== undefined ? (updates.assignedTo ? parseInt(updates.assignedTo) : null) : s.assignedToId,
        rawEstimatedDelivery: updates.estimatedDelivery !== undefined ? updates.estimatedDelivery : s.rawEstimatedDelivery,
        estimatedDelivery: updates.estimatedDelivery !== undefined ? formatDate(updates.estimatedDelivery) : s.estimatedDelivery,
        progress: payload.progress
      } : s));

      if (selectedService?.id === service.id) {
        setSelectedService(prev => ({
          ...prev, ...updates,
          steps: updates.steps || prev.steps,
          updatedAt: updates.updatedAt || prev.updatedAt,
          assignedTo: updates.assignedTo !== undefined ? (staffList.find(st => st.id === parseInt(updates.assignedTo))?.name || 'Unassigned') : prev.assignedTo,
          assignedToId: updates.assignedTo !== undefined ? (updates.assignedTo ? parseInt(updates.assignedTo) : null) : prev.assignedToId,
          estimatedDelivery: updates.estimatedDelivery !== undefined ? formatDate(updates.estimatedDelivery) : prev.estimatedDelivery,
          rawEstimatedDelivery: updates.estimatedDelivery !== undefined ? updates.estimatedDelivery : prev.rawEstimatedDelivery,
          progress: payload.progress
        }));
      }

      await updateTrackingEntry(service.id, payload);
      await fetchActivityHistory(service.id);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save change');
    }
  };

  const handleNotifyCustomer = async (service) => {
    try {
      await notifyCustomer(service.id, `Dear ${service.customerName}, your ${service.serviceType} application (App No: ${service.applicationNumber || 'N/A'}) is now ${service.status}.`);
      toast.success(`Notification sent to ${service.customerName}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to send notification');
    }
  };

  const handleUploadDocument = async (trackingId, file, label, visible) => {
    try {
      setUploadingDocument(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('label', label);
      fd.append('visible_to_customer', visible ? 'true' : 'false');
      await uploadTrackingDocument(trackingId, fd);
      await fetchDocuments(trackingId);
      toast.success('Document uploaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload document');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleToggleDocumentVisibility = async (trackingId, docId, visible) => {
    try {
      await toggleTrackingDocumentVisibility(trackingId, docId, visible);
      await fetchDocuments(trackingId);
      toast.success(visible ? 'Document visible to customer' : 'Document hidden');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update visibility');
    }
  };

  const handleDeleteDocument = async (trackingId, docId) => {
    try {
      await deleteTrackingDocument(trackingId, docId);
      await fetchDocuments(trackingId);
      toast.success('Document deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete document');
    }
  };

  /* ---------------- Export ---------------- */
  const fetchAllFilteredDataForExport = async () => {
    const apiStatus = REVERSE_STATUS_MAP[statusFilter] || statusFilter;
    const params = {
      page: 1, limit: totalRecords > 0 ? totalRecords : 10000,
      timeRange: timeRange === 'all' ? undefined : timeRange,
      date: dateFilter || undefined,
      service: serviceFilter === 'all' ? undefined : serviceFilter,
      categoryId: serviceFilter === 'all' ? undefined : serviceFilter,
      subcategory: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
      subcategoryId: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
      status: statusFilter === 'all' ? undefined : apiStatus,
      staff: staffFilter === 'all' ? undefined : staffFilter,
      expiry: expiryFilter === 'all' ? undefined : expiryFilter,
      search: debouncedSearch || undefined,
      aadhaar: debouncedAadhaar || undefined
    };
    const res = await getTrackingEntries(params);
    const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    let transformed = transformBackendData(data);
    if (serviceFilter !== 'all') transformed = transformed.filter(s => String(s.categoryId) === String(serviceFilter));
    if (subcategoryFilter !== 'all') transformed = transformed.filter(s => String(s.subcategoryId) === String(subcategoryFilter));
    return transformed;
  };

  const handleExportExcel = async () => {
    try {
      if (totalRecords === 0) return toast.info('No data to export');
      toast.info('Preparing Excel file…', { autoClose: 1500 });
      const data = await fetchAllFilteredDataForExport();
      const rows = data.map(s => ({
        'App No': s.applicationNumber, 'Customer': s.customerName, 'Phone': s.phone,
        'Email': s.email, 'Service': s.serviceType, 'Subcategory': s.subcategoryName,
        'Status': s.status, 'Step': s.currentStep, 'Priority': s.priority,
        'Assigned To': s.assignedTo, 'Created': s.date, 'Est. Delivery': s.estimatedDelivery,
        'Service Charge': s.serviceCharge, 'Dept Charge': s.departmentCharge,
        'Total': s.totalCharge, 'Payment': s.paymentStatus
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tracking');
      XLSX.writeFile(wb, `Service_Tracking_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel exported');
    } catch (err) { console.error(err); toast.error('Export failed'); }
  };

  const handleExportPDF = async () => {
    try {
      if (totalRecords === 0) return toast.info('No data to export');
      toast.info('Generating PDF…', { autoClose: 1500 });
      const data = await fetchAllFilteredDataForExport();
      const doc = new jsPDF('landscape');
      doc.setFontSize(15);
      doc.text('Service Tracking Report', 14, 15);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Generated: ${new Date().toLocaleDateString()} | Records: ${data.length}`, 14, 22);
      autoTable(doc, {
        head: [['App No', 'Customer', 'Phone', 'Service', 'Status', 'Step', 'Assigned', 'Total']],
        body: data.map(s => [s.applicationNumber, s.customerName, s.phone, s.serviceType, s.status, s.currentStep, s.assignedTo, `Rs ${s.totalCharge || 0}`]),
        startY: 28, styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229] }, alternateRowStyles: { fillColor: [249, 250, 251] }
      });
      doc.save(`Service_Tracking_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF exported');
    } catch (err) { console.error(err); toast.error('Export failed'); }
  };

  /* ---------------- Command palette actions ---------------- */
  const handleCommandAction = (action) => {
    if (action === 'excel') handleExportExcel();
    else if (action === 'pdf') handleExportPDF();
    else if (action === 'refresh') window.location.reload();
    else if (action === 'filter:pending') setStatusFilter('Pending');
    else if (action === 'filter:in_progress') setStatusFilter('In Progress');
    else if (action === 'filter:completed') setStatusFilter('Completed');
  };

  /* ---------------- Derived ---------------- */
  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (statusFilter !== 'all') n++;
    if (staffFilter !== 'all') n++;
    if (expiryFilter !== 'all') n++;
    if (dateFilter) n++;
    if (serviceFilter !== 'all') n++;
    if (subcategoryFilter !== 'all') n++;
    if (aadhaarSearch) n++;
    return n;
  }, [statusFilter, staffFilter, expiryFilter, dateFilter, serviceFilter, subcategoryFilter, aadhaarSearch]);

  const handleClearFilters = () => {
    setStatusFilter('all'); setStaffFilter('all'); setExpiryFilter('all');
    setSearchTerm(''); setAadhaarSearch(''); setDateFilter('');
    setServiceFilter('all'); setSubcategoryFilter('all'); setTimeRange('month');
  };

  /* ---------------- Render ---------------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-600 font-medium">Loading services…</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex flex-col">

        {/* ================= TOP BAR ================= */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="px-4 lg:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                <FiTarget className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-slate-900 truncate">Service Tracking</h1>
                <p className="text-xs text-slate-500 truncate hidden sm:block">Manage, track and update service applications</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setCommandOpen(true)}
                className="hidden md:flex items-center gap-2.5 px-3 py-1.5 text-sm text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                <FiSearch className="h-3.5 w-3.5" />
                <span className="text-xs">Search services…</span>
                <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-white rounded border border-slate-200 font-mono text-slate-500">
                  <FiCommand className="h-2.5 w-2.5" />K
                </kbd>
              </button>

              <button onClick={() => setCommandOpen(true)} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                <FiSearch className="h-4 w-4" />
              </button>

              {id && (
                <button onClick={() => navigate('/dashboard/staff/track_service')}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                  <FiArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
              )}

              <button onClick={handleExportExcel}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                <FiDownload className="h-3.5 w-3.5" />
                Export
              </button>

              <button onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
                <FiRefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* KPI strip */}
          <div className="px-4 lg:px-6 pb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <MiniStat label="Total" value={globalStats.total || 0} icon={FiLayers} color="indigo" />
            <MiniStat label="In Progress" value={globalStats.in_progress || 0} icon={FiActivity} color="blue" />
            <MiniStat label="Completed" value={globalStats.completed || 0} icon={FiCheckCircle} color="emerald" />
            <MiniStat label="Delayed" value={globalStats.delayed || 0} icon={FiAlertCircle} color="rose" />
            <MiniStat label="SLA" value={`${Math.round(globalStats.sla_compliance || 100)}%`} icon={FiAward} color="violet" />
          </div>
        </header>

        {/* ================= MAIN LAYOUT ================= */}
        <div className="flex-1 flex overflow-hidden min-h-0" style={{ height: 'calc(100vh - 130px)' }}>

          {/* ---------- LEFT SIDEBAR ---------- */}
          <aside className={`w-full lg:w-[360px] xl:w-[400px] bg-white border-r border-slate-200 flex flex-col min-h-0 ${
            selectedService ? 'hidden lg:flex' : 'flex'
          }`}>
            {/* Search + filter chips */}
            <div className="px-3 pt-3 pb-2 border-b border-slate-200 space-y-2.5 flex-shrink-0">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, phone, app no, Aadhaar…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white transition-all"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                    <FiX className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</FilterChip>
                <FilterChip active={statusFilter === 'Pending'} onClick={() => setStatusFilter('Pending')} dot="bg-amber-500">Pending</FilterChip>
                <FilterChip active={statusFilter === 'In Progress'} onClick={() => setStatusFilter('In Progress')} dot="bg-blue-500">Active</FilterChip>
                <FilterChip active={statusFilter === 'Completed'} onClick={() => setStatusFilter('Completed')} dot="bg-emerald-500">Done</FilterChip>
                <FilterChip active={statusFilter === 'Delayed'} onClick={() => setStatusFilter('Delayed')} dot="bg-rose-500">Delayed</FilterChip>
                <button onClick={() => setFiltersOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-full hover:bg-slate-200 flex-shrink-0">
                  <FiSliders className="h-3 w-3" />
                  {activeFiltersCount > 0 ? `More (${activeFiltersCount})` : 'More'}
                </button>
              </div>

              {(statusFilter !== 'all' || searchTerm || staffFilter !== 'all' || serviceFilter !== 'all') && (
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    <span className="font-semibold text-slate-700">{totalRecords}</span> result{totalRecords !== 1 ? 's' : ''}
                  </span>
                  <button onClick={handleClearFilters} className="text-indigo-600 hover:text-indigo-700 font-medium">
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {services.length === 0 ? (
                <EmptyState icon={FiInbox} title="No services found" message="Try adjusting your filters or search terms." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {services.map(s => (
                    <ServiceListItem key={s.id} service={s} selected={selectedService?.id === s.id} onClick={() => handleServiceSelect(s)} />
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-3 py-2.5 border-t border-slate-200 flex items-center justify-between flex-shrink-0 bg-slate-50">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="p-1.5 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-600">
                  <FiChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{currentPage}</span> / {totalPages}
                </div>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="p-1.5 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-600">
                  <FiChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </aside>

          {/* ---------- RIGHT DETAIL ---------- */}
          <main className={`flex-1 overflow-y-auto bg-slate-50 min-h-0 ${!selectedService ? 'hidden lg:block' : 'block'}`}>
            {selectedService ? (
              <DetailPanel
                service={selectedService}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                staffList={staffList}
                stepOptions={STEP_OPTIONS}
                priorityOptions={PRIORITY_OPTIONS}
                documents={documents}
                documentsLoading={documentsLoading}
                uploadingDocument={uploadingDocument}
                activityHistory={activityHistory}
                activityLoading={activityLoading}
                onBack={() => navigate('/dashboard/staff/track_service')}
                onNotify={handleNotifyCustomer}
                onUpdateStatus={handleUpdateStatus}
                onInlineUpdate={handleInlineTrackingUpdate}
                onUpload={(file, label, visible) => handleUploadDocument(selectedService.id, file, label, visible)}
                onToggleVisibility={(docId, visible) => handleToggleDocumentVisibility(selectedService.id, docId, visible)}
                onDeleteDoc={(docId) => handleDeleteDocument(selectedService.id, docId)}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  icon={FiUser}
                  title="Select a service to begin"
                  message="Choose any service from the list to view details, edit inline, manage documents and track history. Press ⌘K to search from anywhere."
                />
              </div>
            )}
          </main>
        </div>

        {/* ================= MODALS ================= */}
        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          services={services}
          onSelect={handleServiceSelect}
          onAction={handleCommandAction}
        />

        <AnimatePresence>
          {filtersOpen && (
            <FiltersModal
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              staffList={staffList}
              categories={categories}
              availableSubcategories={availableSubcategories}
              filters={{
                timeRange, dateFilter, serviceFilter, subcategoryFilter,
                staffFilter, expiryFilter, aadhaarSearch
              }}
              setFilters={(updater) => {
                const next = typeof updater === 'function' ? updater({}) : updater;
                // Handle direct key-value style updates
                const prev = { timeRange, dateFilter, serviceFilter, subcategoryFilter, staffFilter, expiryFilter, aadhaarSearch };
                const merged = { ...prev, ...next };
                if (merged.timeRange !== undefined) setTimeRange(merged.timeRange);
                if (merged.dateFilter !== undefined) setDateFilter(merged.dateFilter);
                if (merged.serviceFilter !== undefined) setServiceFilter(merged.serviceFilter);
                if (merged.subcategoryFilter !== undefined) setSubcategoryFilter(merged.subcategoryFilter);
                if (merged.staffFilter !== undefined) setStaffFilter(merged.staffFilter);
                if (merged.expiryFilter !== undefined) setExpiryFilter(merged.expiryFilter);
                if (merged.aadhaarSearch !== undefined) setAadhaarSearch(merged.aadhaarSearch);
              }}
              onClear={handleClearFilters}
            />
          )}
        </AnimatePresence>

        <style>{`
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .border-3 { border-width: 3px; }
        `}</style>
      </div>
    </ErrorBoundary>
  );
};

/* ============================================================
   DETAIL PANEL
   ============================================================ */

const TABS = [
  { id: 'overview', label: 'Overview', icon: FiLayers },
  { id: 'tracking', label: 'Edit', icon: FiEdit },
  { id: 'documents', label: 'Documents', icon: FiPaperclip },
  { id: 'history', label: 'History', icon: FiClock },
  { id: 'discussion', label: 'Discussion', icon: FiMessageCircle }
];

const DetailPanel = ({
  service, activeTab, setActiveTab, staffList, stepOptions, priorityOptions,
  documents, documentsLoading, uploadingDocument, activityHistory, activityLoading,
  onBack, onNotify, onUpdateStatus, onInlineUpdate,
  onUpload, onToggleVisibility, onDeleteDoc
}) => {
  return (
    <div className="flex flex-col min-h-full">
      {/* ---------- Detail header ---------- */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-4 lg:px-6 py-4">
          <button onClick={onBack} className="lg:hidden flex items-center gap-1 text-xs text-slate-500 mb-3 hover:text-slate-700">
            <FiArrowLeft className="h-3.5 w-3.5" /> Back to list
          </button>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <FiUser className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold text-slate-900 truncate">{service.customerName}</h2>
                  <StatusPill status={service.status} />
                  <PriorityPill priority={service.priority} />
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><FiPhone className="h-3 w-3" />{service.phone}</span>
                  {service.email && <span className="hidden sm:flex items-center gap-1"><FiMail className="h-3 w-3" />{service.email}</span>}
                  {service.aadhaar && <span className="hidden md:flex items-center gap-1"><FiCreditCard className="h-3 w-3" />{service.aadhaar}</span>}
                  {service.applicationNumber && (
                    <span className="flex items-center gap-1 font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                      <FiFileText className="h-3 w-3" />{service.applicationNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={() => onNotify(service)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
                <FiSend className="h-3.5 w-3.5" /> Notify
              </button>
              <button
                onClick={() => { window.location.href = `/dashboard/staff/service-workspace/${service.id}`; }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
                <FiGrid className="h-3.5 w-3.5" /> Workspace
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 lg:px-6">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    active ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {active && (
                    <motion.div layoutId="tab-underline"
                      className="absolute bottom-0 left-2 right-2 h-[2px] bg-indigo-600 rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------- Tab content ---------- */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="p-4 lg:p-6">
            {activeTab === 'overview' && (
              <OverviewPanel service={service} staffList={staffList} stepOptions={stepOptions}
                priorityOptions={priorityOptions} onUpdateStatus={onUpdateStatus} onInlineUpdate={onInlineUpdate} />
            )}
            {activeTab === 'tracking' && (
              <TrackingFormPanel service={service} staffList={staffList}
                stepOptions={stepOptions} priorityOptions={priorityOptions}
                onSave={(updates) => onInlineUpdate(service, updates)} />
            )}
            {activeTab === 'documents' && (
              <DocumentsPanel documents={documents} loading={documentsLoading} uploading={uploadingDocument}
                onUpload={onUpload} onToggleVisibility={onToggleVisibility} onDelete={onDeleteDoc} />
            )}
            {activeTab === 'history' && (
              <HistoryPanel activityHistory={activityHistory} loading={activityLoading} />
            )}
            {activeTab === 'discussion' && (
              <div className="max-w-4xl">
                <div className="flex items-center gap-2 mb-1">
                  <FiMessageCircle className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Internal Discussion & Tasks</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Notes here are internal. Tag staff using @ to assign them tasks.
                </p>
                <div className="bg-white rounded-xl p-2 sm:p-4 border border-slate-200">
                  <NotesPanel contextType="service_entry" contextId={service.serviceEntryId} embedded showHeader={false} />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ============================================================
   OVERVIEW PANEL
   ============================================================ */

const OverviewPanel = ({ service, staffList, stepOptions, priorityOptions, onUpdateStatus, onInlineUpdate }) => {
  const update = (updates) => onInlineUpdate(service, updates);

  const displaySteps = useMemo(() => {
    if (service.steps && service.steps.length > 0) {
      return [...service.steps].sort((a, b) => (a.step_order || 0) - (b.step_order || 0));
    }
    const currentOrder = STEP_ORDER_MAP[service.currentStep] || 1;
    return [
      { id: 1, name: 'Submitted', completed: true, step_order: 1, date: service.createdAt },
      { id: 2, name: 'Initial Review', completed: currentOrder >= 2, step_order: 2, date: currentOrder === 2 ? service.updatedAt : null },
      { id: 3, name: 'Document Verification', completed: currentOrder >= 3, step_order: 3, date: currentOrder === 3 ? service.updatedAt : null },
      { id: 4, name: 'Final Approval', completed: currentOrder >= 4, step_order: 4, date: currentOrder >= 4 ? service.updatedAt : null }
    ];
  }, [service]);

  const staffOptions = staffList.map(s => ({ value: s.id, label: s.name }));

  return (
    <div className="space-y-4 max-w-6xl">

      {/* Progress Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FiZap className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Progress</h3>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              {service.workSource === 'online' ? 'Online booking' : 'Walk-in'}
            </span>
          </div>
          <span className="text-lg font-bold text-indigo-600">{service.progress}%</span>
        </div>

        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
          <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
            initial={{ width: 0 }} animate={{ width: `${service.progress}%` }} transition={{ duration: 0.4 }} />
        </div>

        {/* Quick status update */}
        <div className="flex items-center flex-wrap gap-1.5 mb-4">
          {Object.keys(STATUS_CONFIG).map(statusKey => {
            const isCurrent = service.status === statusKey;
            const c = STATUS_CONFIG[statusKey];
            return (
              <button key={statusKey} onClick={() => !isCurrent && onUpdateStatus(service.id, statusKey)}
                disabled={isCurrent}
                className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
                  isCurrent
                    ? `${c.bg} ${c.color} ${c.border} cursor-default opacity-90`
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}>
                {isCurrent && <FiCheck className="inline h-3 w-3 mr-1 -mt-0.5" />}
                {statusKey}
              </button>
            );
          })}
        </div>

        {/* Timeline */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {displaySteps.map((step, i) => (
            <div key={step.id || i}
              className={`px-3 py-2 rounded-lg border text-xs ${
                step.completed
                  ? 'bg-emerald-50 border-emerald-200'
                  : step.name === service.currentStep
                  ? 'bg-indigo-50 border-indigo-200'
                  : 'bg-slate-50 border-slate-200'
              }`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                {step.completed ? (
                  <FiCheckCircle className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                ) : (
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${step.name === service.currentStep ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                )}
                <span className={`font-medium truncate ${
                  step.completed ? 'text-emerald-800' : step.name === service.currentStep ? 'text-indigo-800' : 'text-slate-500'
                }`}>
                  {step.name}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">
                {step.date ? formatTimelineDate(step.date) : 'Pending'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Editable Details + Financial */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Editable Service Details */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiEdit className="h-3.5 w-3.5 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">Service Details</h3>
            </div>
            <span className="text-[10px] text-slate-400 italic">Click any field to edit</span>
          </div>
          <div className="p-2">
            <EditableRow label="Application No" value={service.applicationNumber} placeholder="Set app number"
              onSave={v => update({ applicationNumber: v })} />
            <EditableRow label="Service" value={service.serviceType} placeholder="—" onSave={() => {}} />
            <EditableRow label="Subcategory" value={service.subcategoryName} placeholder="—" onSave={() => {}} />
            <EditableRow label="Current Step" value={service.currentStep} options={stepOptions}
              onSave={v => update({ currentStep: v })} />
            <EditableRow label="Assigned To" value={service.assignedToId || ''} displayValue={service.assignedTo}
              options={staffOptions} placeholder="Unassigned"
              onSave={v => update({ assignedTo: v })} />
            <EditableRow label="Priority" value={service.priority} options={priorityOptions}
              displayValue={PRIORITY_CONFIG[service.priority]?.label}
              onSave={v => update({ priority: v })} />
            <EditableRow label="Est. Delivery" value={formatDateForInput(service.rawEstimatedDelivery)} type="date"
              displayValue={service.estimatedDelivery}
              onSave={v => update({ estimatedDelivery: v })} />
            <EditableRow label="Aadhaar" value={service.aadhaar} placeholder="Not set"
              onSave={v => update({ aadhaar: v })} />
            <EditableRow label="Email" value={service.email} type="email" placeholder="Not set"
              onSave={v => update({ email: v })} />
            <EditableRow label="Remarks" value={service.notes} placeholder="No notes"
              multiline onSave={v => update({ notes: v })} />
          </div>
        </div>

        {/* Financial Summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiDollarSign className="h-3.5 w-3.5 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-900">Financial Summary</h3>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                PAYMENT_STATUS_CONFIG[service.paymentStatus]?.bg || 'bg-slate-100'
              } ${PAYMENT_STATUS_CONFIG[service.paymentStatus]?.color || 'text-slate-600'}`}>
                {service.paymentStatus}
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Service Charge</span>
                <span className="text-sm font-medium text-slate-900 font-mono">₹{service.serviceCharge?.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Department Charge</span>
                <span className="text-sm font-medium text-slate-900 font-mono">₹{service.departmentCharge?.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Total</span>
                <span className="text-lg font-bold text-indigo-600 font-mono">₹{service.totalCharge?.toFixed(2)}</span>
              </div>
              {service.paymentDetails && service.paymentDetails !== 'No payments recorded' && (
                <div className="bg-slate-50 rounded-lg p-3 mt-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Payment Records</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{service.paymentDetails}</p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Review */}
          {service.serviceRating && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <FiStar className="h-3.5 w-3.5 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900">Customer Review</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Service Rating</span>
                  <Stars value={service.serviceRating} />
                </div>
                {service.staffRating && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Staff Rating</span>
                    <Stars value={service.staffRating} />
                  </div>
                )}
                {service.reviewText && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-700 leading-relaxed italic">"{service.reviewText}"</p>
                    {service.reviewSubmittedAt && (
                      <p className="text-[10px] text-slate-400 mt-2">
                        — {formatDate(service.reviewSubmittedAt)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   TRACKING FORM PANEL
   ============================================================ */

const TrackingFormPanel = ({ service, staffList, stepOptions, priorityOptions, onSave }) => {
  const [form, setForm] = useState({
    applicationNumber: service.applicationNumber || '',
    currentStep: service.currentStep || 'Submitted',
    estimatedDelivery: formatDateForInput(service.rawEstimatedDelivery) || '',
    averageTime: service.averageTime || '7 days',
    notes: service.notes || '',
    assignedTo: service.assignedToId || '',
    aadhaar: service.aadhaar || '',
    email: service.email || '',
    priority: service.priority || 'medium'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.applicationNumber && form.applicationNumber.length > 50) return toast.error('Application number too long');
    if (form.aadhaar && !/^\d{12}$/.test(form.aadhaar)) return toast.error('Aadhaar must be 12 digits');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error('Invalid email');
    onSave(form);
    toast.success('Changes saved');
  };

  const fc = "w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all";
  const lc = "block text-xs font-medium text-slate-600 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FiEdit className="h-3.5 w-3.5 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900">Edit Tracking Information</h3>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={lc}>Application Number</label>
            <input type="text" name="applicationNumber" value={form.applicationNumber} onChange={handleChange}
              placeholder="e.g. APP12345" className={fc} />
          </div>
          <div>
            <label className={lc}>Current Step</label>
            <select name="currentStep" value={form.currentStep} onChange={handleChange} className={fc}>
              {stepOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lc}>Estimated Delivery</label>
            <input type="date" name="estimatedDelivery" value={form.estimatedDelivery} onChange={handleChange} className={fc} />
          </div>
          <div>
            <label className={lc}>Priority</label>
            <select name="priority" value={form.priority} onChange={handleChange} className={fc}>
              {priorityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lc}>Average Time</label>
            <input type="text" name="averageTime" value={form.averageTime} onChange={handleChange}
              placeholder="e.g. 7 days" className={fc} />
          </div>
          <div>
            <label className={lc}>Assigned To</label>
            <select name="assignedTo" value={form.assignedTo} onChange={handleChange} className={fc}>
              <option value="">Unassigned</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lc}>Aadhaar Number</label>
            <input type="text" name="aadhaar" value={form.aadhaar} onChange={handleChange}
              maxLength={12} placeholder="12-digit" className={fc} />
          </div>
          <div>
            <label className={lc}>Email Address</label>
            <input type="email" name="email" value={form.email} onChange={handleChange}
              placeholder="customer@example.com" className={fc} />
          </div>
          <div className="md:col-span-2">
            <label className={lc}>Customer Remarks <span className="text-slate-400 font-normal">(Sent via WhatsApp)</span></label>
            <textarea name="notes" value={form.notes} onChange={handleChange}
              placeholder="Enter remarks visible to the customer…" rows={3}
              className={`${fc} resize-none`} />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button type="button" onClick={() => onSave({})}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100">
            Cancel
          </button>
          <button type="submit"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
            <FiSave className="h-3.5 w-3.5" /> Save Changes
          </button>
        </div>
      </div>
    </form>
  );
};

/* ============================================================
   DOCUMENTS PANEL
   ============================================================ */

const DocumentsPanel = ({ documents = [], loading, uploading, onUpload, onToggleVisibility, onDelete }) => {
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState('');
  const [visible, setVisible] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    if (!file || !label.trim()) return toast.error('Choose a file and enter a label');
    onUpload(file, label.trim(), visible);
    setFile(null); setLabel(''); setVisible(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const formatBytes = (b) => {
    if (!b) return '';
    const kb = b / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
  };

  const fileIcon = (name = '') => {
    const n = name.toLowerCase();
    if (n.endsWith('.pdf')) return { Icon: FiFileText, color: 'text-rose-600', bg: 'bg-rose-50' };
    if (/\.(jpg|jpeg|png|gif|webp)$/.test(n)) return { Icon: FiEye, color: 'text-blue-600', bg: 'bg-blue-50' };
    if (/\.(doc|docx)$/.test(n)) return { Icon: FiFileText, color: 'text-indigo-600', bg: 'bg-indigo-50' };
    return { Icon: FiFileText, color: 'text-slate-600', bg: 'bg-slate-100' };
  };

  return (
    <div className="space-y-4">
      {/* Upload form */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FiUpload className="h-3.5 w-3.5 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900">Upload New Document</h3>
        </div>
        <form onSubmit={submit} className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Document Label <span className="text-rose-500">*</span></label>
              <input type="text" value={label} onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Income Certificate"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500" />
            </div>
            <div className="lg:col-span-5">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">File <span className="text-rose-500">*</span></label>
              <div onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={e => { e.preventDefault(); setDrag(false); }}
                onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]); }}
                onClick={() => inputRef.current?.click()}
                className={`flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                  drag ? 'border-indigo-500 bg-indigo-50'
                  : file ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/40'
                }`}>
                <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={e => setFile(e.target.files[0] || null)} className="hidden" />
                {file ? (
                  <>
                    <FiFileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-sm text-slate-800 truncate flex-1">{file.name}</span>
                    <span className="text-xs text-slate-500 flex-shrink-0">{formatBytes(file.size)}</span>
                  </>
                ) : (
                  <>
                    <FiUpload className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-500 truncate flex-1">
                      {drag ? 'Drop file here' : 'Click or drag file'}
                    </span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0 hidden sm:inline">PDF · DOC · IMG</span>
                  </>
                )}
              </div>
            </div>
            <div className="lg:col-span-3 flex flex-col">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Visibility</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setVisible(!visible)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                    visible ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}>
                  {visible ? <FiEye className="h-3.5 w-3.5" /> : <FiEyeOff className="h-3.5 w-3.5" />}
                  {visible ? 'Visible' : 'Hidden'}
                </button>
                <button type="submit" disabled={uploading || !file || !label.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                  {uploading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Uploading
                    </>
                  ) : (
                    <><FiUpload className="h-3.5 w-3.5" /> Upload</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiFileText className="h-3.5 w-3.5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Uploaded Documents</h3>
          </div>
          {documents.length > 0 && (
            <span className="text-xs text-slate-500">
              {documents.length} · {documents.filter(d => d.visible_to_customer).length} visible
            </span>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-slate-500">Loading documents…</span>
          </div>
        ) : documents.length === 0 ? (
          <EmptyState icon={FiFileText} title="No documents yet" message="Upload the first document using the form above" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5 font-semibold">Document</th>
                  <th className="px-4 py-2.5 font-semibold w-36">Uploaded By</th>
                  <th className="px-4 py-2.5 font-semibold w-28">Date</th>
                  <th className="px-4 py-2.5 font-semibold w-20 text-center">Size</th>
                  <th className="px-4 py-2.5 font-semibold w-28 text-center">Visibility</th>
                  <th className="px-4 py-2.5 font-semibold w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map(doc => {
                  const { Icon, color, bg } = fileIcon(doc.file_name || doc.label || '');
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                            <Icon className={`h-4 w-4 ${color}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{doc.label}</p>
                            <p className="text-[11px] text-slate-500 truncate">{doc.file_name || 'document'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{doc.uploaded_by_name || 'Staff'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{formatDate(doc.created_at)}</td>
                      <td className="px-4 py-2.5 text-center text-xs text-slate-500 font-mono">{formatBytes(doc.file_size) || '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => onToggleVisibility(doc.id, !doc.visible_to_customer)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                            doc.visible_to_customer
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}>
                          {doc.visible_to_customer ? <FiEye className="h-2.5 w-2.5" /> : <FiEyeOff className="h-2.5 w-2.5" />}
                          {doc.visible_to_customer ? 'Visible' : 'Hidden'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          {(doc.file_url || doc.url) && (
                            <a href={doc.file_url || doc.url} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                              <FiExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button onClick={() => { if (window.confirm(`Delete "${doc.label}"?`)) onDelete(doc.id); }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                            <FiTrash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   HISTORY PANEL
   ============================================================ */

const HistoryPanel = ({ activityHistory, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-sm text-slate-500">Loading history…</span>
      </div>
    );
  }
  if (!activityHistory?.length) {
    return <EmptyState icon={FiClock} title="No activity yet" message="Activity will appear here as changes are made" />;
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Activity Timeline</h3>
        <span className="text-xs text-slate-500">{activityHistory.length} event{activityHistory.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="relative">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" />
        <div className="space-y-4">
          {activityHistory.map(a => (
            <div key={a.id} className="relative flex gap-3">
              <div className="w-8 h-8 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center flex-shrink-0 z-10">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
              </div>
              <div className="flex-1 bg-white rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="text-sm font-semibold text-slate-900">{a.action}</p>
                  <p className="text-[10px] text-slate-400 whitespace-nowrap">
                    {a.created_at ? formatTimelineDate(a.created_at) : '—'}
                  </p>
                </div>
                {a.description && <p className="text-xs text-slate-600 leading-relaxed">{a.description}</p>}
                <p className="text-[10px] text-slate-400 mt-1.5">By {a.performed_by_name || 'System'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrackServicePage;