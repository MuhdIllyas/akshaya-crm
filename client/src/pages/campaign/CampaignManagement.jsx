import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPlus, FiCalendar, FiTarget, FiCheckCircle, FiTrendingUp, FiEdit2, FiTrash2,
  FiRefreshCw, FiChevronDown, FiClock, FiArchive, FiX, FiPackage, FiAward, FiUsers
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { getServices, getCampaigns, createCampaign, updateCampaign, deleteCampaign } from '/src/services/serviceService';

// ---------- date helpers (all in IST, whole days) ----------
const IST = 'Asia/Kolkata';
const DAY_MS = 86400000;

// Accepts 'YYYY-MM-DD' or a full ISO timestamp and returns the IST calendar day as 'YYYY-MM-DD'.
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

const startOf = (c) => toYmd(c.start_date || c.startDate);
const endOf = (c) => toYmd(c.end_date || c.endDate);
const generatedOf = (c) => Number(c.tokens_generated ?? c.tokenCount ?? 0) || 0;
const targetOf = (c) => Number(c.target_tokens ?? c.targetTokens ?? 0) || 0;
const serviceNameOf = (c) => c.service_name || c.serviceName || '';

// 'active' = running today, 'upcoming' = not started, 'expired' = ended before today.
const getStatus = (c) => {
  const today = todayYmd();
  const start = startOf(c);
  const end = endOf(c);
  if (end && end < today) return 'expired';
  if (start && start > today) return 'upcoming';
  return 'active';
};

const timelineProgress = (c) => {
  const s = dayNumber(startOf(c));
  const e = dayNumber(endOf(c));
  const t = dayNumber(todayYmd());
  if (t >= e) return 100;
  if (t < s) return 0;
  return Math.min(100, Math.round(((t - s + 1) / (e - s + 1)) * 100));
};

const tokenProgress = (generated, target) => (target > 0 ? Math.min(100, Math.round((generated / target) * 100)) : 0);

const daysLabel = (c, status) => {
  const t = dayNumber(todayYmd());
  if (status === 'active') {
    const left = dayNumber(endOf(c)) - t;
    return left === 0 ? 'Ends today' : `${left} day${left === 1 ? '' : 's'} left`;
  }
  if (status === 'upcoming') {
    const to = dayNumber(startOf(c)) - t;
    return to === 1 ? 'Starts tomorrow' : `Starts in ${to} days`;
  }
  const ago = t - dayNumber(endOf(c));
  return ago === 1 ? 'Ended yesterday' : `Ended ${ago} days ago`;
};

