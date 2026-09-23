import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FiUser, FiPhone, FiClock, FiCheckCircle, FiAlertCircle,
  FiRefreshCw, FiSearch, FiEdit, FiMessageSquare, FiChevronDown,
  FiFileText, FiBarChart2, FiDollarSign, FiCalendar, FiTrendingUp,
  FiMail, FiDownload, FiFilter, FiPrinter, FiAward, FiTarget, FiPlus,
  FiGrid, FiList, FiCreditCard, FiFlag, FiArrowLeft, FiMessageCircle,
  FiUpload, FiTrash2, FiEye, FiEyeOff, FiPaperclip, FiX, FiCommand,
  FiChevronRight, FiExternalLink, FiSliders, FiSend, FiCheck,
  FiLayers, FiActivity, FiSave, FiStar, FiUserCheck, FiPhoneCall,
  FiCopy, FiZap, FiFile
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  getTrackingEntries, getTrackingEntryById, updateTrackingEntry,
  updateTrackingStatus, notifyCustomer, getStaff, getCategories,
  getServiceEntries, getTrackingStats, getTrackingActivity,
  getTrackingDocuments, uploadTrackingDocument,
  toggleTrackingDocumentVisibility, deleteTrackingDocument
} from '/src/services/serviceService';
import { useParams, useNavigate } from 'react-router-dom';
import NotesPanel from '/src/components/notes/NotesPanel';

/* ============================================================
   CONSTANTS
   ============================================================ */

const STATUS_MAP = {
  pending: 'Pending', in_progress: 'In Progress', completed: 'Completed',
  rejected: 'Delayed', resubmit: 'Resubmit', paid: 'Paid'
};

const REVERSE_STATUS_MAP = {
  Pending: 'pending', 'In Progress': 'in_progress', Completed: 'completed',
  Delayed: 'rejected', Resubmit: 'resubmit', Paid: 'paid'
};

const STATUS_CONFIG = {
  Pending:     { color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500',   ring: 'ring-amber-500/20' },
  'In Progress':{ color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    dot: 'bg-blue-500',    ring: 'ring-blue-500/20' },
  Delayed:     { color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200',    dot: 'bg-rose-500',    ring: 'ring-rose-500/20' },
  Completed:   { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-500/20' },
  Resubmit:    { color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  dot: 'bg-orange-500',  ring: 'ring-orange-500/20' },
  Paid:        { color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200',    dot: 'bg-teal-500',    ring: 'ring-teal-500/20' }
};

const PRIORITY_CONFIG = {
  low:    { color: 'text-slate-600',  bg: 'bg-slate-100',  border: 'border-slate-200',  label: 'Low' },
  medium: { color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  label: 'Medium' },
  high:   { color: 'text-rose-700',   bg: 'bg-rose-50',    border: 'border-rose-200',   label: 'High' }
};

const PAYMENT_STATUS_CONFIG = {
  'Not Applicable': { color: 'text-slate-600',  bg: 'bg-slate-100' },
  Received:         { color: 'text-emerald-700', bg: 'bg-emerald-50' },
  Partial:          { color: 'text-amber-700',   bg: 'bg-amber-50' },
  Pending:          { color: 'text-rose-700',    bg: 'bg-rose-50' },
  Processing:       { color: 'text-blue-700',    bg: 'bg-blue-50' }
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

const formatDate = (d) => {
  if (!d) return 'Not set';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return 'Invalid date'; }
};

const formatTimelineDate = (d) => {
  if (!d) return 'Not set';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'Invalid date';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).format(date);
  } catch { return 'Invalid date'; }
};

const formatDateForInput = (d) => {
  if (!d) return '';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch { return ''; }
};

const calculateProgress = (status, step) => {
  const m = { Submitted: 25, 'Initial Review': 50, 'Document Verification': 75, 'Final Approval': 100 };
  if (status === 'Completed' || status === 'Paid') return 100;
  return m[step] || 25;
};

const formatBytes = (b) => {
  if (!b) return '';
  const kb = b / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
};

const fileIconFor = (name = '') => {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return { Icon: FiFileText, color: 'text-rose-600', bg: 'bg-rose-50' };
  if (/\.(jpg|jpeg|png|gif|webp)$/.test(n)) return { Icon: FiEye, color: 'text-blue-600', bg: 'bg-blue-50' };
  if (/\.(doc|docx)$/.test(n)) return { Icon: FiFileText, color: 'text-indigo-600', bg: 'bg-indigo-50' };
  return { Icon: FiFileText, color: 'text-slate-600', bg: 'bg-slate-100' };
};

/* ============================================================
   ERROR BOUNDARY
   ============================================================ */

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(e) { return { hasError: true, error: e }; }
  componentDidCatch(e, i) { console.error(e, i); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-sm text-center shadow-sm">
            <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiAlertCircle className="h-7 w-7 text-rose-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-500 mb-4">Please refresh to try again.</p>
            <button onClick={() => window.location.reload()}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ============================================================
   SHARED UI
   ============================================================ */

const StatusPill = ({ status, size = 'sm' }) => {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.Pending;
  const s = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 ${s} rounded-full font-semibold ${c.bg} ${c.color} border ${c.border} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
};

const PriorityPill = ({ priority }) => {
  const c = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${c.bg} ${c.color} border ${c.border}`}>
      <FiFlag className="h-2.5 w-2.5" />
      {c.label}
    </span>
  );
};

const SourceBadge = ({ source }) =>
  source === 'online' ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Walk-in
    </span>
  );

const KpiCard = ({ label, value, icon: Icon, accent = 'indigo', trend }) => {
  const accents = {
    indigo:  { bg: 'bg-indigo-50',  fg: 'text-indigo-600',  ring: 'ring-indigo-500/10' },
    blue:    { bg: 'bg-blue-50',    fg: 'text-blue-600',    ring: 'ring-blue-500/10' },
    emerald: { bg: 'bg-emerald-50', fg: 'text-emerald-600', ring: 'ring-emerald-500/10' },
    rose:    { bg: 'bg-rose-50',    fg: 'text-rose-600',    ring: 'ring-rose-500/10' },
    violet:  { bg: 'bg-violet-50',  fg: 'text-violet-600',  ring: 'ring-violet-500/10' },
    amber:   { bg: 'bg-amber-50',   fg: 'text-amber-600',   ring: 'ring-amber-500/10' }
  };
  const a = accents[accent] || accents.indigo;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg ${a.bg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${a.fg}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          <FiTrendingUp className={`h-3 w-3 ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
          <span className="text-[10px] text-slate-400">vs last period</span>
        </div>
      )}
    </div>
  );
};

const FilterChip = ({ active, onClick, children, dot }) => (
  <button onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap ${
      active
        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
    }`}>
    {dot && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : dot}`} />}
    {children}
  </button>
);

const EmptyState = ({ icon: Icon, title, message }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
      <Icon className="h-6 w-6 text-slate-400" />
    </div>
    <p className="text-sm font-semibold text-slate-900 mb-1">{title}</p>
    <p className="text-xs text-slate-500 max-w-xs">{message}</p>
  </div>
);

/* ============================================================
   INLINE EDITABLE CELL
   ============================================================ */

const InlineEdit = ({ value, displayValue, onSave, type = 'text', options, placeholder, className = '', align = 'left', icon: Icon }) => {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value ?? '');
  const ref = useRef(null);

  useEffect(() => { setTemp(value ?? ''); }, [value]);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const commit = () => { if (temp !== value) onSave(temp); setEditing(false); };
  const cancel = () => { setTemp(value ?? ''); setEditing(false); };
  const onKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') cancel();
  };

  if (editing) {
    if (options) {
      return (
        <select ref={ref} value={temp} onChange={e => setTemp(e.target.value)}
          onBlur={commit} onKeyDown={onKey}
          className="w-full text-xs bg-white border border-indigo-400 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
          <option value="">— None —</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    return (
      <input ref={ref} type={type} value={temp} onChange={e => setTemp(e.target.value)}
        onBlur={commit} onKeyDown={onKey}
        className="w-full text-xs bg-white border border-indigo-400 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
    );
  }

  const txt = displayValue !== undefined ? displayValue : value;
  return (
    <button onClick={() => setEditing(true)}
      className={`group/edit flex items-center gap-1.5 w-full text-left px-1.5 py-1 -mx-1.5 rounded-md hover:bg-indigo-50/60 transition-colors ${align === 'right' ? 'justify-end' : ''} ${className}`}>
      {Icon && <Icon className="h-3 w-3 text-slate-400 flex-shrink-0" />}
      <span className={`truncate ${txt ? 'text-slate-800' : 'text-slate-400 italic'}`}>
        {txt || placeholder || '—'}
      </span>
      <FiEdit className="h-3 w-3 text-slate-300 opacity-0 group-hover/edit:opacity-100 transition-opacity flex-shrink-0" />
    </button>
  );
};

/* ============================================================
   COMMAND PALETTE
   ============================================================ */

const CommandPalette = ({ open, onClose, services, onSelect, onAction }) => {
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQuery(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 60); }
  }, [open]);

  const actions = useMemo(() => [
    { id: 'excel',    label: 'Export to Excel',       icon: FiDownload,     run: () => onAction('excel') },
    { id: 'pdf',      label: 'Export to PDF',         icon: FiFileText,     run: () => onAction('pdf') },
    { id: 'refresh',  label: 'Refresh Data',          icon: FiRefreshCw,    run: () => onAction('refresh') },
    { id: 'pending',  label: 'Show Pending',          icon: FiClock,        run: () => onAction('filter:Pending') },
    { id: 'progress', label: 'Show In Progress',      icon: FiActivity,     run: () => onAction('filter:In Progress') },
    { id: 'completed',label: 'Show Completed',        icon: FiCheckCircle,  run: () => onAction('filter:Completed') },
    { id: 'delayed',  label: 'Show Delayed',          icon: FiAlertCircle,  run: () => onAction('filter:Delayed') }
  ], [onAction]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return services.filter(s =>
      s.customerName?.toLowerCase().includes(q) ||
      s.phone?.toString().includes(q) ||
      s.applicationNumber?.toLowerCase().includes(q) ||
      s.aadhaar?.toString().includes(q) ||
      s.serviceType?.toLowerCase().includes(q) ||
      s.assignedTo?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query, services]);

  const showingActions = !query.trim();
  const list = showingActions ? actions : results;

  useEffect(() => { setIdx(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, list.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (showingActions) { actions[idx]?.run(); onClose(); }
        else if (results[idx]) { onSelect(results[idx]); onClose(); }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, idx, list, results, actions, showingActions, onClose, onSelect]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] bg-slate-900/30 backdrop-blur-sm px-4"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.12 }}
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 border-b border-slate-100">
          <FiSearch className="h-4 w-4 text-slate-400" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search services or run a command…"
            className="flex-1 py-4 text-sm bg-transparent outline-none placeholder:text-slate-400" />
          <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-100 rounded font-mono text-slate-500 border border-slate-200">ESC</kbd>
        </div>
        <div className="max-h-[360px] overflow-y-auto py-2">
          {showingActions ? (
            <>
              <p className="px-4 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Quick Actions</p>
              {actions.map((a, i) => (
                <button key={a.id}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => { a.run(); onClose(); }}
                  className={`w-[calc(100%-16px)] mx-2 text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${
                    i === idx ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}>
                  <a.icon className={`h-4 w-4 ${i === idx ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="text-sm text-slate-700">{a.label}</span>
                </button>
              ))}
            </>
          ) : results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">No results</div>
          ) : (
            <>
              <p className="px-4 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </p>
              {results.map((s, i) => (
                <button key={s.id}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => { onSelect(s); onClose(); }}
                  className={`w-[calc(100%-16px)] mx-2 text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors ${
                    i === idx ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${i === idx ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                    <FiUser className={`h-4 w-4 ${i === idx ? 'text-indigo-600' : 'text-slate-500'}`} />
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
            </>
          )}
        </div>
        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-slate-600">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-slate-600">↵</kbd> Open</span>
        </div>
      </motion.div>
    </div>
  );
};

/* ============================================================
   FILTERS DRAWER
   ============================================================ */

const FiltersDrawer = ({ open, onClose, staffList, categories, availableSubcategories, values, setValues, onClear }) => {
  if (!open) return null;
  const update = (k, v) => setValues({ ...values, [k]: v });
  const fc = "w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500";
  const lc = "block text-xs font-semibold text-slate-600 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FiSliders className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className={lc}>Time Range</label>
            <select value={values.timeRange} onChange={e => update('timeRange', e.target.value)} className={fc}>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <div>
            <label className={lc}>Specific Date</label>
            <input type="date" value={values.dateFilter} onChange={e => update('dateFilter', e.target.value)} className={fc} />
          </div>
          <div>
            <label className={lc}>Service Category</label>
            <select value={values.serviceFilter}
              onChange={e => { update('serviceFilter', e.target.value); update('subcategoryFilter', 'all'); }}
              className={fc}>
              <option value="all">All Services</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lc}>Subcategory</label>
            <select value={values.subcategoryFilter} onChange={e => update('subcategoryFilter', e.target.value)}
              disabled={values.serviceFilter === 'all'}
              className={`${fc} ${values.serviceFilter === 'all' ? 'opacity-50' : ''}`}>
              <option value="all">{values.serviceFilter === 'all' ? 'Select category first' : 'All Subcategories'}</option>
              {availableSubcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lc}>Assigned Staff</label>
            <select value={values.staffFilter} onChange={e => update('staffFilter', e.target.value)} className={fc}>
              <option value="all">Everyone</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lc}>Timeline</label>
            <select value={values.expiryFilter} onChange={e => update('expiryFilter', e.target.value)} className={fc}>
              <option value="all">Any Timeline</option>
              <option value="upcoming">Upcoming Expiry</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label className={lc}>Aadhaar Number</label>
            <div className="relative">
              <FiCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input type="text" maxLength={12} placeholder="Enter 12-digit Aadhaar"
                value={values.aadhaarSearch} onChange={e => update('aadhaarSearch', e.target.value)}
                className={`${fc} pl-10`} />
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 bg-slate-50">
          <button onClick={onClear}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100">
            Clear All
          </button>
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
            Apply
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ============================================================
   MAIN
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

  const getSaved = () => {
    try {
      const s = localStorage.getItem('staffServiceSavedView');
      if (s) return JSON.parse(s);
    } catch {}
    return { status: 'all', staff: 'all', expiry: 'all', date: '', service: 'all', subcategory: 'all' };
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [aadhaarSearch, setAadhaarSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(getSaved().status);
  const [staffFilter, setStaffFilter] = useState(getSaved().staff);
  const [expiryFilter, setExpiryFilter] = useState(getSaved().expiry);
  const [dateFilter, setDateFilter] = useState(getSaved().date || '');
  const [serviceFilter, setServiceFilter] = useState(getSaved().service || 'all');
  const [subcategoryFilter, setSubcategoryFilter] = useState(getSaved().subcategory || 'all');
  const [timeRange, setTimeRange] = useState('month');

  const [discoveredSub, setDiscoveredSub] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 50;

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedAadhaar, setDebouncedAadhaar] = useState('');

  const [globalStats, setGlobalStats] = useState({ total: 0, completed: 0, in_progress: 0, delayed: 0, pending: 0, sla_compliance: 100 });

  /* Keyboard shortcut ⌘K */
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCommandOpen(true); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(searchTerm), 400); return () => clearTimeout(t); }, [searchTerm]);
  useEffect(() => { const t = setTimeout(() => setDebouncedAadhaar(aadhaarSearch), 400); return () => clearTimeout(t); }, [aadhaarSearch]);
  useEffect(() => { setCurrentPage(1); },
    [debouncedSearch, debouncedAadhaar, statusFilter, staffFilter, expiryFilter, timeRange, dateFilter, serviceFilter, subcategoryFilter]);

  useEffect(() => {
    setDiscoveredSub(prev => {
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
    const cat = categories.find(c => c.id.toString() === serviceFilter.toString());
    if (cat && cat.subcategories) return cat.subcategories;
    if (discoveredSub[serviceFilter]) return Array.from(discoveredSub[serviceFilter], ([id, name]) => ({ id, name }));
    return [];
  }, [serviceFilter, categories, discoveredSub]);

  const transformBackendData = useCallback((data) => data.map((e) => {
    const totalCharge = parseFloat(e.total_charges || 0);
    const totalReceived = parseFloat(e.total_received || 0);
    const payments = e.payment_details_array || [];

    let paymentStatus = 'Pending';
    if (totalCharge <= 0) paymentStatus = 'Not Applicable';
    else if (totalReceived >= totalCharge) paymentStatus = 'Received';
    else if (totalReceived > 0) paymentStatus = 'Partial';

    const paymentDetailsStr = payments.length > 0
      ? payments.map(p => `${p.method === 'cash' ? 'Cash' : p.method === 'digital_wallet' ? 'Digital Wallet' : p.method}: ₹${Number(p.amount).toFixed(2)} (${p.status})`).join(', ')
      : 'No payments recorded';

    const cd = new Date(e.created_at || e.updated_at || Date.now());
    const dateStr = cd.toISOString().split('T')[0];
    const ud = new Date(e.updated_at || Date.now());
    const timeStr = ud.toTimeString().split(' ')[0].substring(0, 5);

    const progress = e.progress || calculateProgress(STATUS_MAP[e.status] || 'Pending', e.current_step || 'Submitted');
    const workSource = e.work_source || (e.customer_service_id ? 'online' : 'offline');

    return {
      id: e.id.toString(),
      serviceEntryId: e.service_entry_id?.toString(),
      trackingId: `TR-${e.id}`,
      applicationNumber: e.application_number || `APP${e.service_entry_id}`,
      customerName: e.customer_name || 'Unknown',
      customerPhone: e.phone || 'N/A',
      serviceType: e.service_name || 'Unknown',
      subcategoryName: e.subcategory_name || 'N/A',
      categoryId: e.category_id,
      subcategoryId: e.subcategory_id,
      staffName: e.assigned_to_name || 'Unassigned',
      assignedTo: e.assigned_to_name || 'Unassigned',
      assignedToId: e.assigned_to,
      serviceCharge: parseFloat(e.service_charges) || 0,
      departmentCharge: parseFloat(e.department_charges) || 0,
      totalCharge,
      cost: totalCharge,
      status: STATUS_MAP[e.status] || 'Pending',
      currentStep: e.current_step || 'Submitted',
      progress,
      priority: e.priority || 'medium',
      date: dateStr,
      time: timeStr,
      estimatedDelivery: e.estimated_delivery && !isNaN(new Date(e.estimated_delivery)) ? formatDate(e.estimated_delivery) : 'Not set',
      expiryDate: e.expiry_date && !isNaN(new Date(e.expiry_date)) ? new Date(e.expiry_date).toISOString() : 'N/A',
      createdAt: e.created_at || e.updated_at,
      updatedAt: e.updated_at,
      notes: e.notes || '',
      followUpRequired: e.status === 'rejected' || e.status === 'resubmit',
      paymentStatus,
      paymentDetails: paymentDetailsStr,
      payments,
      phone: e.phone || 'N/A',
      email: e.email || '',
      aadhaar: e.aadhaar || '',
      steps: Array.isArray(e.steps) ? e.steps.map(s => ({
        id: s.id, name: s.name, completed: s.completed, date: s.date,
        created_at: s.created_at, step_order: s.step_order, estimated_days: s.estimated_days
      })) : [],
      averageTime: e.average_time || '7 days',
      rawEstimatedDelivery: e.estimated_delivery,
      rawExpiryDate: e.expiry_date,
      workSource,
      serviceRating: e.service_rating,
      staffRating: e.staff_rating,
      reviewText: e.review_text,
      reviewSubmittedAt: e.submitted_at
    };
  }), []);

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
      const res = await getTrackingActivity(trackingId);
      setActivityHistory(Array.isArray(res?.activities) ? res.activities : []);
    } catch { setActivityHistory([]); }
    finally { setActivityLoading(false); }
  };

  const fetchDocuments = async (trackingId) => {
    if (!trackingId) { setDocuments([]); return; }
    try {
      setDocumentsLoading(true);
      const d = await getTrackingDocuments(trackingId);
      setDocuments(Array.isArray(d) ? d : []);
    } catch { setDocuments([]); }
    finally { setDocumentsLoading(false); }
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

      const [trackRes, staffRes, catRes] = await Promise.all([
        getTrackingEntries(params), getStaff(), getCategories()
      ]);

      if (trackRes?.pagination) {
        setTotalRecords(trackRes.pagination.totalRecords);
        setTotalPages(trackRes.pagination.totalPages);
      }

      const td = Array.isArray(trackRes?.data) ? trackRes.data : Array.isArray(trackRes) ? trackRes : [];
      const sd = Array.isArray(staffRes?.data) ? staffRes.data : Array.isArray(staffRes) ? staffRes : [];
      const cd = Array.isArray(catRes?.data) ? catRes.data : Array.isArray(catRes) ? catRes : [];

      setStaffList(sd); setCategories(cd);

      let transformed = transformBackendData(td);
      if (serviceFilter !== 'all') transformed = transformed.filter(s => String(s.categoryId) === String(serviceFilter));
      if (subcategoryFilter !== 'all') transformed = transformed.filter(s => String(s.subcategoryId) === String(subcategoryFilter));

      setServices(transformed);
      return transformed;
    } catch (err) {
      console.error(err); toast.error('Failed to fetch data');
      setStaffList([]); setCategories([]);
      return [];
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [transformed] = await Promise.all([fetchAllTrackingEntries(), fetchStats()]);
        if (id && transformed) {
          const found = transformed.find(s => s.id === id);
          if (found) await handleServiceSelect(found, true);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    init();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const reload = async () => {
      try { await Promise.all([fetchAllTrackingEntries(), fetchStats()]); }
      catch (e) { console.error(e); }
    };
    reload();
    // eslint-disable-next-line
  }, [currentPage, debouncedSearch, debouncedAadhaar, statusFilter, staffFilter, expiryFilter, timeRange, dateFilter, serviceFilter, subcategoryFilter]);

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
    } catch (e) {
      console.error(e); toast.error('Failed to update status');
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

      if (updates.currentStep !== undefined && service.currentStep !== updates.currentStep) {
        const targetOrder = STEP_ORDER_MAP[updates.currentStep] || 1;
        const nowIso = new Date().toISOString();
        if (service.steps?.length > 0) {
          updates.steps = service.steps.map(step => {
            const order = STEP_ORDER_MAP[step.name] || step.step_order || 1;
            if (order <= targetOrder) {
              return { ...step, completed: true, date: (order === targetOrder) ? nowIso : (step.date || service.createdAt) };
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
    } catch (e) {
      console.error(e); toast.error('Failed to save');
    }
  };

  const handleNotifyCustomer = async (service) => {
    try {
      await notifyCustomer(service.id, `Dear ${service.customerName}, your ${service.serviceType} application (App No: ${service.applicationNumber || 'N/A'}) is now ${service.status}.`);
      toast.success(`Notification sent to ${service.customerName}`);
    } catch (e) { console.error(e); toast.error('Failed to send'); }
  };

  const handleUploadDocument = async (trackingId, file, label, visible) => {
    try {
      setUploadingDocument(true);
      const fd = new FormData();
      fd.append('file', file); fd.append('label', label);
      fd.append('visible_to_customer', visible ? 'true' : 'false');
      await uploadTrackingDocument(trackingId, fd);
      await fetchDocuments(trackingId);
      toast.success('Document uploaded');
    } catch (e) { console.error(e); toast.error('Upload failed'); }
    finally { setUploadingDocument(false); }
  };

  const handleToggleDocumentVisibility = async (trackingId, docId, visible) => {
    try {
      await toggleTrackingDocumentVisibility(trackingId, docId, visible);
      await fetchDocuments(trackingId);
      toast.success(visible ? 'Visible to customer' : 'Hidden');
    } catch (e) { console.error(e); toast.error('Update failed'); }
  };

  const handleDeleteDocument = async (trackingId, docId) => {
    try {
      await deleteTrackingDocument(trackingId, docId);
      await fetchDocuments(trackingId);
      toast.success('Deleted');
    } catch (e) { console.error(e); toast.error('Delete failed'); }
  };

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
    let t = transformBackendData(data);
    if (serviceFilter !== 'all') t = t.filter(s => String(s.categoryId) === String(serviceFilter));
    if (subcategoryFilter !== 'all') t = t.filter(s => String(s.subcategoryId) === String(subcategoryFilter));
    return t;
  };

  const handleExportExcel = async () => {
    try {
      if (totalRecords === 0) return toast.info('No data to export');
      toast.info('Preparing Excel…', { autoClose: 1500 });
      const data = await fetchAllFilteredDataForExport();
      const rows = data.map(s => ({
        'App No': s.applicationNumber, 'Customer': s.customerName, 'Phone': s.phone, 'Email': s.email,
        'Service': s.serviceType, 'Subcategory': s.subcategoryName, 'Status': s.status,
        'Step': s.currentStep, 'Priority': s.priority, 'Assigned': s.assignedTo,
        'Created': s.date, 'Est. Delivery': s.estimatedDelivery,
        'Service Charge': s.serviceCharge, 'Dept Charge': s.departmentCharge,
        'Total': s.totalCharge, 'Payment': s.paymentStatus
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tracking');
      XLSX.writeFile(wb, `Service_Tracking_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel exported');
    } catch (e) { console.error(e); toast.error('Export failed'); }
  };

  const handleExportPDF = async () => {
    try {
      if (totalRecords === 0) return toast.info('No data to export');
      toast.info('Generating PDF…', { autoClose: 1500 });
      const data = await fetchAllFilteredDataForExport();
      const doc = new jsPDF('landscape');
      doc.setFontSize(15);
      doc.text('Service Tracking Report', 14, 15);
      doc.setFontSize(9); doc.setTextColor(120);
      doc.text(`Generated: ${new Date().toLocaleDateString()} | Records: ${data.length}`, 14, 22);
      autoTable(doc, {
        head: [['App No', 'Customer', 'Phone', 'Service', 'Status', 'Step', 'Assigned', 'Total']],
        body: data.map(s => [s.applicationNumber, s.customerName, s.phone, s.serviceType, s.status, s.currentStep, s.assignedTo, `Rs ${s.totalCharge || 0}`]),
        startY: 28, styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 23, 42] }, alternateRowStyles: { fillColor: [248, 250, 252] }
      });
      doc.save(`Service_Tracking_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF exported');
    } catch (e) { console.error(e); toast.error('Export failed'); }
  };

  const handleCommandAction = (action) => {
    if (action === 'excel') handleExportExcel();
    else if (action === 'pdf') handleExportPDF();
    else if (action === 'refresh') window.location.reload();
    else if (action.startsWith('filter:')) setStatusFilter(action.split(':')[1]);
  };

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

  const handleSaveView = () => {
    localStorage.setItem('staffServiceSavedView', JSON.stringify({
      status: statusFilter, staff: staffFilter, expiry: expiryFilter,
      date: dateFilter, service: serviceFilter, subcategory: subcategoryFilter
    }));
    toast.success('View saved');
  };

  /* Group services by date for table */
  const servicesByDate = useMemo(() => services.reduce((g, s) => {
    const k = s.date || 'Unknown Date';
    if (!g[k]) g[k] = [];
    g[k].push(s);
    return g;
  }, {}), [services]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Loading services…</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50">

        {/* ================= HEADER ================= */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-gradient-to-br from-slate-900 to-slate-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <FiTarget className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-slate-900 leading-tight">Service Tracking</h1>
                  <p className="text-xs text-slate-500">Track, edit and manage applications</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setCommandOpen(true)}
                  className="hidden md:flex items-center gap-2 w-64 px-3 py-2 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-white transition-all">
                  <FiSearch className="h-3.5 w-3.5" />
                  <span className="text-xs flex-1 text-left">Search everything…</span>
                  <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-white rounded border border-slate-200 font-mono text-slate-500">
                    <FiCommand className="h-2.5 w-2.5" />K
                  </kbd>
                </button>

                <button onClick={() => setCommandOpen(true)}
                  className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                  <FiSearch className="h-4 w-4" />
                </button>

                {id && (
                  <button onClick={() => navigate('/dashboard/staff/track_service')}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                    <FiArrowLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                )}

                <button onClick={handleExportExcel}
                  className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                  <FiDownload className="h-3.5 w-3.5" />
                  Export
                </button>

                <button onClick={() => window.location.reload()}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm">
                  <FiRefreshCw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6 space-y-6">

          {/* ================= KPI CARDS ================= */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard label="Total Services" value={globalStats.total || 0} icon={FiLayers} accent="indigo" trend={12} />
            <KpiCard label="In Progress" value={globalStats.in_progress || 0} icon={FiActivity} accent="blue" trend={8} />
            <KpiCard label="Completed" value={globalStats.completed || 0} icon={FiCheckCircle} accent="emerald" trend={15} />
            <KpiCard label="Delayed" value={globalStats.delayed || 0} icon={FiAlertCircle} accent="rose" trend={-3} />
            <KpiCard label="SLA Compliance" value={`${Math.round(globalStats.sla_compliance || 100)}%`} icon={FiAward} accent="violet" trend={2} />
          </div>

          {/* ================= FILTER BAR ================= */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search by name, phone, app no, Aadhaar…"
                    className="w-full pl-9 pr-9 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white transition-all" />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-200 text-slate-400">
                      <FiX className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                  <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</FilterChip>
                  <FilterChip active={statusFilter === 'Pending'} onClick={() => setStatusFilter('Pending')} dot="bg-amber-500">Pending</FilterChip>
                  <FilterChip active={statusFilter === 'In Progress'} onClick={() => setStatusFilter('In Progress')} dot="bg-blue-500">Active</FilterChip>
                  <FilterChip active={statusFilter === 'Completed'} onClick={() => setStatusFilter('Completed')} dot="bg-emerald-500">Done</FilterChip>
                  <FilterChip active={statusFilter === 'Delayed'} onClick={() => setStatusFilter('Delayed')} dot="bg-rose-500">Delayed</FilterChip>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(activeFiltersCount > 0 || searchTerm) && (
                  <button onClick={handleClearFilters}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2.5 py-1.5">
                    Clear
                  </button>
                )}
                <button onClick={handleSaveView}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                  <FiSave className="h-3.5 w-3.5" />
                  Save view
                </button>
                <button onClick={() => setFiltersOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm">
                  <FiSliders className="h-3.5 w-3.5" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-white text-slate-900 rounded-full">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ================= TABLE ================= */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3 font-semibold w-[280px]">Customer</th>
                    <th className="px-4 py-3 font-semibold">Service</th>
                    <th className="px-4 py-3 font-semibold w-[180px]">Application</th>
                    <th className="px-4 py-3 font-semibold w-[160px]">Status</th>
                    <th className="px-4 py-3 font-semibold w-[200px]">Assignment</th>
                    <th className="px-4 py-3 font-semibold w-[140px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(servicesByDate).map(([date, dateServices]) => (
                    <React.Fragment key={date}>
                      <tr className="bg-slate-50/70">
                        <td colSpan={6} className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <FiCalendar className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs font-bold text-slate-700">
                              {date === 'Unknown Date' ? date : formatDate(date)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              · {dateServices.length} {dateServices.length === 1 ? 'entry' : 'entries'}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {dateServices.map(service => (
                        <React.Fragment key={service.id}>
                          <tr className={`border-b border-slate-100 transition-colors ${
                            selectedService?.id === service.id ? 'bg-indigo-50/40' : 'hover:bg-slate-50/70'
                          }`}>
                            {/* Customer */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="relative flex-shrink-0">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                                    <FiUser className="h-4 w-4 text-white" />
                                  </div>
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${STATUS_CONFIG[service.status]?.dot || 'bg-slate-400'}`} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 truncate">{service.customerName}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-slate-500 truncate">{service.phone}</span>
                                    <SourceBadge source={service.workSource} />
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Service */}
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-slate-900 truncate">{service.serviceType}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-slate-500 truncate">{service.subcategoryName}</span>
                                <PriorityPill priority={service.priority} />
                              </div>
                            </td>

                            {/* Application */}
                            <td className="px-4 py-3">
                              <InlineEdit
                                value={service.applicationNumber || ''}
                                placeholder="Set app no"
                                onSave={v => handleInlineTrackingUpdate(service, { applicationNumber: v })}
                                className="text-xs font-mono"
                              />
                              <div className="mt-1 px-1.5">
                                <span className="text-[10px] text-slate-400">ID · {service.trackingId}</span>
                              </div>
                            </td>

                            {/* Status + Step */}
                            <td className="px-4 py-3">
                              <div className="space-y-1.5">
                                <select
                                  value={service.status}
                                  onChange={e => handleUpdateStatus(service.id, e.target.value)}
                                  className={`w-full text-xs font-semibold rounded-md px-2 py-1.5 border outline-none cursor-pointer transition-all ${
                                    STATUS_CONFIG[service.status]?.bg
                                  } ${STATUS_CONFIG[service.status]?.color} ${STATUS_CONFIG[service.status]?.border}`}>
                                  {Object.keys(STATUS_CONFIG).map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                                <InlineEdit
                                  value={service.currentStep || 'Submitted'}
                                  options={STEP_OPTIONS}
                                  onSave={v => handleInlineTrackingUpdate(service, { currentStep: v })}
                                  className="text-xs text-slate-600"
                                />
                              </div>
                            </td>

                            {/* Assignment */}
                            <td className="px-4 py-3">
                              <div className="space-y-1.5">
                                <InlineEdit
                                  value={service.assignedToId || ''}
                                  displayValue={service.assignedTo}
                                  options={staffList.map(s => ({ value: s.id, label: s.name }))}
                                  placeholder="Unassigned"
                                  onSave={v => handleInlineTrackingUpdate(service, { assignedTo: v })}
                                  icon={FiUserCheck}
                                  className="text-xs"
                                />
                                <InlineEdit
                                  value={formatDateForInput(service.rawEstimatedDelivery)}
                                  displayValue={service.estimatedDelivery}
                                  type="date"
                                  onSave={v => handleInlineTrackingUpdate(service, { estimatedDelivery: v })}
                                  icon={FiCalendar}
                                  className="text-xs text-slate-600"
                                />
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handleNotifyCustomer(service)}
                                  title="Notify customer"
                                  className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                                  <FiSend className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (selectedService?.id === service.id) {
                                      setSelectedService(null);
                                      navigate('/dashboard/staff/track_service', { replace: true });
                                    } else {
                                      handleServiceSelect(service, true);
                                    }
                                  }}
                                  title={selectedService?.id === service.id ? 'Collapse' : 'Expand'}
                                  className={`p-2 rounded-lg transition-colors ${
                                    selectedService?.id === service.id
                                      ? 'bg-indigo-100 text-indigo-700'
                                      : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                                  }`}>
                                  <FiChevronDown className={`h-3.5 w-3.5 transform transition-transform duration-200 ${
                                    selectedService?.id === service.id ? 'rotate-180' : ''
                                  }`} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded detail row */}
                          {selectedService?.id === service.id && (
                            <tr>
                              <td colSpan={6} className="p-0 bg-slate-50/60">
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden border-y border-indigo-100">
                                  <div className="p-6">
                                    <DetailView
                                      service={selectedService}
                                      activeTab={activeTab}
                                      setActiveTab={setActiveTab}
                                      staffList={staffList}
                                      documents={documents}
                                      documentsLoading={documentsLoading}
                                      uploadingDocument={uploadingDocument}
                                      activityHistory={activityHistory}
                                      activityLoading={activityLoading}
                                      onNotify={handleNotifyCustomer}
                                      onUpdateStatus={handleUpdateStatus}
                                      onInlineUpdate={handleInlineTrackingUpdate}
                                      onUpload={(f, l, v) => handleUploadDocument(selectedService.id, f, l, v)}
                                      onToggleVisibility={(d, v) => handleToggleDocumentVisibility(selectedService.id, d, v)}
                                      onDeleteDoc={(d) => handleDeleteDocument(selectedService.id, d)}
                                      onClose={() => { setSelectedService(null); navigate('/dashboard/staff/track_service', { replace: true }); }}
                                    />
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </React.Fragment>
                  ))}

                  {services.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState icon={FiInbox} title="No services found" message="Try adjusting your filters or search terms." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                <span className="text-xs text-slate-500">
                  Showing <span className="font-semibold text-slate-700">{services.length}</span> of <span className="font-semibold text-slate-700">{totalRecords}</span>
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    Previous
                  </button>
                  <span className="px-3 text-xs text-slate-500">
                    Page <span className="font-semibold text-slate-700">{currentPage}</span> of {totalPages}
                  </span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
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
            <FiltersDrawer
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              staffList={staffList}
              categories={categories}
              availableSubcategories={availableSubcategories}
              values={{ timeRange, dateFilter, serviceFilter, subcategoryFilter, staffFilter, expiryFilter, aadhaarSearch }}
              setValues={(v) => {
                setTimeRange(v.timeRange);
                setDateFilter(v.dateFilter);
                setServiceFilter(v.serviceFilter);
                setSubcategoryFilter(v.subcategoryFilter);
                setStaffFilter(v.staffFilter);
                setExpiryFilter(v.expiryFilter);
                setAadhaarSearch(v.aadhaarSearch);
              }}
              onClear={handleClearFilters}
            />
          )}
        </AnimatePresence>

        <style>{`
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
        `}</style>
      </div>
    </ErrorBoundary>
  );
};

/* ============================================================
   DETAIL VIEW
   ============================================================ */

const DETAIL_TABS = [
  { id: 'overview', label: 'Overview', icon: FiLayers },
  { id: 'documents', label: 'Documents', icon: FiPaperclip },
  { id: 'history', label: 'History', icon: FiClock },
  { id: 'discussion', label: 'Discussion', icon: FiMessageCircle }
];

const DetailView = ({
  service, activeTab, setActiveTab, staffList, documents, documentsLoading,
  uploadingDocument, activityHistory, activityLoading,
  onNotify, onUpdateStatus, onInlineUpdate, onUpload, onToggleVisibility, onDeleteDoc, onClose
}) => {
  const displaySteps = useMemo(() => {
    if (service.steps?.length > 0) return [...service.steps].sort((a, b) => (a.step_order || 0) - (b.step_order || 0));
    const cur = STEP_ORDER_MAP[service.currentStep] || 1;
    return [
      { id: 1, name: 'Submitted', completed: true, step_order: 1, date: service.createdAt },
      { id: 2, name: 'Initial Review', completed: cur >= 2, step_order: 2, date: cur === 2 ? service.updatedAt : null },
      { id: 3, name: 'Document Verification', completed: cur >= 3, step_order: 3, date: cur === 3 ? service.updatedAt : null },
      { id: 4, name: 'Final Approval', completed: cur >= 4, step_order: 4, date: cur >= 4 ? service.updatedAt : null }
    ];
  }, [service]);

  return (
    <div className="space-y-5">
      {/* Sub-header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <FiUser className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 truncate">{service.customerName}</h2>
              <StatusPill status={service.status} />
              <PriorityPill priority={service.priority} />
              {service.followUpRequired && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  <FiAlertCircle className="h-2.5 w-2.5" /> Follow-up
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1"><FiPhoneCall className="h-3 w-3" />{service.phone}</span>
              {service.email && <span className="flex items-center gap-1"><FiMail className="h-3 w-3" />{service.email}</span>}
              {service.aadhaar && <span className="flex items-center gap-1"><FiCreditCard className="h-3 w-3" />{service.aadhaar}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => onNotify(service)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm">
            <FiSend className="h-3.5 w-3.5" /> Notify Customer
          </button>
          <button onClick={() => { window.location.href = `/dashboard/staff/service-workspace/${service.id}`; }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <FiGrid className="h-3.5 w-3.5" /> Workspace
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <FiX className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 -mt-1 pb-0">
        {DETAIL_TABS.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {active && (
                <motion.div layoutId="detail-tab-underline"
                  className="absolute -bottom-px left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}>
          {activeTab === 'overview' && (
            <OverviewTab service={service} staffList={staffList} displaySteps={displaySteps}
              onUpdateStatus={onUpdateStatus} onInlineUpdate={onInlineUpdate} />
          )}
          {activeTab === 'documents' && (
            <DocumentsTab documents={documents} loading={documentsLoading} uploading={uploadingDocument}
              onUpload={onUpload} onToggleVisibility={onToggleVisibility} onDelete={onDeleteDoc} />
          )}
          {activeTab === 'history' && (
            <HistoryTab activityHistory={activityHistory} loading={activityLoading} />
          )}
          {activeTab === 'discussion' && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FiMessageCircle className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">Internal Discussion & Tasks</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">Tag staff using @ to assign tasks.</p>
              <div className="bg-white rounded-xl p-2 sm:p-4 border border-slate-200">
                <NotesPanel contextType="service_entry" contextId={service.serviceEntryId} embedded showHeader={false} />
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

/* ============================================================
   OVERVIEW TAB
   ============================================================ */

const OverviewTab = ({ service, staffList, displaySteps, onUpdateStatus, onInlineUpdate }) => {
  const update = (u) => onInlineUpdate(service, u);

  return (
    <div className="space-y-5">
      {/* Progress + Status bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FiZap className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Progress</h3>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {service.workSource === 'online' ? 'Online booking' : 'Walk-in'}
            </span>
          </div>
          <span className="text-lg font-bold text-indigo-600">{service.progress}%</span>
        </div>

        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-5">
          <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
            initial={{ width: 0 }} animate={{ width: `${service.progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }} />
        </div>

        {/* Timeline */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {displaySteps.map((step, i) => (
            <div key={step.id || i}
              className={`relative px-3 py-2.5 rounded-lg border text-xs transition-all ${
                step.completed ? 'bg-emerald-50 border-emerald-200'
                : step.name === service.currentStep ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/10'
                : 'bg-slate-50 border-slate-200'
              }`}>
              <div className="flex items-center gap-1.5 mb-1">
                {step.completed ? (
                  <FiCheckCircle className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                ) : step.name === service.currentStep ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500 flex items-center justify-center flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  </span>
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 flex-shrink-0" />
                )}
                <span className={`font-semibold truncate ${
                  step.completed ? 'text-emerald-800'
                  : step.name === service.currentStep ? 'text-indigo-800'
                  : 'text-slate-500'
                }`}>{step.name}</span>
              </div>
              <p className="text-[10px] text-slate-500 truncate pl-[20px]">
                {step.date ? formatTimelineDate(step.date) : 'Pending'}
              </p>
            </div>
          ))}
        </div>

        {/* Status update */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Update Status</p>
          <div className="flex items-center flex-wrap gap-1.5">
            {Object.keys(STATUS_CONFIG).map(key => {
              const isCur = service.status === key;
              const c = STATUS_CONFIG[key];
              return (
                <button key={key} onClick={() => !isCur && onUpdateStatus(service.id, key)}
                  disabled={isCur}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    isCur
                      ? `${c.bg} ${c.color} ${c.border} cursor-default`
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}>
                  {isCur && <FiCheck className="inline h-3 w-3 mr-1 -mt-0.5" />}
                  {key}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid: Details + Financial */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Service details */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiEdit className="h-3.5 w-3.5 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">Details</h3>
            </div>
            <span className="text-[10px] text-slate-400 italic">Click to edit</span>
          </div>
          <div className="divide-y divide-slate-50">
            <InfoRow label="Application No">
              <InlineEdit value={service.applicationNumber || ''} placeholder="Not set"
                onSave={v => update({ applicationNumber: v })} className="text-sm" />
            </InfoRow>
            <InfoRow label="Service">
              <span className="text-sm font-medium text-slate-800">{service.serviceType}</span>
            </InfoRow>
            <InfoRow label="Subcategory">
              <span className="text-sm text-slate-700">{service.subcategoryName}</span>
            </InfoRow>
            <InfoRow label="Current Step">
              <InlineEdit value={service.currentStep} options={STEP_OPTIONS}
                onSave={v => update({ currentStep: v })} className="text-sm" />
            </InfoRow>
            <InfoRow label="Assigned To">
              <InlineEdit value={service.assignedToId || ''} displayValue={service.assignedTo}
                options={staffList.map(s => ({ value: s.id, label: s.name }))}
                placeholder="Unassigned" onSave={v => update({ assignedTo: v })} className="text-sm" />
            </InfoRow>
            <InfoRow label="Priority">
              <InlineEdit value={service.priority} displayValue={PRIORITY_CONFIG[service.priority]?.label}
                options={PRIORITY_OPTIONS} onSave={v => update({ priority: v })} className="text-sm" />
            </InfoRow>
            <InfoRow label="Est. Delivery">
              <InlineEdit value={formatDateForInput(service.rawEstimatedDelivery)}
                displayValue={service.estimatedDelivery} type="date"
                onSave={v => update({ estimatedDelivery: v })} className="text-sm" />
            </InfoRow>
            <InfoRow label="Avg Time">
              <InlineEdit value={service.averageTime} placeholder="Not set"
                onSave={v => update({ averageTime: v })} className="text-sm" />
            </InfoRow>
            <InfoRow label="Aadhaar">
              <InlineEdit value={service.aadhaar} placeholder="Not set"
                onSave={v => update({ aadhaar: v })} className="text-sm" />
            </InfoRow>
            <InfoRow label="Email">
              <InlineEdit value={service.email} type="email" placeholder="Not set"
                onSave={v => update({ email: v })} className="text-sm" />
            </InfoRow>
            <InfoRow label="Notes" align="start">
              <InlineEdit value={service.notes} placeholder="No notes"
                onSave={v => update({ notes: v })} className="text-sm" />
            </InfoRow>
          </div>
        </div>

        {/* Financial + review */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiDollarSign className="h-3.5 w-3.5 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-900">Financials</h3>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                PAYMENT_STATUS_CONFIG[service.paymentStatus]?.bg || 'bg-slate-100'
              } ${PAYMENT_STATUS_CONFIG[service.paymentStatus]?.color || 'text-slate-600'}`}>
                {service.paymentStatus}
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Service Charge</span>
                <span className="text-sm font-medium text-slate-900 font-mono">₹{service.serviceCharge?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Department Charge</span>
                <span className="text-sm font-medium text-slate-900 font-mono">₹{service.departmentCharge?.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Total</span>
                <span className="text-lg font-bold text-indigo-600 font-mono">₹{service.totalCharge?.toFixed(2)}</span>
              </div>
              {service.paymentDetails && service.paymentDetails !== 'No payments recorded' && (
                <div className="bg-slate-50 rounded-lg p-3 mt-1">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Payment Records</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{service.paymentDetails}</p>
                </div>
              )}
            </div>
          </div>

          {service.serviceRating && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <FiStar className="h-3.5 w-3.5 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900">Customer Review</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Service Rating</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <FiStar key={i} className={`h-3.5 w-3.5 ${i <= service.serviceRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                    ))}
                    <span className="text-xs text-slate-500 ml-1.5">({service.serviceRating}/5)</span>
                  </div>
                </div>
                {service.staffRating && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Staff Rating</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <FiStar key={i} className={`h-3.5 w-3.5 ${i <= service.staffRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                      ))}
                      <span className="text-xs text-slate-500 ml-1.5">({service.staffRating}/5)</span>
                    </div>
                  </div>
                )}
                {service.reviewText && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-700 italic leading-relaxed">"{service.reviewText}"</p>
                    {service.reviewSubmittedAt && (
                      <p className="text-[10px] text-slate-400 mt-2">— {formatDate(service.reviewSubmittedAt)}</p>
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

const InfoRow = ({ label, children, align = 'center' }) => (
  <div className={`flex ${align === 'start' ? 'items-start' : 'items-center'} justify-between gap-3 px-4 py-2.5 hover:bg-slate-50/60 transition-colors`}>
    <span className="text-xs text-slate-500 flex-shrink-0 pt-0.5">{label}</span>
    <div className="min-w-0 flex-1 flex justify-end">{children}</div>
  </div>
);

/* ============================================================
   DOCUMENTS TAB
   ============================================================ */

const DocumentsTab = ({ documents = [], loading, uploading, onUpload, onToggleVisibility, onDelete }) => {
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState('');
  const [visible, setVisible] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    if (!file || !label.trim()) return toast.error('Enter label and choose file');
    onUpload(file, label.trim(), visible);
    setFile(null); setLabel(''); setVisible(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Upload card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FiUpload className="h-3.5 w-3.5 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900">Upload New Document</h3>
        </div>
        <form onSubmit={submit} className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Document Label <span className="text-rose-500">*</span></label>
              <input value={label} onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Income Certificate"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500" />
            </div>
            <div className="lg:col-span-5">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">File <span className="text-rose-500">*</span></label>
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
                    <FiFileText className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm text-slate-800 truncate flex-1">{file.name}</span>
                    <span className="text-xs text-slate-500">{formatBytes(file.size)}</span>
                  </>
                ) : (
                  <>
                    <FiUpload className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500 truncate flex-1">{drag ? 'Drop file here' : 'Click or drag file'}</span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">PDF · DOC · IMG</span>
                  </>
                )}
              </div>
            </div>
            <div className="lg:col-span-3 flex flex-col">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Visibility</label>
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
                    <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading</>
                  ) : (
                    <><FiUpload className="h-3.5 w-3.5" /> Upload</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Documents table */}
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
                  const { Icon, color, bg } = fileIconFor(doc.file_name || doc.label || '');
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
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${
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
   HISTORY TAB
   ============================================================ */

const HistoryTab = ({ activityHistory, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-sm text-slate-500">Loading history…</span>
      </div>
    );
  }
  if (!activityHistory?.length) {
    return <EmptyState icon={FiClock} title="No activity yet" message="Activity will appear here as changes are made." />;
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Activity Timeline</h3>
        <span className="text-xs text-slate-500">{activityHistory.length} event{activityHistory.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="relative">
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-slate-200" />
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