//superadmin - and admin have separate service logs
//src/[admin|superadmin]/pages/[Superadmin/admin]ServiceLogs.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FiSearch, FiDownload, FiEye, FiMessageSquare, FiClock, FiUser, FiDollarSign,
  FiCheckCircle, FiAlertCircle, FiRefreshCw, FiFileText, FiTrendingUp,
  FiBarChart2, FiCalendar, FiShoppingBag, FiX, FiStar, FiList, FiGrid, FiUsers,
  FiUserCheck, FiSliders, FiCopy, FiMapPin, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import { getTrackingEntries, updateTrackingStatus, notifyCustomer, getTrackingStats, getStaff, getCategories } from '/src/services/serviceService';

// ==========================================
// HELPERS (all dates in IST)
// ==========================================
const IST = 'Asia/Kolkata';

const istYmd = (value) => {
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { timeZone: IST });
};
const istTime = (value) => {
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit' });
};
const formatYmd = (ymd) => {
  if (!ymd) return '-';
  const d = new Date(`${ymd}T00:00:00Z`);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const formatDateTime = (value) => {
  const d = new Date(value);
  if (!value || isNaN(d.getTime())) return 'Not set';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: IST }).replace(',', '');
};
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ==========================================
// STATIC CONFIGURATIONS
// ==========================================
const statusMap = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  rejected: 'Delayed',
  resubmit: 'Resubmit',
  paid: 'Paid',
};
const reverseStatusMap = Object.fromEntries(Object.entries(statusMap).map(([k, v]) => [v, k]));

const statusConfig = {
  Pending: { chip: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-400' },
  'In Progress': { chip: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  Delayed: { chip: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
  Completed: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  Resubmit: { chip: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-400' },
  Paid: { chip: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500' },
};

const paymentStatusConfig = {
  'Not Applicable': 'bg-slate-50 text-slate-600 ring-slate-200',
  Received: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Partial: 'bg-amber-50 text-amber-700 ring-amber-200',
  Pending: 'bg-rose-50 text-rose-700 ring-rose-200',
  Processing: 'bg-sky-50 text-sky-700 ring-sky-200',
};

const priorityConfig = {
  low: { label: 'Low', text: 'text-emerald-600', dot: 'bg-emerald-500', rank: 1 },
  medium: { label: 'Medium', text: 'text-amber-600', dot: 'bg-amber-400', rank: 2 },
  high: { label: 'High', text: 'text-rose-600', dot: 'bg-rose-500', rank: 3 },
};

const DATE_OPTIONS = [
  ['all', 'All time'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['this_week', 'Last 7 days'],
  ['this_month', 'Last 30 days'], ['last_3_months', 'Last 3 months'], ['last_6_months', 'Last 6 months'],
  ['1_year', 'Past 1 year'], ['custom', 'Custom range…'],
];

const DEFAULT_FILTERS = {
  status: 'all', staff: 'all', priority: 'all', centre: 'all', service: 'all', subcategory: 'all',
  dateRange: 'today', customStart: '', customEnd: '', reviewed: 'all',
};

const LIMIT = 50;

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40 disabled:bg-slate-50 disabled:text-slate-400';

// ==========================================
// SMALL UI PIECES
// ==========================================
const StatusChip = ({ status }) => {
  const s = statusConfig[status] || statusConfig.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
};

const PriorityLabel = ({ priority }) => {
  const p = priorityConfig[priority] || priorityConfig.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${p.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  );
};

const SourceTag = ({ source }) => (
  <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${source === 'online' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
    {source === 'online' ? 'Online' : 'Walk-in'}
  </span>
);

const Rating = ({ value }) =>
  value ? (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600">
      <FiStar className="h-3 w-3 fill-amber-400 text-amber-400" />
      {value}/5
    </span>
  ) : null;

const ProgressBar = ({ pct, className = 'bg-navy-500', h = 'h-1.5' }) => (
  <div className={`w-full overflow-hidden rounded-full bg-slate-100 ${h}`}>
    <div className={`${h} rounded-full transition-all ${className}`} style={{ width: `${Math.min(100, Math.max(0, pct || 0))}%` }} />
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('SuperadminServiceLogs error boundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
              <FiAlertCircle className="h-7 w-7 text-rose-600" />
            </div>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Something went wrong</h2>
            <p className="mb-5 text-sm text-slate-500">There was an error showing the service logs. Please refresh the page.</p>
            <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-navy-700 px-5 py-2 text-sm font-medium text-white hover:bg-navy-800">
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================
// INSIGHTS (light-weight, no chart library)
// ==========================================
const StatusDonut = ({ stats }) => {
  const total = Number(stats.total) || 0;
  const segs = [
    { key: 'completed', label: 'Completed', value: Number(stats.completed) || 0, color: '#10b981' },
    { key: 'in_progress', label: 'In progress', value: Number(stats.in_progress) || 0, color: '#38bdf8' },
    { key: 'pending', label: 'Pending', value: Number(stats.pending) || 0, color: '#fbbf24' },
    { key: 'delayed', label: 'Follow-up', value: Number(stats.delayed) || 0, color: '#fb7185' },
  ];
  const other = Math.max(0, total - segs.reduce((n, s) => n + s.value, 0));
  if (other > 0) segs.push({ key: 'other', label: 'Other', value: other, color: '#cbd5e1' });
  const visible = segs.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 0.6 : 0;
  let acc = 0;
  const arcs = visible.map((s) => {
    const pct = total ? (s.value / total) * 100 : 0;
    const arc = { ...s, pct, offset: 25 - acc };
    acc += pct;
    return arc;
  });
  const rate = total ? Math.round(((Number(stats.completed) || 0) / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-800">Status split</h3>
      <p className="text-xs text-slate-400">All records matching the filters</p>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 36 36" className="h-full w-full" role="img" aria-label={`${rate}% of ${total} services completed`}>
            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="4.5" />
            {arcs.map((a) => (
              <circle
                key={a.key} cx="18" cy="18" r="15.9155" fill="none" stroke={a.color} strokeWidth="4.5"
                strokeDasharray={`${Math.max(0, a.pct - gap)} ${100 - a.pct + gap}`} strokeDashoffset={a.offset}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tabular-nums text-slate-900">{rate}%</span>
            <span className="text-[10px] text-slate-500">completed</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {segs.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
              <span className="font-semibold tabular-nums text-slate-800">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const StaffWorkload = ({ services }) => {
  const rows = useMemo(() => {
    const m = {};
    services.forEach((s) => {
      const k = s.staffName || 'Unassigned';
      if (!m[k]) m[k] = { name: k, total: 0, done: 0, active: 0, pending: 0 };
      m[k].total += 1;
      if (s.status === 'Completed' || s.status === 'Paid') m[k].done += 1;
      else if (s.status === 'In Progress') m[k].active += 1;
      else if (s.status === 'Pending') m[k].pending += 1;
    });
    return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [services]);
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-800">Staff workload</h3>
      <p className="text-xs text-slate-400">On this page</p>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No data</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((r) => (
            <li key={r.name} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_1.75rem] items-center gap-x-3">
              <span className="truncate text-sm text-slate-700" title={r.name}>{r.name}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" title={`${r.done} done · ${r.active} in progress · ${r.pending} pending`}>
                <div className="flex h-full overflow-hidden rounded-full" style={{ width: `${(r.total / max) * 100}%` }}>
                  <div className="bg-emerald-500" style={{ width: `${(r.done / r.total) * 100}%` }} />
                  <div className="bg-sky-400" style={{ width: `${(r.active / r.total) * 100}%` }} />
                  <div className="bg-amber-400" style={{ width: `${(r.pending / r.total) * 100}%` }} />
                </div>
              </div>
              <span className="text-right text-sm font-semibold tabular-nums text-slate-700">{r.total}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const TopServices = ({ services }) => {
  const rows = useMemo(() => {
    const m = {};
    services.forEach((s) => { const k = s.serviceType || 'Unknown'; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort(([, a], [, b]) => b - a).slice(0, 6);
  }, [services]);
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-800">Top services</h3>
      <p className="text-xs text-slate-400">On this page</p>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No data</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map(([name, n]) => (
            <li key={name} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_1.75rem] items-center gap-x-3">
              <span className="truncate text-sm text-slate-700" title={name}>{name}</span>
              <ProgressBar pct={(n / max) * 100} h="h-2.5" />
              <span className="text-right text-sm font-semibold tabular-nums text-slate-700">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ==========================================
// LIST ITEMS (defined outside the page so they do not remount on every render)
// ==========================================
const ServiceRow = ({ service, onOpen }) => (
  <tr onClick={() => onOpen(service)} className="cursor-pointer transition-colors hover:bg-slate-50/80">
    <td className="px-4 py-3">
      <p className="max-w-[170px] truncate text-sm font-medium text-slate-900" title={service.customerName}>{service.customerName}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="max-w-[110px] truncate font-mono text-xs text-slate-400" title={service.applicationNumber}>{service.applicationNumber}</span>
        <SourceTag source={service.workSource} />
        <Rating value={service.serviceRating} />
      </div>
    </td>
    <td className="px-4 py-3">
      <p className="max-w-[160px] truncate text-sm text-slate-800" title={service.serviceType}>{service.serviceType}</p>
      <p className="max-w-[160px] truncate text-xs text-slate-400" title={service.subcategoryName}>{service.subcategoryName}</p>
    </td>
    <td className="px-4 py-3"><p className="max-w-[120px] truncate text-sm text-slate-700" title={service.centreName}>{service.centreName}</p></td>
    <td className="px-4 py-3"><p className="max-w-[120px] truncate text-sm text-slate-700" title={service.staffName}>{service.staffName}</p></td>
    <td className="whitespace-nowrap px-4 py-3">
      <p className="text-sm text-slate-700">{formatYmd(service.date)}</p>
      <p className="text-xs text-slate-400">{service.time}</p>
    </td>
    <td className="px-4 py-3">
      <StatusChip status={service.status} />
      <div className="mt-1"><PriorityLabel priority={service.priority} /></div>
    </td>
    <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-slate-700">{service.cost > 0 ? money(service.cost) : <span className="text-slate-300">-</span>}</td>
    <td className="px-4 py-3">
      <div className="flex w-24 items-center gap-2">
        <ProgressBar pct={service.progress} />
        <span className="w-8 text-right text-xs tabular-nums text-slate-500">{service.progress}%</span>
      </div>
    </td>
    <td className="px-4 py-3">
      <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(service); }} aria-label={`View ${service.customerName}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-navy-700">
        <FiEye className="h-4 w-4" />
      </button>
    </td>
  </tr>
);

const ServiceCard = ({ service, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(service)}
    className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{service.customerName}</p>
        <p className="truncate text-sm text-slate-500">{service.serviceType}{service.subcategoryName && service.subcategoryName !== 'N/A' ? ` · ${service.subcategoryName}` : ''}</p>
      </div>
      <StatusChip status={service.status} />
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1"><FiMapPin className="h-3 w-3" />{service.centreName}</span>
      <span className="inline-flex items-center gap-1"><FiUser className="h-3 w-3" />{service.staffName}</span>
      <span className="inline-flex items-center gap-1"><FiCalendar className="h-3 w-3" />{formatYmd(service.date)}</span>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <SourceTag source={service.workSource} />
      <PriorityLabel priority={service.priority} />
      <Rating value={service.serviceRating} />
      {service.cost > 0 && <span className="ml-auto text-sm font-medium tabular-nums text-slate-700">{money(service.cost)}</span>}
    </div>
    <div className="mt-3 flex items-center gap-2">
      <ProgressBar pct={service.progress} />
      <span className="w-9 text-right text-xs tabular-nums text-slate-500">{service.progress}%</span>
    </div>
  </button>
);

// ==========================================
// DETAILS DRAWER
// ==========================================
const DetailRow = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <span className="shrink-0 text-sm text-slate-500">{label}</span>
    <span className="min-w-0 break-words text-right text-sm font-medium text-slate-800">{children}</span>
  </div>
);

const InfoCard = ({ icon: Icon, title, children }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5">
    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
      <Icon className="h-4 w-4 text-navy-700" /> {title}
    </h3>
    <div className="divide-y divide-slate-100">{children}</div>
  </div>
);

const STEP_NAMES = ['Submitted', 'Initial Review', 'Document Verification', 'Final Approval'];

const OverviewTab = ({ service }) => (
  <div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Progress</h3>
        <span className="text-sm font-semibold tabular-nums text-navy-700">{service.progress}%</span>
      </div>
      <ProgressBar pct={service.progress} h="h-2.5" />
      <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px] leading-tight text-slate-400">
        {STEP_NAMES.map((s) => <span key={s} className={service.currentStep === s ? 'font-semibold text-navy-700' : ''}>{s}</span>)}
      </div>
    </div>

    <InfoCard icon={FiShoppingBag} title="Service">
      <DetailRow label="Service type">{service.serviceType}</DetailRow>
      <DetailRow label="Subcategory">{service.subcategoryName}</DetailRow>
      <DetailRow label="Application no.">{service.applicationNumber}</DetailRow>
      <DetailRow label="Centre">{service.centreName}</DetailRow>
      <DetailRow label="Current step">{service.currentStep}</DetailRow>
      <DetailRow label="Estimated delivery">{service.estimatedDelivery === 'Not set' ? 'Not set' : formatDateTime(service.estimatedDelivery)}</DetailRow>
      <DetailRow label="Logged">{formatYmd(service.date)} at {service.time}</DetailRow>
      <DetailRow label="Source"><SourceTag source={service.workSource} /></DetailRow>
      <DetailRow label="Priority"><PriorityLabel priority={service.priority} /></DetailRow>
    </InfoCard>

    <InfoCard icon={FiUserCheck} title="Customer">
      <DetailRow label="Name">{service.customerName}</DetailRow>
      <DetailRow label="Phone">{service.customerPhone}</DetailRow>
      <DetailRow label="Email">{service.customerEmail}</DetailRow>
      <DetailRow label="Aadhaar">{service.aadhaar}</DetailRow>
    </InfoCard>

    <InfoCard icon={FiUser} title="Staff">
      <DetailRow label="Name">{service.staffName}</DetailRow>
      <DetailRow label="Staff ID">{service.staffId}</DetailRow>
    </InfoCard>
  </div>
);

const PaymentsTab = ({ service }) => {
  const received = service.totalReceived || 0;
  const balance = Math.max(0, (service.totalCharge || 0) - received);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: service.totalCharge > 0 ? money(service.totalCharge) : 'Not set', tone: 'text-slate-900' },
          { label: 'Received', value: money(received), tone: 'text-emerald-600' },
          { label: 'Balance', value: money(balance), tone: balance > 0 ? 'text-rose-600' : 'text-slate-900' },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{t.label}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${t.tone}`}>{t.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Payments</h3>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${paymentStatusConfig[service.paymentStatus] || paymentStatusConfig['Not Applicable']}`}>{service.paymentStatus}</span>
        </div>
        {service.payments.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No payments recorded</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {service.payments.map((p, i) => (
              <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                <span className="capitalize text-slate-700">{p.method === 'digital_wallet' ? 'Digital wallet' : p.method}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs capitalize text-slate-400">{p.status}</span>
                  <span className="font-medium tabular-nums text-slate-800">{money(p.amount)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const buildTimeline = (service) => {
  const key = reverseStatusMap[service.status] || 'pending';
  const done = ['completed', 'paid'].includes(key);
  const rawSteps = Array.isArray(service.steps) && service.steps.length > 0
    ? [...service.steps].sort((a, b) => a.step_order - b.step_order)
    : [
        { name: 'Submitted', completed: true, date: service.createdAt, estimated_days: 1 },
        { name: 'Initial Review', completed: key !== 'pending', date: key !== 'pending' ? service.updatedAt : null, estimated_days: 3 },
        { name: 'Document Verification', completed: done || service.currentStep === 'Document Verification', date: done ? service.updatedAt : null, estimated_days: 5 },
        { name: 'Final Approval', completed: done, date: done ? service.updatedAt : null, estimated_days: 2 },
      ];
  const descriptions = {
    Submitted: 'Service request received',
    'Initial Review': 'Request reviewed and assigned to staff',
    'Document Verification': 'Documents are verified',
    'Final Approval': 'Final approval and completion',
  };
  const firstOpen = rawSteps.findIndex((s) => !s.completed);
  const items = rawSteps.map((step, i) => {
    const state = step.completed ? 'completed' : i === firstOpen ? 'current' : 'upcoming';
    let time;
    if (state === 'completed') time = formatDateTime(step.date || service.createdAt);
    else if (state === 'current') time = 'In progress';
    else {
      const prev = [...rawSteps.slice(0, i)].reverse().find((s) => s.completed && s.date);
      const base = new Date(prev?.date || service.createdAt || Date.now());
      if (isNaN(base.getTime())) time = 'Not set';
      else {
        base.setDate(base.getDate() + (step.estimated_days || 1));
        time = `Est. ${base.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST })}`;
      }
    }
    return {
      state, title: step.name, description: descriptions[step.name] || step.name, time,
      by: step.name === 'Document Verification' ? service.staffName : null,
    };
  });
  if (['Delayed', 'Resubmit'].includes(service.status)) {
    items.push({ state: 'completed', title: 'Status update', description: `Marked as ${service.status}`, time: formatDateTime(service.updatedAt), by: service.staffName });
  }
  return items;
};

const TimelineTab = ({ service }) => {
  const items = useMemo(() => buildTimeline(service), [service]);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-5 text-sm font-semibold text-slate-900">Timeline</h3>
      <ol>
        {items.map((it, i) => (
          <li key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${it.state === 'completed' ? 'bg-emerald-500' : it.state === 'current' ? 'bg-navy-500 ring-4 ring-navy-500/20' : 'bg-slate-300'}`} />
              {i < items.length - 1 && <span className="my-1 w-px flex-1 bg-slate-200" />}
            </div>
            <div className="min-w-0 flex-1 pb-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h4 className={`text-sm font-medium ${it.state === 'upcoming' ? 'text-slate-400' : 'text-slate-900'}`}>{it.title}</h4>
                <span className="text-xs text-slate-400">{it.time}</span>
              </div>
              <p className="text-sm text-slate-500">{it.description}</p>
              {it.by && <p className="mt-0.5 text-xs text-slate-400">By {it.by}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

const Stars = ({ value }) => (
  <div className="flex items-center gap-0.5">
    {[0, 1, 2, 3, 4].map((i) => <FiStar key={i} className={`h-5 w-5 ${i < value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}
  </div>
);

const ReviewsTab = ({ service }) => {
  if (!service.serviceRating) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
        <FiStar className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <h4 className="text-sm font-semibold text-slate-800">No reviews yet</h4>
        <p className="mt-1 text-sm text-slate-500">This service hasn't received a customer review.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Service rating</p>
          <p className="mt-1 text-2xl font-bold text-navy-700">{service.serviceRating}<span className="text-sm font-medium text-slate-400">/5</span></p>
          <div className="mt-1"><Stars value={service.serviceRating} /></div>
        </div>
        {service.staffRating && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Staff rating · {service.staffName}</p>
            <p className="mt-1 text-2xl font-bold text-navy-700">{service.staffRating}<span className="text-sm font-medium text-slate-400">/5</span></p>
            <div className="mt-1"><Stars value={service.staffRating} /></div>
          </div>
        )}
      </div>
      {service.reviewText && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h4 className="mb-2 text-sm font-semibold text-slate-900">Comments</h4>
          <p className="text-sm italic leading-relaxed text-slate-600">“{service.reviewText}”</p>
          {service.reviewSubmittedAt && <p className="mt-3 text-right text-xs text-slate-400">Submitted {formatDateTime(service.reviewSubmittedAt)}</p>}
        </div>
      )}
    </div>
  );
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: FiFileText },
  { id: 'timeline', label: 'Timeline', icon: FiClock },
  { id: 'payments', label: 'Payments', icon: FiDollarSign },
  { id: 'reviews', label: 'Reviews', icon: FiStar },
];

const ServiceDetailsPanel = ({ service, onClose, activeTab, onTabChange, onStatusUpdate, onNotifyCustomer }) => {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const copyApp = async () => {
    try {
      await navigator.clipboard.writeText(service.applicationNumber);
      toast.success('Application number copied');
    } catch {
      toast.info(service.applicationNumber);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose}
      />
      <motion.aside
        role="dialog" aria-modal="true" aria-label="Service details"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-slate-50 shadow-2xl"
      >
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-900">{service.customerName}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
                <button type="button" onClick={copyApp} className="inline-flex items-center gap-1 font-mono text-xs hover:text-navy-700" title="Copy application number">
                  {service.applicationNumber} <FiCopy className="h-3 w-3" />
                </button>
                <span>·</span><span>{service.serviceType}</span>
                <span>·</span><span>{service.centreName}</span>
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><FiX className="h-5 w-5" /></button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusChip status={service.status} />
            <PriorityLabel priority={service.priority} />
            <button
              type="button" disabled={busy}
              onClick={() => run(() => onNotifyCustomer(service))}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-navy-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60"
            >
              <FiMessageSquare className="h-4 w-4" /> Notify customer
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-slate-400">Set status</span>
            {Object.keys(statusConfig).map((s) => (
              <button
                key={s} type="button"
                disabled={busy || service.status === s}
                onClick={() => run(() => onStatusUpdate(service.id, s))}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${service.status === s ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <nav className="flex gap-6 border-b border-slate-200 bg-white px-5" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => onTabChange(id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 py-3 text-sm font-medium transition-colors ${activeTab === id ? 'border-navy-700 text-navy-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'overview' && <OverviewTab service={service} />}
          {activeTab === 'timeline' && <TimelineTab service={service} />}
          {activeTab === 'payments' && <PaymentsTab service={service} />}
          {activeTab === 'reviews' && <ReviewsTab service={service} />}
        </div>
      </motion.aside>
    </>
  );
};

// ==========================================
// PAGE
// ==========================================
const loadSavedFilters = () => {
  try {
    const saved = localStorage.getItem('superAdminServiceSavedView');
    if (saved) return { ...DEFAULT_FILTERS, ...JSON.parse(saved) };
  } catch (e) {
    console.error('Could not load saved filters', e);
  }
  return DEFAULT_FILTERS;
};

const dateBounds = (dateRange, customStart, customEnd) => {
  const now = new Date();
  const startOfDay = (d) => new Date(new Date(d).setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = (d) => new Date(new Date(d).setHours(23, 59, 59, 999)).toISOString();
  const back = (fn) => { const d = new Date(now); fn(d); return d; };
  switch (dateRange) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday': { const y = back((d) => d.setDate(d.getDate() - 1)); return { start: startOfDay(y), end: endOfDay(y) }; }
    case 'this_week': return { start: startOfDay(back((d) => d.setDate(d.getDate() - 7))), end: endOfDay(now) };
    case 'this_month': return { start: startOfDay(back((d) => d.setMonth(d.getMonth() - 1))), end: endOfDay(now) };
    case 'last_3_months': return { start: startOfDay(back((d) => d.setMonth(d.getMonth() - 3))), end: endOfDay(now) };
    case 'last_6_months': return { start: startOfDay(back((d) => d.setMonth(d.getMonth() - 6))), end: endOfDay(now) };
    case '1_year': return { start: startOfDay(back((d) => d.setFullYear(d.getFullYear() - 1))), end: endOfDay(now) };
    case 'custom': return { start: customStart ? startOfDay(customStart) : undefined, end: customEnd ? endOfDay(customEnd) : undefined };
    default: return {};
  }
};

const SORTERS = {
  date: (s) => `${s.date} ${s.time}`,
  customer: (s) => (s.customerName || '').toLowerCase(),
  service: (s) => (s.serviceType || '').toLowerCase(),
  subcategory: (s) => (s.subcategoryName || '').toLowerCase(),
  staff: (s) => (s.staffName || '').toLowerCase(),
  cost: (s) => s.cost || 0,
  priority: (s) => (priorityConfig[s.priority] || priorityConfig.medium).rank,
  centre: (s) => (s.centreName || '').toLowerCase(),
};

const SuperAdminServiceLogs = () => {
  const initial = useMemo(loadSavedFilters, []);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState('overview');
  const [viewMode, setViewMode] = useState('list');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showInsights, setShowInsights] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initial.status);
  const [priorityFilter, setPriorityFilter] = useState(initial.priority);
  const [staffFilter, setStaffFilter] = useState(initial.staff);
  const [serviceTypeFilter, setServiceTypeFilter] = useState(initial.service);
  const [subcategoryFilter, setSubcategoryFilter] = useState(initial.subcategory);
  const [dateRange, setDateRange] = useState(initial.dateRange);
  const [customStartDate, setCustomStartDate] = useState(initial.customStart);
  const [customEndDate, setCustomEndDate] = useState(initial.customEnd);
  const [centreFilter, setCentreFilter] = useState(initial.centre);
  const [reviewedFilter, setReviewedFilter] = useState(initial.reviewed || 'all');

  const [centres, setCentres] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [globalStats, setGlobalStats] = useState({ total: 0, completed: 0, in_progress: 0, delayed: 0, pending: 0, completionRate: 0 });
  const reqRef = useRef(0);
  const firstLoad = useRef(true);

  const centresRef = useRef([]);
  centresRef.current = centres;

  const transformBackendData = (rows, centresData) =>
    rows.map((t) => {
      const totalCharge = parseFloat(t.total_charges || 0);
      const totalReceived = parseFloat(t.total_received || 0);
      const payments = Array.isArray(t.payment_details_array) ? t.payment_details_array : [];

      let paymentStatus = 'Pending';
      if (totalCharge <= 0) paymentStatus = 'Not Applicable';
      else if (totalReceived >= totalCharge) paymentStatus = 'Received';
      else if (totalReceived > 0) paymentStatus = 'Partial';

      const updatedAt = t.updated_at || t.created_at || new Date().toISOString();
      const status = statusMap[t.status] || 'Pending';
      const stepProgress = { Submitted: 25, 'Initial Review': 50, 'Document Verification': 75, 'Final Approval': 100 };
      const progress = t.progress || (['completed', 'paid'].includes(t.status) ? 100 : stepProgress[t.current_step] || 25);
      const centre = centresData.find((c) => c.id === t.centre_id);
      const estimated = t.estimated_delivery && !isNaN(new Date(t.estimated_delivery)) ? new Date(t.estimated_delivery).toISOString() : 'Not set';

      return {
        id: String(t.id),
        serviceEntryId: t.service_entry_id?.toString(),
        applicationNumber: t.application_number || `APP${t.service_entry_id}`,
        customerName: t.customer_name || 'Unknown',
        customerPhone: t.phone || 'N/A',
        customerEmail: t.email || 'N/A',
        serviceType: t.service_name || 'Unknown',
        subcategoryName: t.subcategory_name || 'N/A',
        staffName: t.assigned_to_name || 'Unassigned',
        staffId: t.assigned_to ? `EMP-${t.assigned_to}` : 'N/A',
        cost: totalCharge,
        totalCharge,
        totalReceived,
        status,
        currentStep: t.current_step || 'Submitted',
        progress,
        priority: t.priority || 'medium',
        date: istYmd(updatedAt),
        time: istTime(updatedAt),
        createdAt: t.created_at || null,
        updatedAt,
        estimatedDelivery: estimated,
        centreId: t.centre_id || null,
        centreName: centre ? centre.name : t.centre_name || 'Unknown centre',
        workSource: t.work_source || (t.customer_service_id ? 'online' : 'offline'),
        serviceRating: t.service_rating,
        staffRating: t.staff_rating,
        reviewText: t.review_text,
        reviewSubmittedAt: t.submitted_at,
        aadhaar: t.aadhaar || 'N/A',
        paymentStatus,
        payments,
        steps: t.steps || [],
      };
    });

  const buildParams = (page, limit) => {
    const { start, end } = dateBounds(dateRange, customStartDate, customEndDate);
    return {
      page,
      limit,
      start_date: start,
      end_date: end,
      centre_id: centreFilter === 'all' ? undefined : centreFilter,
      service: serviceTypeFilter === 'all' ? undefined : serviceTypeFilter,
      subcategory: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
      status: statusFilter === 'all' ? undefined : reverseStatusMap[statusFilter] || statusFilter,
      priority: priorityFilter === 'all' ? undefined : priorityFilter,
      staff: staffFilter === 'all' ? undefined : staffFilter,
      reviewed: reviewedFilter === 'reviewed' ? 'true' : undefined,
      search: debouncedSearch || undefined,
    };
  };

  // dropdown data, loaded once
  useEffect(() => {
    (async () => {
      try {
        const [staffRes, catRes, centreRes] = await Promise.all([
          getStaff(),
          getCategories(),
          axios.get(`${import.meta.env.VITE_API_URL}/api/centres`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then((r) => r.data).catch(() => []),
        ]);
        setStaffList(Array.isArray(staffRes?.data) ? staffRes.data : Array.isArray(staffRes) ? staffRes : []);
        setCategoriesList(Array.isArray(catRes?.data) ? catRes.data : Array.isArray(catRes) ? catRes : []);
        setCentres(Array.isArray(centreRes) ? centreRes : []);
      } catch (e) {
        console.error('Error loading dropdown data', e);
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => { setSubcategoryFilter('all'); }, [serviceTypeFilter]);
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, statusFilter, priorityFilter, staffFilter, serviceTypeFilter, subcategoryFilter, dateRange, centreFilter, customStartDate, customEndDate, reviewedFilter]);

  const availableSubcategories = useMemo(() => {
    if (serviceTypeFilter === 'all') return [];
    return categoriesList.find((c) => String(c.id) === String(serviceTypeFilter))?.subcategories || [];
  }, [serviceTypeFilter, categoriesList]);

  const sortedCentres = useMemo(() => [...centres].sort((a, b) => a.name.localeCompare(b.name)), [centres]);

  const loadData = async () => {
    const req = ++reqRef.current;
    if (firstLoad.current) setLoading(true); else setRefreshing(true);
    setLoadError(false);
    try {
      const params = buildParams(currentPage, LIMIT);
      const [trackingResponse, statsData] = await Promise.all([
        getTrackingEntries(params),
        typeof getTrackingStats === 'function' ? getTrackingStats(params).catch(() => null) : Promise.resolve(null),
      ]);
      if (req !== reqRef.current) return;

      if (trackingResponse?.pagination) {
        setTotalRecords(trackingResponse.pagination.totalRecords);
        setTotalPages(trackingResponse.pagination.totalPages || 1);
      }
      const rows = Array.isArray(trackingResponse?.data) ? trackingResponse.data : Array.isArray(trackingResponse) ? trackingResponse : [];
      setServices(transformBackendData(rows, centresRef.current));

      if (statsData) {
        const completionRate = statsData.total > 0 ? ((statsData.completed / statsData.total) * 100).toFixed(1) : 0;
        setGlobalStats({ ...statsData, completionRate, delayed: statsData.delayed || 0 });
      }
    } catch (err) {
      console.error('SuperAdminServiceLogs: Error loading service logs:', err);
      if (req === reqRef.current) setLoadError(true);
    } finally {
      if (req === reqRef.current) {
        firstLoad.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch, statusFilter, priorityFilter, staffFilter, serviceTypeFilter, subcategoryFilter, dateRange, customStartDate, customEndDate, centreFilter, reviewedFilter]);

  const sortedServices = useMemo(() => {
    const get = SORTERS[sortBy] || SORTERS.date;
    const dir = sortOrder === 'asc' ? 1 : -1;
    // centres may finish loading after the first page of rows, so resolve names here
    const nameById = new Map(centres.map((c) => [c.id, c.name]));
    return services.map((s) => (nameById.has(s.centreId) ? { ...s, centreName: nameById.get(s.centreId) } : s)).sort((a, b) => {
      const x = get(a); const y = get(b);
      return x < y ? -dir : x > y ? dir : 0;
    });
  }, [services, sortBy, sortOrder, centres]);

  const handleStatusUpdate = async (serviceId, newStatus) => {
    try {
      await updateTrackingStatus(serviceId, reverseStatusMap[newStatus]);
      setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, status: newStatus } : s)));
      setSelectedService((prev) => (prev && prev.id === serviceId ? { ...prev, status: newStatus } : prev));
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleNotifyCustomer = async (service) => {
    try {
      await notifyCustomer(service.id, `Dear ${service.customerName}, your ${service.serviceType} application (App No: ${service.applicationNumber || 'N/A'}) is now ${service.status}.`);
      toast.success(`Notification sent to ${service.customerName} via WhatsApp`);
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification: ' + (error.response?.data?.error || error.message));
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      let rows = sortedServices;
      if (totalRecords > rows.length) {
        const res = await getTrackingEntries(buildParams(1, Math.min(totalRecords, 5000)));
        const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (data.length > rows.length) rows = transformBackendData(data, centres);
      }
      const headers = ['Application No', 'Customer', 'Phone', 'Service', 'Subcategory', 'Centre', 'Staff', 'Date', 'Status', 'Priority', 'Source', 'Cost', 'Received', 'Payment', 'Progress %', 'Rating'];
      const body = rows.map((s) => [s.applicationNumber, s.customerName, s.customerPhone, s.serviceType, s.subcategoryName, s.centreName, s.staffName, s.date, s.status, s.priority, s.workSource, s.totalCharge, s.totalReceived, s.paymentStatus, s.progress, s.serviceRating || '']);
      const csv = [headers, ...body].map((r) => r.map(csvCell).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `service_logs_${istYmd(new Date())}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(rows.length < totalRecords ? `Exported ${rows.length} of ${totalRecords} records` : `Exported ${rows.length} records`);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm(''); setStatusFilter('all'); setPriorityFilter('all'); setStaffFilter('all');
    setServiceTypeFilter('all'); setSubcategoryFilter('all'); setDateRange('today');
    setCustomStartDate(''); setCustomEndDate(''); setCentreFilter('all'); setReviewedFilter('all');
    toast.info('Filters reset to today');
  };

  const openService = (s) => setSelectedService(s);
  const closePanel = () => { setSelectedService(null); setActiveDetailTab('overview'); };

  const moreActive = [priorityFilter, serviceTypeFilter, subcategoryFilter, reviewedFilter].filter((v) => v !== 'all').length;
  const avgProgress = services.length ? (services.reduce((a, s) => a + (s.progress || 0), 0) / services.length).toFixed(0) : 0;
  const from = totalRecords === 0 ? 0 : (currentPage - 1) * LIMIT + 1;
  const to = Math.min(currentPage * LIMIT, totalRecords);

  const tiles = [
    { label: 'Total services', value: globalStats.total || 0, icon: FiUsers, tone: 'bg-navy-700/10 text-navy-700' },
    { label: `Completed · ${globalStats.completionRate || 0}%`, value: globalStats.completed || 0, icon: FiCheckCircle, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'In progress', value: globalStats.in_progress || 0, icon: FiTrendingUp, tone: 'bg-sky-50 text-sky-600' },
    { label: 'Pending', value: globalStats.pending || 0, icon: FiClock, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Follow-up', value: globalStats.delayed || 0, icon: FiAlertCircle, tone: 'bg-rose-50 text-rose-600' },
    { label: 'Avg progress (page)', value: `${avgProgress}%`, icon: FiBarChart2, tone: 'bg-slate-100 text-slate-600' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl animate-pulse space-y-4">
          <div className="h-10 w-72 rounded-lg bg-white" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 rounded-xl bg-white" />)}</div>
          <div className="h-24 rounded-2xl bg-white" />
          <div className="h-96 rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Service Logs</h1>
              <p className="mt-1 text-sm text-slate-500">Monitor and manage service entries across all centres</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button" onClick={() => setShowInsights((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-slate-50"
              >
                <FiBarChart2 /> {showInsights ? 'Hide insights' : 'Show insights'}
              </button>
              <button
                type="button" onClick={exportCsv} disabled={exporting || totalRecords === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiDownload /> {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {tiles.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                <div className={`rounded-lg p-2 ${tone}`}><Icon className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-slate-500">{label}</p>
                  <p className="truncate text-xl font-bold tabular-nums text-slate-900">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Insights */}
          <AnimatePresence initial={false}>
            {showInsights && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <StatusDonut stats={globalStats} />
                  <StaffWorkload services={services} />
                  <TopServices services={services} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters */}
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
              <div className="relative sm:col-span-2 lg:col-span-3">
                <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search customer, phone, app no…" className={`${inputCls} pl-9`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search services" />
              </div>
              <select className={`${inputCls} lg:col-span-2`} value={dateRange} onChange={(e) => setDateRange(e.target.value)} aria-label="Date range">
                {DATE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select className={`${inputCls} lg:col-span-2`} value={centreFilter} onChange={(e) => setCentreFilter(e.target.value)} aria-label="Centre">
                <option value="all">All centres</option>
                {sortedCentres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className={`${inputCls} lg:col-span-2`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
                <option value="all">All status</option>
                {Object.keys(statusConfig).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className={`${inputCls} lg:col-span-2`} value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} aria-label="Staff">
                <option value="all">All staff</option>
                {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="flex items-center gap-2 lg:col-span-1 lg:justify-end">
                <button
                  type="button" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} title="More filters"
                  className={`relative rounded-lg border p-2 transition-colors ${showMore ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  <FiSliders className="h-4 w-4" />
                  {moreActive > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-navy-500 text-[10px] font-bold text-white">{moreActive}</span>}
                </button>
                <button type="button" onClick={resetFilters} title="Reset filters" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
                  <FiRefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {(showMore || dateRange === 'custom') && (
              <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                {showMore && (
                  <>
                    <select className={inputCls} value={serviceTypeFilter} onChange={(e) => setServiceTypeFilter(e.target.value)} aria-label="Service type">
                      <option value="all">All service types</option>
                      {categoriesList.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select className={inputCls} value={subcategoryFilter} onChange={(e) => setSubcategoryFilter(e.target.value)} disabled={serviceTypeFilter === 'all'} aria-label="Subcategory">
                      <option value="all">{serviceTypeFilter === 'all' ? 'Select a service first' : 'All subcategories'}</option>
                      {availableSubcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select className={inputCls} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Priority">
                      <option value="all">All priorities</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <select className={inputCls} value={reviewedFilter} onChange={(e) => setReviewedFilter(e.target.value)} aria-label="Reviews">
                      <option value="all">All records</option>
                      <option value="reviewed">Reviewed only</option>
                    </select>
                  </>
                )}
                {dateRange === 'custom' && (
                  <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
                    <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className={inputCls} aria-label="From date" />
                    <span className="text-sm text-slate-400">to</span>
                    <input type="date" value={customEndDate} min={customStartDate || undefined} onChange={(e) => setCustomEndDate(e.target.value)} className={inputCls} aria-label="To date" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results bar */}
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {totalRecords === 0 ? 'No records' : <>Showing <span className="font-semibold text-slate-700">{from}–{to}</span> of <span className="font-semibold text-slate-700">{totalRecords}</span></>}
              {refreshing && <span className="ml-2 text-xs text-slate-400">updating…</span>}
            </p>
            <div className="flex items-center gap-2">
              <select className={`${inputCls} w-auto py-1.5`} value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort by (this page)">
                <option value="date">Sort: Date</option>
                <option value="customer">Sort: Customer</option>
                <option value="service">Sort: Service</option>
                <option value="subcategory">Sort: Subcategory</option>
                <option value="staff">Sort: Staff</option>
                <option value="cost">Sort: Cost</option>
                <option value="priority">Sort: Priority</option>
                <option value="centre">Sort: Centre</option>
              </select>
              <button type="button" onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50" aria-label="Toggle sort order">
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
              <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:flex">
                <button type="button" onClick={() => setViewMode('list')} title="List view" className={`p-2 ${viewMode === 'list' ? 'bg-navy-700 text-white' : 'text-slate-400 hover:text-slate-600'}`}><FiList className="h-4 w-4" /></button>
                <button type="button" onClick={() => setViewMode('grid')} title="Card view" className={`p-2 ${viewMode === 'grid' ? 'bg-navy-700 text-white' : 'text-slate-400 hover:text-slate-600'}`}><FiGrid className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className={`transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
            {loadError ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                <span>Could not load service logs.</span>
                <button type="button" onClick={loadData} className="inline-flex items-center gap-1.5 font-medium hover:text-rose-900"><FiRefreshCw className="h-3.5 w-3.5" /> Retry</button>
              </div>
            ) : sortedServices.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
                <FiSearch className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                <h3 className="text-sm font-semibold text-slate-800">No services found</h3>
                <p className="mt-1 text-sm text-slate-500">Try a different search or widen the date range.</p>
                {dateRange === 'today' && (
                  <button type="button" onClick={() => setDateRange('this_week')} className="mt-4 text-sm font-medium text-navy-700 hover:text-navy-800">Show the last 7 days</button>
                )}
              </div>
            ) : (
              <>
                {/* cards: phones always, desktops when card view is chosen */}
                <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${viewMode === 'grid' ? 'md:grid xl:grid-cols-3' : 'md:hidden'}`}>
                  {sortedServices.map((s) => <ServiceCard key={s.id} service={s} onOpen={openService} />)}
                </div>
                {viewMode === 'list' && (
                  <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
                    <table className="w-full">
                      <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                        <tr>
                          {['Customer', 'Service', 'Centre', 'Staff', 'Logged', 'Status', 'Cost', 'Progress', ''].map((h) => <th key={h || 'a'} className="whitespace-nowrap px-4 py-3">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedServices.map((s) => <ServiceRow key={s.id} service={s} onOpen={openService} />)}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                <FiChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="text-sm text-slate-500">Page <span className="font-semibold text-slate-700">{currentPage}</span> of {totalPages}</span>
              <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                Next <FiChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedService && (
            <ServiceDetailsPanel
              key="panel"
              service={selectedService}
              onClose={closePanel}
              activeTab={activeDetailTab}
              onTabChange={setActiveDetailTab}
              onStatusUpdate={handleStatusUpdate}
              onNotifyCustomer={handleNotifyCustomer}
            />
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
};

export default SuperAdminServiceLogs;