const STATUS_STYLE = {
  active: { label: 'Running', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  upcoming: { label: 'Upcoming', chip: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500', bar: 'bg-sky-500' },
  expired: { label: 'Expired', chip: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', bar: 'bg-slate-400' },
};

const StatusChip = ({ status }) => {
  const s = STATUS_STYLE[status];
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

// ---------- shared details body ----------
const CampaignDetails = ({ campaign, status, onEdit, onDelete }) => {
  const generated = generatedOf(campaign);
  const target = targetOf(campaign);
  const tPct = timelineProgress(campaign);
  const kPct = tokenProgress(generated, target);
  const style = STATUS_STYLE[status];
  return (
    <div className="space-y-5">
      {campaign.description ? (
        <p className="text-sm leading-relaxed text-slate-600">{campaign.description}</p>
      ) : (
        <p className="text-sm italic text-slate-400">No description provided</p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Timeline</span>
            <span className="text-sm font-semibold tabular-nums text-slate-800">{tPct}%</span>
          </div>
          <Bar pct={tPct} className={style.bar} />
          <p className="mt-2 text-xs text-slate-500">{daysLabel(campaign, status)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Tokens</span>
            <span className="text-sm font-semibold tabular-nums text-slate-800">{kPct}%</span>
          </div>
          <Bar pct={kPct} className="bg-navy-500" />
          <p className="mt-2 text-xs text-slate-500">
            <span className="font-semibold tabular-nums text-slate-700">{generated}</span> of {target} target
            {status === 'expired' && target > 0 && (generated >= target ? ' · target met' : ' · target missed')}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onEdit(campaign)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <FiEdit2 className="h-3.5 w-3.5" /> Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(campaign)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
        >
          <FiTrash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );
};

// ---------- staff performance ----------
// Uses the existing GET /api/servicemanagement/campaigns/stats route (campaign_id optional = all campaigns).
const fetchCampaignStats = async (centreId, campaignId) => {
  const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/servicemanagement/campaigns/stats`, {
    params: { centre_id: centreId, ...(campaignId ? { campaign_id: campaignId } : {}) },
    headers: { Authorization: `Bearer ${(localStorage.getItem('token') || '').trim()}` },
  });
  return res.data || {};
};

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

const StatTile = ({ label, value, tone }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-xs text-slate-500">{label}</p>
    <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
  </div>
);

const StaffPerformance = ({ campaigns, centreId }) => {
  const [scope, setScope] = useState('all');
  const [state, setState] = useState({ loading: true, error: false, data: null });
  const scopeInit = useRef(false);
  const reqRef = useRef(0);

  // Default to the first running campaign once the list has loaded
  useEffect(() => {
    if (scopeInit.current || campaigns.length === 0) return;
    scopeInit.current = true;
    const running = campaigns.find((c) => getStatus(c) === 'active');
    if (running) setScope(String(running.id));
  }, [campaigns]);

  const load = async () => {
    const req = ++reqRef.current;
    setState((p) => ({ ...p, loading: true, error: false }));
    try {
      const data = await fetchCampaignStats(centreId, scope === 'all' ? null : scope);
      if (req === reqRef.current) setState({ loading: false, error: false, data });
    } catch (err) {
      console.error('CampaignManagement.jsx: staff performance failed:', err);
      if (req === reqRef.current) setState({ loading: false, error: true, data: null });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, centreId]);

  const { staff, summary, assignedTotal, total } = useMemo(() => {
    const d = state.data || {};
    const rows = (d.staff_contributions || []).map((r) => {
      const totalTokens = Number(r.total_tokens) || 0;
      const completed = Number(r.completed_tokens) || 0;
      return {
        id: r.staff_id,
        name: r.staff_name || `Staff ${r.staff_id}`,
        total: totalTokens,
        completed,
        inProgress: Number(r.in_progress_tokens) || 0,
        pending: Number(r.pending_tokens) || 0,
        rate: totalTokens ? Math.round((completed / totalTokens) * 100) : 0,
      };
    });
    rows.sort((a, b) => b.completed - a.completed || b.rate - a.rate || b.total - a.total || a.name.localeCompare(b.name));
    const ss = d.status_summary || {};
    const t = Number(d.total_tokens) || 0;
    const done = Number(ss.completed) || 0;
    return {
      staff: rows,
      assignedTotal: rows.reduce((n, r) => n + r.total, 0),
      total: t,
      summary: {
        completed: done,
        inProgress: (Number(ss.in_progress) || 0) + (Number(ss.processed) || 0),
        pending: Number(ss.pending) || 0,
        rate: t ? Math.round((done / t) * 100) : 0,
      },
    };
  }, [state.data]);

  const leader = staff.length && staff[0].completed > 0 ? staff[0] : null;
  const unassigned = Math.max(0, total - assignedTotal);

  return (
    <section aria-labelledby="perf-heading" className="mb-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="perf-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">Staff performance</h2>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <span className="sr-only sm:not-sr-only">Showing</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            aria-label="Campaign to show staff performance for"
            className="max-w-[15rem] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-500/40"
          >
            <option value="all">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name} ({STATUS_STYLE[getStatus(c)].label})
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.loading && !state.data ? (
        <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      ) : state.error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          <span>Could not load staff performance.</span>
          <button type="button" onClick={load} className="inline-flex items-center gap-1.5 font-medium hover:text-rose-900">
            <FiRefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : total === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          <FiUsers className="mx-auto mb-3 h-7 w-7 text-slate-300" />
          No applications recorded for {scope === 'all' ? 'any campaign' : 'this campaign'} yet.
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${state.loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatTile label="Applications" value={total} tone="text-slate-900" />
            <StatTile label="Completed" value={`${summary.completed} · ${summary.rate}%`} tone="text-emerald-600" />
            <StatTile label="In progress" value={summary.inProgress} tone="text-sky-600" />
            <StatTile label="Pending" value={summary.pending} tone="text-amber-600" />
          </div>

          {leader && (
            <div className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4">
              <div className="rounded-full bg-amber-100 p-2.5 text-amber-600"><FiAward className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Leader</p>
                <p className="truncate font-semibold text-slate-900">{leader.name}</p>
                <p className="text-sm text-slate-600">
                  {leader.completed} completed of {leader.total} · {leader.rate}% completion
                </p>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {staff.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-slate-500">No applications have been assigned to staff yet.</p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {staff.map((r, i) => (
                  <li key={r.id} className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 && leader ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-500/10 text-xs font-semibold text-navy-700">{initials(r.name)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate font-medium text-slate-900">{r.name}</p>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">{r.rate}%</p>
                        </div>
                        <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${r.completed} completed, ${r.inProgress} in progress, ${r.pending} pending`}>
                          <div className="bg-emerald-500" style={{ width: `${r.total ? (r.completed / r.total) * 100 : 0}%` }} />
                          <div className="bg-sky-400" style={{ width: `${r.total ? (r.inProgress / r.total) * 100 : 0}%` }} />
                          <div className="bg-amber-400" style={{ width: `${r.total ? (r.pending / r.total) * 100 : 0}%` }} />
                        </div>
                        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                          <span><span className="font-semibold tabular-nums text-emerald-600">{r.completed}</span> completed</span>
                          <span><span className="font-semibold tabular-nums text-sky-600">{r.inProgress}</span> in progress</span>
                          <span><span className="font-semibold tabular-nums text-amber-600">{r.pending}</span> pending</span>
                          <span>{r.total} total</span>
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {unassigned > 0 && (
              <p className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
                {unassigned} application{unassigned === 1 ? ' is' : 's are'} not assigned to any staff yet.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const emptyForm = { name: '', description: '', serviceId: '', startDate: '', endDate: '', targetTokens: '' };

const CampaignManagement = ({ centreId: propCentreId }) => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [services, setServices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState(null);
  const [view, setView] = useState('expired'); // which list sits under "Running now"
  const [openId, setOpenId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const centreId = propCentreId || localStorage.getItem('centre_id');
  const userRole = localStorage.getItem('role');
  const token = localStorage.getItem('token');

  const sessionExpired = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('centre_id');
    navigate('/login');
  };

  useEffect(() => {
    if (!token) {
      toast.error('No authentication token found. Please log in.');
      navigate('/login');
      return;
    }
    if (!['admin', 'superadmin'].includes(userRole)) {
      toast.error('Access denied. Admins and superadmins only.');
      navigate('/login');
      return;
    }
    if (!centreId) {
      toast.error('Centre ID is missing. Please log in again.');
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setServicesLoading(true);
      try {
        const servicesRes = await getServices();
        if (!servicesRes.data || servicesRes.data.length === 0) {
          setServicesError('No services found in the database. Contact superadmin to add services.');
        } else {
          setServices(servicesRes.data);
          setServicesError(null);
        }
        const campaignsRes = await getCampaigns(centreId);
        setCampaigns(campaignsRes.data || []);
      } catch (err) {
        console.error('CampaignManagement.jsx: Error fetching data:', err);
        const errorMessage = err.response?.status === 401
          ? 'Session expired. Please log in again.'
          : err.response?.data?.error || 'Failed to load data. Please try again.';
        setServicesError(errorMessage);
        toast.error(errorMessage);
        if (err.response?.status === 401) sessionExpired();
      } finally {
        setLoading(false);
        setServicesLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centreId, navigate, userRole, token]);

  // Close dialogs with Esc
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (deleteTarget) setDeleteTarget(null);
      else if (showModal && !loading) resetForm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteTarget, showModal, loading]);

  const grouped = useMemo(() => {
    const g = { active: [], upcoming: [], expired: [] };
    campaigns.forEach((c) => g[getStatus(c)].push(c));
    g.active.sort((a, b) => endOf(a).localeCompare(endOf(b)));          // ending soonest first
    g.upcoming.sort((a, b) => startOf(a).localeCompare(startOf(b)));    // starting soonest first
    g.expired.sort((a, b) => endOf(b).localeCompare(endOf(a)));         // most recently ended first
    return g;
  }, [campaigns]);

  const runningTokens = useMemo(
    () => grouped.active.reduce((acc, c) => ({ gen: acc.gen + generatedOf(c), target: acc.target + targetOf(c) }), { gen: 0, target: 0 }),
    [grouped.active]
  );

  const listed = useMemo(() => {
    if (view === 'upcoming') return grouped.upcoming;
    if (view === 'expired') return grouped.expired;
    return [...grouped.active, ...grouped.upcoming, ...grouped.expired];
  }, [view, grouped]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateOrUpdateCampaign = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.serviceId || !formData.startDate || !formData.endDate || !formData.targetTokens) {
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

    const campaignData = {
      name: formData.name,
      description: formData.description,
      service_id: parseInt(formData.serviceId, 10),
      start_date: formData.startDate,
      end_date: formData.endDate,
      centre_id: parseInt(centreId, 10),
      target_tokens: parseInt(formData.targetTokens, 10),
    };
    const serviceName = services.find((s) => s.id === parseInt(formData.serviceId, 10))?.name;

    try {
      setLoading(true);
      if (isEditing) {
        await updateCampaign(selectedCampaign.id, campaignData);
        toast.success('Campaign updated successfully');
        setCampaigns((prev) => prev.map((c) => (c.id === selectedCampaign.id ? {
          ...c, ...campaignData, service_name: serviceName,
          startDate: campaignData.start_date, endDate: campaignData.end_date, target_tokens: campaignData.target_tokens,
        } : c)));
      } else {
        const res = await createCampaign(campaignData);
        toast.success('Campaign created successfully');
        setCampaigns((prev) => [...prev, {
          ...campaignData, id: res.data.id, service_name: serviceName,
          startDate: campaignData.start_date, endDate: campaignData.end_date, target_tokens: campaignData.target_tokens,
        }]);
      }
      resetForm();
    } catch (err) {
      console.error('CampaignManagement.jsx: Error saving campaign:', err);
      const errorMessage = err.response?.status === 401
        ? 'Session expired. Please log in again.'
        : err.response?.data?.error || 'Failed to save campaign. Please try again.';
      toast.error(errorMessage);
      if (err.response?.status === 401) sessionExpired();
    } finally {
      setLoading(false);
    }
  };

  const handleEditCampaign = (campaign) => {
    setIsEditing(true);
    setSelectedCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description || '',
      serviceId: String(campaign.service_id || campaign.serviceId || ''),
      startDate: startOf(campaign),
      endDate: endOf(campaign),
      targetTokens: String(targetOf(campaign)),
    });
    setShowModal(true);
  };

  const confirmDelete = async () => {
    const campaign = deleteTarget;
    if (!campaign) return;
    try {
      setLoading(true);
      await deleteCampaign(campaign.id);
      toast.success('Campaign deleted successfully');
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
      if (openId === campaign.id) setOpenId(null);
      setDeleteTarget(null);
    } catch (err) {
      console.error('CampaignManagement.jsx: Error deleting campaign:', err);
      const errorMessage = err.response?.status === 401
        ? 'Session expired. Please log in again.'
        : err.response?.data?.error || 'Failed to delete campaign. Please try again.';
      toast.error(errorMessage);
      if (err.response?.status === 401) sessionExpired();
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFetchServices = async () => {
    setServicesLoading(true);
    setServicesError(null);
    try {
      const servicesRes = await getServices();
      if (!servicesRes.data || servicesRes.data.length === 0) {
        setServicesError('No services found in the database. Contact superadmin to add services.');
      } else {
        setServices(servicesRes.data);
      }
    } catch (err) {
      console.error('CampaignManagement.jsx: Error retrying services fetch:', err);
      const errorMessage = err.response?.status === 401
        ? 'Session expired. Please log in again.'
        : err.response?.data?.error || 'Failed to load services. Please try again.';
      setServicesError(errorMessage);
      toast.error(errorMessage);
      if (err.response?.status === 401) sessionExpired();
    } finally {
      setServicesLoading(false);
    }
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
    setFormData(emptyForm);
    setShowModal(true);
  };

  const createDisabled = loading || servicesLoading || Boolean(servicesError);
  const nextUp = grouped.upcoming[0];

  const stats = [
    { label: 'Running now', value: grouped.active.length, icon: FiTrendingUp, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Upcoming', value: grouped.upcoming.length, icon: FiClock, tone: 'bg-sky-50 text-sky-600' },
    { label: 'Expired', value: grouped.expired.length, icon: FiArchive, tone: 'bg-slate-100 text-slate-500' },
    {
      label: 'Tokens now',
      value: grouped.active.length ? `${runningTokens.gen}${runningTokens.target ? ` / ${runningTokens.target}` : ''}` : '-',
      icon: FiCheckCircle,
      tone: 'bg-navy-500/10 text-navy-700',
    },
  ];

  const tabs = [
    { key: 'expired', label: 'Expired', count: grouped.expired.length },
    { key: 'upcoming', label: 'Upcoming', count: grouped.upcoming.length },
    { key: 'all', label: 'All campaigns', count: campaigns.length },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Campaigns</h1>
            <p className="mt-1 text-sm text-slate-500">Create and track service campaigns for your centre</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            disabled={createDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiPlus /> Create Campaign
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className={`rounded-lg p-2.5 ${tone}`}><Icon className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-500">{label}</p>
                <p className="truncate text-xl font-bold tabular-nums text-slate-900">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Running now */}
        <section aria-labelledby="running-heading" className="mb-10">
          <h2 id="running-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Running now</h2>
          {loading && campaigns.length === 0 ? (
            <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ) : grouped.active.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <FiTarget className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <h3 className="text-base font-semibold text-slate-800">No campaign is currently running</h3>
              <p className="mt-1 text-sm text-slate-500">
                {nextUp
                  ? `Next up: ${nextUp.name}, starting ${formatDate(startOf(nextUp))}.`
                  : 'Create a campaign to start tracking tokens for a service.'}
              </p>
              <button
                type="button"
                onClick={openCreate}
                disabled={createDisabled}
                className="mt-4 text-sm font-medium text-navy-700 hover:text-navy-800 disabled:opacity-50"
              >
                Create a campaign
              </button>
            </div>
          ) : (
            <div className={`grid gap-5 ${grouped.active.length > 1 ? 'lg:grid-cols-2' : ''}`}>
              {grouped.active.map((campaign) => (
                <article key={campaign.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-slate-900">{campaign.name}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1.5"><FiCalendar className="h-3.5 w-3.5" />{formatDate(startOf(campaign))} – {formatDate(endOf(campaign))}</span>
                        {serviceNameOf(campaign) && <span className="inline-flex items-center gap-1.5"><FiPackage className="h-3.5 w-3.5" />{serviceNameOf(campaign)}</span>}
                      </div>
                    </div>
                    <StatusChip status="active" />
                  </div>
                  <CampaignDetails campaign={campaign} status="active" onEdit={handleEditCampaign} onDelete={setDeleteTarget} />
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Staff performance */}
        {campaigns.length > 0 && <StaffPerformance campaigns={campaigns} centreId={centreId} />}

        {/* History / upcoming list */}
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
                  onClick={() => { setView(t.key); setOpenId(null); }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    view === t.key ? 'bg-navy-700 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
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
              {listed.map((campaign) => {
                const status = getStatus(campaign);
                const open = openId === campaign.id;
                const generated = generatedOf(campaign);
                const target = targetOf(campaign);
                return (
                  <li key={campaign.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : campaign.id)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-slate-900">{campaign.name}</span>
                          {view === 'all' && <StatusChip status={status} />}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-slate-500">
                          {formatDate(startOf(campaign))} – {formatDate(endOf(campaign))}
                          {serviceNameOf(campaign) ? ` · ${serviceNameOf(campaign)}` : ''}
                        </p>
                      </div>
                      <div className="hidden w-40 shrink-0 sm:block">
                        <p className="mb-1 text-right text-xs tabular-nums text-slate-500">{generated} / {target} tokens</p>
                        <Bar pct={tokenProgress(generated, target)} className="bg-navy-500" />
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
                            <CampaignDetails campaign={campaign} status={status} onEdit={handleEditCampaign} onDelete={setDeleteTarget} />
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
                  <span className="font-medium">{deleteTarget.name}</span> will be removed permanently.
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
                <button type="button" onClick={resetForm} disabled={loading} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <FiX />
                </button>
              </div>
              <form onSubmit={handleCreateOrUpdateCampaign} className="p-6">
                <div className="space-y-5">
                  <div>
                    <label htmlFor="cm-name" className="mb-1.5 block text-sm font-medium text-slate-700">Campaign name *</label>
                    <input
                      id="cm-name" type="text" name="name" value={formData.name} onChange={handleInputChange} required
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40"
                      placeholder="e.g., Diwali Offer"
                    />
                  </div>
                  <div>
                    <label htmlFor="cm-desc" className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                    <textarea
                      id="cm-desc" name="description" value={formData.description} onChange={handleInputChange} rows={3}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40"
                      placeholder="Describe the campaign goals..."
                    />
                  </div>
                  <div>
                    <label htmlFor="cm-service" className="mb-1.5 block text-sm font-medium text-slate-700">Service *</label>
                    {servicesLoading ? (
                      <p className="text-sm text-slate-500">Loading services...</p>
                    ) : servicesError ? (
                      <div className="text-sm text-rose-600">
                        {servicesError}
                        <button type="button" onClick={handleRetryFetchServices} className="ml-2 inline-flex items-center text-navy-700 hover:text-navy-800">
                          <FiRefreshCw className="mr-1" /> Retry
                        </button>
                      </div>
                    ) : services.length === 0 ? (
                      <p className="text-sm text-rose-600">No services available. Contact superadmin to add services.</p>
                    ) : (
                      <select
                        id="cm-service" name="serviceId" value={formData.serviceId} onChange={handleInputChange} required
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40"
                      >
                        <option value="">Select a service</option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>{service.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cm-start" className="mb-1.5 block text-sm font-medium text-slate-700">Start date *</label>
                      <input
                        id="cm-start" type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} required
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40"
                      />
                    </div>
                    <div>
                      <label htmlFor="cm-end" className="mb-1.5 block text-sm font-medium text-slate-700">End date *</label>
                      <input
                        id="cm-end" type="date" name="endDate" value={formData.endDate} min={formData.startDate || undefined} onChange={handleInputChange} required
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="cm-target" className="mb-1.5 block text-sm font-medium text-slate-700">Target tokens *</label>
                    <input
                      id="cm-target" type="number" name="targetTokens" value={formData.targetTokens} onChange={handleInputChange} min="0" required
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40"
                      placeholder="e.g., 100"
                    />
                  </div>
                </div>
                <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-5">
                  <button type="button" onClick={resetForm} disabled={loading} className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
                    Cancel
                  </button>
                  <button
                    type="submit" disabled={createDisabled}
                    className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Saving...' : isEditing ? 'Update Campaign' : 'Create Campaign'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignManagement;