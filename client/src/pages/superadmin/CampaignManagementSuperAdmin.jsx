import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus, FiCalendar, FiTarget, FiCheckCircle, FiTrendingUp, FiEdit2, FiTrash2,
  FiRefreshCw, FiChevronDown, FiBarChart2, FiFilter, FiDownload, FiX, FiPackage, FiMapPin, FiLayers,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { getServices, getAllCentres, getCampaigns, createCampaign, updateCampaign, deleteCampaign, getCampaignReports } from '/src/services/campaignService';

// ---------- date helpers (IST, whole days) ----------
const IST = 'Asia/Kolkata';
const DAY_MS = 86400000;

const toYmd = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { timeZone: IST });
};
const todayYmd = () => new Date().toLocaleDateString('en-CA', { timeZone: IST });
const dayNumber = (ymd) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / DAY_MS);

const formatDate = (value) => {
  const ymd = toYmd(value);
  if (!ymd) return '-';
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const statusOf = (start, end) => {
  const today = todayYmd();
  if (end && end < today) return 'expired';
  if (start && start > today) return 'upcoming';
  return 'active';
};

const timelinePct = (start, end) => {
  const s = dayNumber(start);
  const e = dayNumber(end);
  const t = dayNumber(todayYmd());
  if (t >= e) return 100;
  if (t < s) return 0;
  return Math.min(100, Math.round(((t - s + 1) / (e - s + 1)) * 100));
};

const pctOf = (generated, target) => (target > 0 ? Math.min(100, Math.round((generated / target) * 100)) : 0);

const daysLabel = (start, end, status) => {
  const t = dayNumber(todayYmd());
  if (status === 'active') {
    const left = dayNumber(end) - t;
    return left === 0 ? 'Ends today' : `${left} day${left === 1 ? '' : 's'} left`;
  }
  if (status === 'upcoming') {
    const to = dayNumber(start) - t;
    return to === 1 ? 'Starts tomorrow' : `Starts in ${to} days`;
  }
  const ago = t - dayNumber(end);
  return ago === 1 ? 'Ended yesterday' : `Ended ${ago} days ago`;
};

const STATUS_STYLE = {
  active: { label: 'Running', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  upcoming: { label: 'Upcoming', chip: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500', bar: 'bg-sky-500' },
  expired: { label: 'Expired', chip: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', bar: 'bg-slate-400' },
};
// the reports API calls an ended campaign "completed"
const normStatus = (s) => (s === 'completed' ? 'expired' : STATUS_STYLE[s] ? s : 'active');

const StatusChip = ({ status }) => {
  const s = STATUS_STYLE[normStatus(status)];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

const Bar = ({ pct, className }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
    <div className={`h-2 rounded-full transition-all ${className}`} style={{ width: `${pct}%` }} />
  </div>
);

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40 disabled:bg-slate-50 disabled:text-slate-400';

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ---------- campaign row helpers ----------
const emptyForm = { name: '', description: '', serviceId: '', startDate: '', endDate: '', centreId: 'all', targetTokens: '' };

// The same campaign created for "All centres" is stored as one row per centre.
// Group those rows so the page shows one campaign with a per-centre breakdown.
const groupCampaigns = (rows) => {
  const map = new Map();
  rows.forEach((r) => {
    const start = toYmd(r.start_date);
    const end = toYmd(r.end_date);
    const key = `${r.name}|${r.service_id}|${start}|${end}`;
    if (!map.has(key)) {
      map.set(key, {
        key, name: r.name, description: r.description || '', service_name: r.service_name || '',
        start, end, status: statusOf(start, end), rows: [],
      });
    }
    map.get(key).rows.push(r);
  });
  return [...map.values()].map((g) => ({
    ...g,
    generated: g.rows.reduce((s, r) => s + (Number(r.tokens_generated) || 0), 0),
    target: g.rows.reduce((s, r) => s + (Number(r.target_tokens) || 0), 0),
  }));
};

// ---------- details body (shared by running cards and history rows) ----------
const GroupDetails = ({ group, centreName, onEdit, onDelete }) => {
  const tPct = timelinePct(group.start, group.end);
  const kPct = pctOf(group.generated, group.target);
  const style = STATUS_STYLE[group.status];
  const multi = group.rows.length > 1;
  const sorted = useMemo(
    () => [...group.rows].sort((a, b) => (Number(b.tokens_generated) || 0) - (Number(a.tokens_generated) || 0)),
    [group.rows]
  );
  return (
    <div className="space-y-5">
      {group.description ? (
        <p className="text-sm leading-relaxed text-slate-600">{group.description}</p>
      ) : (
        <p className="text-sm italic text-slate-400">No description provided</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Timeline</span>
            <span className="text-sm font-semibold tabular-nums text-slate-800">{tPct}%</span>
          </div>
          <Bar pct={tPct} className={style.bar} />
          <p className="mt-2 text-xs text-slate-500">{daysLabel(group.start, group.end, group.status)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Tokens{multi ? ' · all centres' : ''}</span>
            <span className="text-sm font-semibold tabular-nums text-slate-800">{kPct}%</span>
          </div>
          <Bar pct={kPct} className="bg-navy-500" />
          <p className="mt-2 text-xs text-slate-500">
            <span className="font-semibold tabular-nums text-slate-700">{group.generated}</span> of {group.target} target
            {group.status === 'expired' && group.target > 0 && (group.generated >= group.target ? ' · target met' : ' · target missed')}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          <FiMapPin className="h-3.5 w-3.5" /> {multi ? `Centres (${group.rows.length})` : 'Centre'}
        </p>
        <ul className={`divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white ${multi ? 'max-h-72 overflow-y-auto' : ''}`}>
          {sorted.map((r) => {
            const g = Number(r.tokens_generated) || 0;
            const t = Number(r.target_tokens) || 0;
            return (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{centreName(r)}</span>
                <div className="hidden w-36 shrink-0 sm:block">
                  <Bar pct={pctOf(g, t)} className="bg-navy-500" />
                </div>
                <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-500">{g} / {t}</span>
                <button type="button" onClick={() => onEdit(r)} aria-label={`Edit for ${centreName(r)}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-700">
                  <FiEdit2 className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onDelete(r)} aria-label={`Delete for ${centreName(r)}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

const CampaignManagementSuperAdmin = () => {
  const navigate = useNavigate();
  const [allCampaigns, setAllCampaigns] = useState([]);
  const [services, setServices] = useState([]);
  const [centres, setCentres] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedCentre, setSelectedCentre] = useState('all');
  const [view, setView] = useState('expired');
  const [openKey, setOpenKey] = useState(null);
  const [reportFilters, setReportFilters] = useState({ centreId: 'all', startDate: '', endDate: '', status: 'all' });
  const [reports, setReports] = useState([]);
  const [reportsGenerated, setReportsGenerated] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [centresLoading, setCentresLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [servicesError, setServicesError] = useState(null);
  const userRole = localStorage.getItem('role');
  const token = localStorage.getItem('token');

  const sessionExpired = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };
  const errMessage = (err, fallback) => (
    err.response?.status === 401 ? 'Session expired. Please log in again.' : err.response?.data?.error || fallback
  );

  const loadCampaigns = async () => {
    const res = await getCampaigns('all');
    setAllCampaigns(res.data || []);
  };

  useEffect(() => {
    if (!token) {
      toast.error('No authentication token found. Please log in.');
      navigate('/login');
      return;
    }
    if (userRole !== 'superadmin') {
      toast.error('Access denied. Superadmins only.');
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      setServicesLoading(true);
      setCentresLoading(true);
      try {
        const servicesRes = await getServices();
        if (!servicesRes.data || servicesRes.data.length === 0) {
          setServicesError('No services found in the database. Add services first.');
        } else {
          setServices(servicesRes.data);
          setServicesError(null);
        }
        const centresRes = await getAllCentres();
        setCentres(centresRes.data || []);
        await loadCampaigns();
      } catch (err) {
        console.error('Error fetching data:', err);
        const message = errMessage(err, 'Failed to load data. Please try again.');
        setServicesError(message);
        toast.error(message);
        if (err.response?.status === 401) sessionExpired();
      } finally {
        setInitialLoading(false);
        setServicesLoading(false);
        setCentresLoading(false);
      }
    };
    fetchData();
  }, [navigate, userRole, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const centreName = (row) =>
    centres.find((c) => String(c.id) === String(row.centre_id))?.name || row.centre_name || 'Unknown centre';

  // rows for the chosen centre -> grouped campaigns
  const groups = useMemo(() => {
    const rows = selectedCentre === 'all' ? allCampaigns : allCampaigns.filter((c) => String(c.centre_id) === String(selectedCentre));
    return groupCampaigns(rows);
  }, [allCampaigns, selectedCentre]);

  const grouped = useMemo(() => {
    const by = (s) => groups.filter((g) => g.status === s);
    return {
      active: by('active').sort((a, b) => a.end.localeCompare(b.end)),
      upcoming: by('upcoming').sort((a, b) => a.start.localeCompare(b.start)),
      expired: by('expired').sort((a, b) => b.end.localeCompare(a.end)),
    };
  }, [groups]);

  const nextUp = grouped.upcoming[0];
  const totalTokens = groups.reduce((s, g) => s + g.generated, 0);
  const listed = view === 'expired' ? grouped.expired : view === 'upcoming' ? grouped.upcoming : [...groups].sort((a, b) => b.end.localeCompare(a.end));
  const tabs = [
    { key: 'expired', label: 'Expired', count: grouped.expired.length },
    { key: 'upcoming', label: 'Upcoming', count: grouped.upcoming.length },
    { key: 'all', label: 'All', count: groups.length },
  ];
  const stats = [
    { label: 'Campaigns', value: groups.length, icon: FiTarget, tone: 'bg-navy-700/10 text-navy-700' },
    { label: 'Running now', value: grouped.active.length, icon: FiTrendingUp, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Tokens generated', value: totalTokens, icon: FiCheckCircle, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Expired', value: grouped.expired.length, icon: FiLayers, tone: 'bg-slate-100 text-slate-600' },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleReportFilterChange = (e) => {
    const { name, value } = e.target;
    setReportFilters((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setShowModal(false);
    setIsEditing(false);
    setSelectedCampaign(null);
  };

  const openCreate = () => {
    setIsEditing(false);
    setSelectedCampaign(null);
    setFormData({ ...emptyForm, centreId: selectedCentre === 'all' ? 'all' : String(selectedCentre) });
    setShowModal(true);
  };

  const handleCreateOrUpdateCampaign = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.serviceId || !formData.startDate || !formData.endDate || !formData.centreId || formData.targetTokens === '') {
      toast.error('Please fill all required fields');
      return;
    }
    if (formData.endDate < formData.startDate) {
      toast.error('End date must be on or after start date');
      return;
    }
    if (parseInt(formData.targetTokens, 10) < 0) {
      toast.error('Target tokens must be a non-negative number');
      return;
    }

    const base = {
      name: formData.name,
      description: formData.description,
      service_id: parseInt(formData.serviceId, 10),
      start_date: formData.startDate,
      end_date: formData.endDate,
      target_tokens: parseInt(formData.targetTokens, 10),
    };

    try {
      setLoading(true);
      if (isEditing) {
        // editing changes only the one campaign row that was picked
        await updateCampaign(selectedCampaign.id, { ...base, centre_id: selectedCampaign.centre_id });
        toast.success('Campaign updated successfully');
      } else {
        const centreIds = formData.centreId === 'all' ? centres.map((c) => c.id) : [parseInt(formData.centreId, 10)];
        const results = await Promise.allSettled(centreIds.map((centre_id) => createCampaign({ ...base, centre_id })));
        const failed = results.filter((r) => r.status === 'rejected');
        const done = results.length - failed.length;
        if (failed.length === results.length) throw failed[0].reason;
        if (failed.length > 0) toast.warn(`Created for ${done} centre(s); ${failed.length} failed. Please check and retry for the rest.`);
        else toast.success(`Campaign created for ${done} centre${done === 1 ? '' : 's'}`);
      }
      await loadCampaigns();
      resetForm();
    } catch (err) {
      console.error('Error saving campaign:', err);
      toast.error(errMessage(err, 'Failed to save campaign. Please try again.'));
      if (err.response?.status === 401) sessionExpired();
    } finally {
      setLoading(false);
    }
  };

  const handleEditCampaign = (row) => {
    setIsEditing(true);
    setSelectedCampaign(row);
    setFormData({
      name: row.name,
      description: row.description || '',
      serviceId: String(row.service_id),
      startDate: toYmd(row.start_date),
      endDate: toYmd(row.end_date),
      centreId: String(row.centre_id),
      targetTokens: String(row.target_tokens || 0),
    });
    setShowModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setLoading(true);
      await deleteCampaign(deleteTarget.id);
      toast.success('Campaign deleted successfully');
      setDeleteTarget(null);
      await loadCampaigns();
    } catch (err) {
      console.error('Error deleting campaign:', err);
      toast.error(errMessage(err, 'Failed to delete campaign. Please try again.'));
      if (err.response?.status === 401) sessionExpired();
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReports = async (e) => {
    e.preventDefault();
    try {
      setReportsLoading(true);
      const reportsRes = await getCampaignReports(reportFilters);
      setReports(reportsRes.data || []);
      setReportsGenerated(true);
    } catch (err) {
      console.error('Error generating reports:', err);
      toast.error(err.response?.data?.error || 'Failed to generate reports. Please try again.');
    } finally {
      setReportsLoading(false);
    }
  };

  const handleExportReports = () => {
    const headers = ['Centre', 'Campaign', 'Service', 'Start Date', 'End Date', 'Status', 'Tokens Generated', 'Target Tokens'];
    const rows = reports.map((r) => [
      r.centre_name || 'All Centres',
      r.campaign_name,
      r.service_name,
      toYmd(r.start_date),
      toYmd(r.end_date),
      r.status,
      r.tokens_generated,
      r.target_tokens,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `campaign_reports_${todayYmd()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const createDisabled = loading || servicesLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Campaign Management</h1>
            <p className="mt-1 text-sm text-slate-500">Create and manage campaigns across all centres</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 transition-colors hover:bg-slate-50"
            >
              <FiBarChart2 /> Reports
            </button>
            <button
              type="button"
              onClick={openCreate}
              disabled={createDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiPlus /> Create Campaign
            </button>
          </div>
        </div>

        {/* Centre filter */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><FiMapPin className="h-4 w-4 text-slate-400" /> Centre</span>
          <div className="relative w-full sm:w-72">
            <select
              value={selectedCentre}
              onChange={(e) => { setSelectedCentre(e.target.value); setOpenKey(null); }}
              disabled={centresLoading}
              aria-label="Filter by centre"
              className={`${inputCls} appearance-none py-2 pr-9`}
            >
              <option value="all">All centres</option>
              {centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}
            </select>
            <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          {selectedCentre !== 'all' && (
            <button type="button" onClick={() => setSelectedCentre('all')} className="text-sm font-medium text-navy-700 hover:text-navy-800">Clear</button>
          )}
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className={`rounded-lg p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-500">{label}</p>
                <p className="truncate text-xl font-bold tabular-nums text-slate-900">{initialLoading ? '-' : value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Running now */}
        <section aria-labelledby="running-heading" className="mb-10">
          <h2 id="running-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Running now</h2>
          {initialLoading ? (
            <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ) : grouped.active.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <FiTarget className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <h3 className="text-base font-semibold text-slate-800">No campaign is currently running</h3>
              <p className="mt-1 text-sm text-slate-500">
                {nextUp
                  ? `Next up: ${nextUp.name}, starting ${formatDate(nextUp.start)}.`
                  : selectedCentre === 'all'
                    ? 'Create a campaign to start tracking tokens for a service.'
                    : "This centre doesn't have a running campaign."}
              </p>
              <button type="button" onClick={openCreate} disabled={createDisabled} className="mt-4 text-sm font-medium text-navy-700 hover:text-navy-800 disabled:opacity-50">
                Create a campaign
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.active.map((g) => (
                <article key={g.key} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-slate-900">{g.name}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1.5"><FiCalendar className="h-3.5 w-3.5" />{formatDate(g.start)} – {formatDate(g.end)}</span>
                        {g.service_name && <span className="inline-flex items-center gap-1.5"><FiPackage className="h-3.5 w-3.5" />{g.service_name}</span>}
                        <span className="inline-flex items-center gap-1.5"><FiMapPin className="h-3.5 w-3.5" />{g.rows.length > 1 ? `${g.rows.length} centres` : centreName(g.rows[0])}</span>
                      </div>
                    </div>
                    <StatusChip status="active" />
                  </div>
                  <GroupDetails group={g} centreName={centreName} onEdit={handleEditCampaign} onDelete={setDeleteTarget} />
                </article>
              ))}
            </div>
          )}
        </section>

        {/* History */}
        <section aria-labelledby="history-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="history-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">Campaign history</h2>
            <div role="tablist" aria-label="Filter campaigns" className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={view === t.key}
                  onClick={() => { setView(t.key); setOpenKey(null); }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === t.key ? 'bg-navy-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {t.label}
                  <span className={`ml-1.5 text-xs tabular-nums ${view === t.key ? 'text-white/70' : 'text-slate-400'}`}>{t.count}</span>
                </button>
              ))}
            </div>
          </div>

          {listed.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
              {view === 'expired' ? 'No expired campaigns yet.' : view === 'upcoming' ? 'No upcoming campaigns.' : 'No campaigns yet.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {listed.map((g) => {
                const open = openKey === g.key;
                return (
                  <li key={g.key}>
                    <button
                      type="button"
                      onClick={() => setOpenKey(open ? null : g.key)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-slate-900">{g.name}</span>
                          {view === 'all' && <StatusChip status={g.status} />}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-slate-500">
                          {formatDate(g.start)} – {formatDate(g.end)}
                          {g.service_name ? ` · ${g.service_name}` : ''}
                          {` · ${g.rows.length > 1 ? `${g.rows.length} centres` : centreName(g.rows[0])}`}
                        </p>
                      </div>
                      <div className="hidden w-40 shrink-0 sm:block">
                        <p className="mb-1 text-right text-xs tabular-nums text-slate-500">{g.generated} / {g.target} tokens</p>
                        <Bar pct={pctOf(g.generated, g.target)} className="bg-navy-500" />
                      </div>
                      <FiChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5">
                            <GroupDetails group={g} centreName={centreName} onEdit={handleEditCampaign} onDelete={setDeleteTarget} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Delete confirmation */}
        <AnimatePresence>
          {deleteTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
              onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) setDeleteTarget(null); }}
            >
              <div role="alertdialog" aria-modal="true" aria-label="Delete campaign" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                <h3 className="text-lg font-semibold text-slate-900">Delete this campaign?</h3>
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-medium">{deleteTarget.name}</span> will be removed permanently for <span className="font-medium">{centreName(deleteTarget)}</span> only.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setDeleteTarget(null)} disabled={loading} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Cancel</button>
                  <button type="button" onClick={confirmDelete} disabled={loading} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60">
                    {loading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create/Edit Campaign Modal */}
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
            onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) resetForm(); }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={isEditing ? 'Edit campaign' : 'Create campaign'}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">{isEditing ? 'Edit Campaign' : 'New Campaign'}</h2>
                <button type="button" onClick={resetForm} disabled={loading} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><FiX /></button>
              </div>
              <form onSubmit={handleCreateOrUpdateCampaign} className="p-6">
                <div className="space-y-5">
                  <div>
                    <label htmlFor="cs-name" className="mb-1.5 block text-sm font-medium text-slate-700">Campaign name *</label>
                    <input id="cs-name" type="text" name="name" value={formData.name} onChange={handleInputChange} required className={inputCls} placeholder="e.g., Diwali Offer" />
                  </div>
                  <div>
                    <label htmlFor="cs-desc" className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                    <textarea id="cs-desc" name="description" value={formData.description} onChange={handleInputChange} rows={3} className={inputCls} placeholder="Describe the campaign goals..." />
                  </div>
                  <div>
                    <label htmlFor="cs-centre" className="mb-1.5 block text-sm font-medium text-slate-700">Centre *</label>
                    <select id="cs-centre" name="centreId" value={formData.centreId} onChange={handleInputChange} required disabled={isEditing} className={inputCls}>
                      {!isEditing && <option value="all">All centres</option>}
                      {centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}
                    </select>
                    {isEditing && <p className="mt-1 text-xs text-slate-400">Editing changes this centre's campaign only.</p>}
                    {!isEditing && formData.centreId === 'all' && <p className="mt-1 text-xs text-slate-400">A separate campaign is created for each of the {centres.length} centres.</p>}
                  </div>
                  <div>
                    <label htmlFor="cs-service" className="mb-1.5 block text-sm font-medium text-slate-700">Service *</label>
                    {servicesLoading ? (
                      <p className="text-sm text-slate-500">Loading services...</p>
                    ) : servicesError ? (
                      <div className="text-sm text-rose-600">
                        {servicesError}
                        <button type="button" onClick={() => window.location.reload()} className="ml-2 inline-flex items-center text-navy-700 hover:text-navy-800"><FiRefreshCw className="mr-1" /> Retry</button>
                      </div>
                    ) : services.length === 0 ? (
                      <p className="text-sm text-rose-600">No services available. Add services first.</p>
                    ) : (
                      <select id="cs-service" name="serviceId" value={formData.serviceId} onChange={handleInputChange} required className={inputCls}>
                        <option value="">Select a service</option>
                        {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cs-start" className="mb-1.5 block text-sm font-medium text-slate-700">Start date *</label>
                      <input id="cs-start" type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} required className={inputCls} />
                    </div>
                    <div>
                      <label htmlFor="cs-end" className="mb-1.5 block text-sm font-medium text-slate-700">End date *</label>
                      <input id="cs-end" type="date" name="endDate" value={formData.endDate} min={formData.startDate || undefined} onChange={handleInputChange} required className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="cs-target" className="mb-1.5 block text-sm font-medium text-slate-700">Target tokens{!isEditing && formData.centreId === 'all' ? ' (per centre)' : ''} *</label>
                    <input id="cs-target" type="number" name="targetTokens" value={formData.targetTokens} onChange={handleInputChange} min="0" required className={inputCls} placeholder="e.g., 100" />
                  </div>
                </div>
                <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5">
                  <button type="button" onClick={resetForm} disabled={loading} className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200">Cancel</button>
                  <button type="submit" disabled={createDisabled} className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60">
                    {loading ? 'Saving...' : isEditing ? 'Update Campaign' : 'Create Campaign'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Reports Modal */}
        {showReportModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
            onMouseDown={(e) => { if (e.target === e.currentTarget && !reportsLoading) setShowReportModal(false); }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Campaign reports"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Campaign reports</h2>
                <button type="button" onClick={() => setShowReportModal(false)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><FiX /></button>
              </div>
              <div className="p-6">
                <form onSubmit={handleGenerateReports} className="mb-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label htmlFor="cr-centre" className="mb-1.5 block text-sm font-medium text-slate-700">Centre</label>
                      <select id="cr-centre" name="centreId" value={reportFilters.centreId} onChange={handleReportFilterChange} className={inputCls}>
                        <option value="all">All centres</option>
                        {centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="cr-start" className="mb-1.5 block text-sm font-medium text-slate-700">Start date</label>
                      <input id="cr-start" type="date" name="startDate" value={reportFilters.startDate} onChange={handleReportFilterChange} className={inputCls} />
                    </div>
                    <div>
                      <label htmlFor="cr-end" className="mb-1.5 block text-sm font-medium text-slate-700">End date</label>
                      <input id="cr-end" type="date" name="endDate" value={reportFilters.endDate} onChange={handleReportFilterChange} className={inputCls} />
                    </div>
                    <div>
                      <label htmlFor="cr-status" className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                      <select id="cr-status" name="status" value={reportFilters.status} onChange={handleReportFilterChange} className={inputCls}>
                        <option value="all">All statuses</option>
                        <option value="active">Running</option>
                        <option value="upcoming">Upcoming</option>
                        <option value="completed">Expired</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button type="submit" disabled={reportsLoading} className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60">
                      {reportsLoading ? 'Generating...' : 'Generate report'}
                    </button>
                  </div>
                </form>

                {reports.length > 0 ? (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-800">Results <span className="font-normal text-slate-400">({reports.length})</span></h3>
                      <button type="button" onClick={handleExportReports} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <FiDownload className="h-4 w-4" /> Export CSV
                      </button>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                          <tr>
                            {['Centre', 'Campaign', 'Service', 'Start', 'End', 'Status', 'Tokens', 'Target'].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reports.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50/70">
                              <td className="whitespace-nowrap px-4 py-3 text-slate-800">{r.centre_name || 'All centres'}</td>
                              <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{r.campaign_name}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{r.service_name}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(r.start_date)}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(r.end_date)}</td>
                              <td className="whitespace-nowrap px-4 py-3"><StatusChip status={r.status} /></td>
                              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-800">{r.tokens_generated}</td>
                              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{r.target_tokens}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <FiFilter className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                    <p className="text-sm text-slate-500">
                      {reportsGenerated ? 'No campaigns match these filters.' : 'Choose filters and click "Generate report" to see results.'}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignManagementSuperAdmin;