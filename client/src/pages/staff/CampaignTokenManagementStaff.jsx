import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FiAward, FiUser, FiChevronRight, FiChevronDown, FiCheckCircle, FiClock,
  FiXCircle, FiLoader, FiSearch, FiChevronsUp, FiChevronsDown, FiRefreshCw,
  FiLayers
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL;
const getToken = () => (localStorage.getItem('token') || '').trim();
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

// ---------- date helpers (IST) ----------
const IST = 'Asia/Kolkata';
const toYmd = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { timeZone: IST });
};
const todayYmd = () => new Date().toLocaleDateString('en-CA', { timeZone: IST });
const formatDate = (value) => {
  const d = new Date(value);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST });
};
const isCampaignActive = (start, end) => {
  const s = toYmd(start);
  const e = toYmd(end);
  const t = todayYmd();
  return Boolean(s && e && s <= t && t <= e);
};

const isCampaignEnded = (end) => {
  const e = toYmd(end);
  return Boolean(e && e < todayYmd());
};
const shortDate = (value) => {
  const d = new Date(`${toYmd(value)}T00:00:00Z`);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

// ---------- status ----------
const normStatus = (s) => (s === 'in_progress' ? 'in-progress' : s);
const STATUS = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: FiClock },
  processed: { label: 'Processed', cls: 'bg-sky-50 text-sky-700 border-sky-200', Icon: FiCheckCircle },
  'in-progress': { label: 'In progress', cls: 'bg-violet-50 text-violet-700 border-violet-200', Icon: FiLoader },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: FiCheckCircle },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 border-slate-200', Icon: FiXCircle },
};
const StatusBadge = ({ status }) => {
  const key = normStatus(status);
  const cfg = STATUS[key] || { label: status || 'Unknown', cls: 'bg-slate-100 text-slate-600 border-slate-200', Icon: FiClock };
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
};

const SEG = {
  completed: '#10b981',
  inProgress: '#38bdf8',
  pending: '#fbbf24',
  other: '#cbd5e1',
};

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40';

const CampaignTokenManagementStaff = () => {
  const navigate = useNavigate();

  // campaigns + analytics
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [scope, setScope] = useState('all');
  const [showAllStaff, setShowAllStaff] = useState(false);

  // table
  const [tokens, setTokens] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0, limit: 20 });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [staffList, setStaffList] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());

  // cancel dialog
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // 'live' = campaigns running today, 'past' = campaigns that have ended. Upcoming campaigns have no tokens yet.
  const [mode, setMode] = useState('live');
  const liveCampaigns = useMemo(
    () => campaigns.filter((c) => isCampaignActive(c?.campaign_start, c?.campaign_end)),
    [campaigns]
  );
  const pastCampaigns = useMemo(
    () => campaigns
      .filter((c) => isCampaignEnded(c?.campaign_end))
      .sort((x, y) => toYmd(y.campaign_end).localeCompare(toYmd(x.campaign_end))),
    [campaigns]
  );
  const scopeCampaigns = mode === 'live' ? liveCampaigns : pastCampaigns;
  const scopeNames = useMemo(() => new Set(scopeCampaigns.map((c) => c.campaign_name)), [scopeCampaigns]);
  const ready = !campaignsLoading && scopeCampaigns.length > 0;

  // Query params that limit a request to the current view. One campaign in view -> pass its id (works on any backend);
  // several -> campaign_state (needs the matching backend change).
  const scopeParams = (campaignId) => {
    if (campaignId && campaignId !== 'all') return { campaign_id: campaignId };
    if (scopeCampaigns.length === 1) return { campaign_id: String(scopeCampaigns[0].campaign_id) };
    return mode === 'live' ? { live_only: '1', campaign_state: 'live' } : { campaign_state: 'ended' };
  };

  const campaignLabel = (c) => (mode === 'past'
    ? `${c.campaign_name} (${shortDate(c.campaign_start)} – ${shortDate(c.campaign_end)})`
    : c.campaign_name);
  const allLabel = scopeCampaigns.length === 1
    ? campaignLabel(scopeCampaigns[0])
    : (mode === 'live' ? 'All live campaigns' : 'All past campaigns');

  const switchMode = (next) => {
    if (next === mode) return;
    setMode(next);
    setScope('all');
    setCampaignFilter('all');
    setPage(1);
    setExpandedRows(new Set());
    setShowAllStaff(false);
    setStats(null);
    setTokens([]);
  };

  // if the picked campaign leaves this view, fall back to the whole view
  useEffect(() => {
    const inView = (id) => scopeCampaigns.some((c) => String(c.campaign_id) === String(id));
    if (!campaignsLoading && scope !== 'all' && !inView(scope)) setScope('all');
    if (!campaignsLoading && campaignFilter !== 'all' && !inView(campaignFilter)) setCampaignFilter('all');
  }, [scopeCampaigns, campaignsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const tableReq = useRef(0);
  const statsReq = useRef(0);

  // ---------- data ----------
  const loadCampaigns = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/servicemanagement/staff/campaign-tokens`, { headers: authHeaders() });
      setCampaigns(res.data?.campaigns || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load campaign data');
    } finally {
      setCampaignsLoading(false);
    }
  };

  const loadStats = async () => {
    const req = ++statsReq.current;
    setStatsLoading(true);
    setStatsError(false);
    try {
      const params = new URLSearchParams(scopeParams(scope));
      const res = await axios.get(`${API_BASE_URL}/api/servicemanagement/campaigns/stats?${params.toString()}`, { headers: authHeaders() });
      if (req === statsReq.current) setStats(res.data);
    } catch (err) {
      console.error(err);
      if (req === statsReq.current) setStatsError(true);
    } finally {
      if (req === statsReq.current) setStatsLoading(false);
    }
  };

  const loadTokens = async () => {
    const req = ++tableReq.current;
    setTableLoading(true);
    setTableError(false);
    try {
      const params = new URLSearchParams({
        page,
        limit: pagination.limit,
        status: statusFilter,
        search: debouncedSearch,
        staff_id: staffFilter,
        ...scopeParams(campaignFilter),
      });
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const res = await axios.get(`${API_BASE_URL}/api/servicemanagement/campaign-tokens/table?${params.toString()}`, { headers: authHeaders() });
      if (req !== tableReq.current) return;
      // safety net: never show tokens of a campaign outside the current view
      setTokens((res.data?.tokens || []).filter((t) => !t.campaignName || scopeNames.has(t.campaignName)));
      setPagination((prev) => ({ ...prev, total: res.data?.total || 0, pages: res.data?.pages || 0 }));
    } catch (err) {
      console.error(err);
      if (req !== tableReq.current) return;
      setTableError(true);
      toast.error('Failed to load tokens');
    } finally {
      if (req === tableReq.current) setTableLoading(false);
    }
  };

  useEffect(() => { loadCampaigns(); }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!getToken()) return;
        const res = await axios.get(`${API_BASE_URL}/api/servicemanagement/staff`, { headers: authHeaders() });
        setStaffList(res.data || []);
      } catch (err) {
        console.error('Failed to fetch staff list:', err);
      }
    })();
  }, []);

  useEffect(() => { if (ready) loadStats(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [scope, ready, mode]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch((prev) => {
        if (prev !== search) setPage(1);
        return search;
      });
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // one fetch for any table change
  useEffect(() => { if (ready) loadTokens(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ready, mode, page, dateFrom, dateTo, campaignFilter, statusFilter, staffFilter, debouncedSearch]);

  // filter setters reset to page 1 in the same render, so only one request goes out
  const filter = (setter) => (e) => { setter(e.target.value); setPage(1); };

  // ---------- derived ----------
  const overall = useMemo(() => {
    const all = scopeCampaigns.flatMap((c) => c?.tokens || []);
    const completed = all.filter((t) => t?.token_status === 'completed' || t?.service_status === 'completed').length;
    return {
      total: all.length,
      completed,
      rate: all.length ? Math.round((completed / all.length) * 100) : 0,
      active: scopeCampaigns.length,
    };
  }, [scopeCampaigns]);

  const view = useMemo(() => {
    const ss = stats?.status_summary || {};
    const total = Number(stats?.total_tokens) || 0;
    const completed = Number(ss.completed) || 0;
    const inProgress = (Number(ss.in_progress) || 0) + (Number(ss.processed) || 0);
    const pending = Number(ss.pending) || 0;
    const other = Math.max(0, total - completed - inProgress - pending);

    const staff = (stats?.staff_contributions || []).map((s) => {
      const t = Number(s.total_tokens) || 0;
      const c = Number(s.completed_tokens) || 0;
      return {
        id: s.staff_id,
        name: s.staff_name || `Staff ${s.staff_id}`,
        total: t,
        completed: c,
        inProgress: Number(s.in_progress_tokens) || 0,
        pending: Number(s.pending_tokens) || 0,
        rate: t ? Math.round((c / t) * 100) : 0,
      };
    }).sort((a, b) => b.completed - a.completed || b.rate - a.rate || b.total - a.total || a.name.localeCompare(b.name));

    const perCampaign = (stats?.campaign_summary || []).filter((c) => !c.campaign_name || scopeNames.has(c.campaign_name)).map((c) => ({
      id: c.campaign_id,
      name: c.campaign_name,
      total: Number(c.total_tokens) || 0,
      completed: Number(c.completed_tokens) || 0,
      rate: Math.round(Number(c.completion_rate) || 0),
    }));

    const top = perCampaign.reduce((m, c) => (c.total > (m?.total || 0) ? c : m), null);
    return {
      total, completed, inProgress, pending, other,
      rate: total ? Math.round((completed / total) * 100) : 0,
      staff,
      assigned: staff.reduce((n, s) => n + s.total, 0),
      perCampaign,
      top,
      activeStaff: staff.filter((s) => s.total > 0).length,
    };
  }, [stats, scopeNames]);

  const segments = [
    { key: 'completed', label: 'Completed', value: view.completed, color: SEG.completed, text: 'text-emerald-600' },
    { key: 'inProgress', label: 'In progress', value: view.inProgress, color: SEG.inProgress, text: 'text-sky-600' },
    { key: 'pending', label: 'Pending', value: view.pending, color: SEG.pending, text: 'text-amber-600' },
    ...(view.other > 0 ? [{ key: 'other', label: 'Other', value: view.other, color: SEG.other, text: 'text-slate-500' }] : []),
  ];
  const drawn = segments.filter((s) => s.value > 0);
  let acc = 0;
  const arcs = drawn.map((s) => {
    const pct = view.total ? (s.value / view.total) * 100 : 0;
    const gap = drawn.length > 1 ? 0.6 : 0;
    const arc = { ...s, dash: `${Math.max(0, pct - gap)} ${100 - pct + gap}`, offset: 25 - acc };
    acc += pct;
    return arc;
  });

  const leader = view.staff.length && view.staff[0].completed > 0 ? view.staff[0] : null;
  const STAFF_LIMIT = 5;
  const staffRows = showAllStaff ? view.staff : view.staff.slice(0, STAFF_LIMIT);
  const maxStaffTotal = Math.max(1, ...view.staff.map((s) => s.total));
  const unassigned = Math.max(0, view.total - view.assigned);

  // ---------- actions ----------
  const handleServiceAction = (trackingId, tokenCode) => {
    if (trackingId) navigate(`/dashboard/staff/track_service/${trackingId}`);
    else navigate(`/dashboard/staff/token/${tokenCode}/service`);
  };

  const closeCancel = () => {
    if (cancelling) return;
    setCancelTarget(null);
    setCancelReason('');
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    try {
      await axios.put(
        `${API_BASE_URL}/api/servicemanagement/tokens/${cancelTarget.tokenCode}/cancel`,
        { reason: cancelReason.trim() || null },
        { headers: authHeaders() }
      );
      toast.success(`Token ${cancelTarget.tokenCode} cancelled successfully`);
      setCancelTarget(null);
      setCancelReason('');
      loadTokens();
      loadCampaigns();
      loadStats();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to cancel token');
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    if (!cancelTarget) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelTarget, cancelling]);

  const toggleRow = (code) => setExpandedRows((prev) => {
    const next = new Set(prev);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  const allExpanded = tokens.length > 0 && tokens.every((t) => expandedRows.has(t.tokenCode));

  const hasFilters = dateFrom || dateTo || campaignFilter !== 'all' || statusFilter !== 'all' || staffFilter !== 'all' || search;
  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setCampaignFilter('all'); setStatusFilter('all'); setStaffFilter('all');
    setSearch(''); setDebouncedSearch(''); setPage(1);
  };

  const summary = [
    { label: mode === 'live' ? 'Live campaign tokens' : 'Past campaign tokens', value: overall.total, tone: 'text-slate-900' },
    { label: 'Completed', value: `${overall.completed} · ${overall.rate}%`, tone: 'text-emerald-600' },
    { label: mode === 'live' ? 'Pending now' : 'Never completed', value: stats ? Number(stats.status_summary?.pending) || 0 : '-', tone: 'text-amber-600' },
    { label: mode === 'live' ? 'Live campaigns' : 'Past campaigns', value: overall.active, tone: 'text-navy-700' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-navy-700 p-3 text-white shadow-sm"><FiAward className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Campaign Tokens</h1>
            <p className="text-sm text-slate-500">Track and manage campaign service requests</p>
          </div>
        </div>

        {/* Live / past switch */}
        {!campaignsLoading && (
          <div role="tablist" aria-label="Campaign view" className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1">
            {[
              { key: 'live', label: 'Live now', count: liveCampaigns.length },
              { key: 'past', label: 'Past campaigns', count: pastCampaigns.length },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={mode === t.key}
                onClick={() => switchMode(t.key)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${mode === t.key ? 'bg-navy-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {t.label}
                <span className={`ml-1.5 text-xs tabular-nums ${mode === t.key ? 'text-white/70' : 'text-slate-400'}`}>{t.count}</span>
              </button>
            ))}
          </div>
        )}

        {campaignsLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-[4.25rem] animate-pulse rounded-xl border border-slate-200 bg-white" />)}
          </div>
        ) : scopeCampaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <FiAward className="mx-auto mb-3 h-9 w-9 text-slate-300" />
            {mode === 'live' ? (
              <>
                <h2 className="text-lg font-semibold text-slate-800">No campaign is currently running</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Tokens of a campaign appear here while it is live.</p>
                {pastCampaigns.length > 0 && (
                  <button type="button" onClick={() => switchMode('past')} className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-slate-50">
                    View {pastCampaigns.length} past campaign{pastCampaigns.length === 1 ? '' : 's'}
                  </button>
                )}
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-800">No past campaigns yet</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Campaigns that have ended will be listed here with their tokens.</p>
              </>
            )}
          </div>
        ) : (
          <>
        {/* Summary strip */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {summary.map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">{s.label}</p>
              {campaignsLoading ? (
                <div className="mt-1.5 h-6 w-16 animate-pulse rounded bg-slate-100" />
              ) : (
                <p className={`mt-0.5 text-xl font-bold tabular-nums ${s.tone}`}>{s.value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Analytics */}
        <section aria-labelledby="analytics-heading" className="mb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="analytics-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">Analytics</h2>
            <select
              value={scope}
              onChange={(e) => { setScope(e.target.value); setShowAllStaff(false); }}
              aria-label="Campaign for analytics"
              className="max-w-[15rem] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-500/40"
            >
              <option value="all">{allLabel}</option>
              {scopeCampaigns.length > 1 && scopeCampaigns.map((c) => <option key={c.campaign_id} value={c.campaign_id}>{campaignLabel(c)}</option>)}
            </select>
          </div>

          {statsLoading && !stats ? (
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-2" />
              <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-3" />
            </div>
          ) : statsError && !stats ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
              <span>Could not load analytics.</span>
              <button type="button" onClick={loadStats} className="inline-flex items-center gap-1.5 font-medium hover:text-rose-900"><FiRefreshCw className="h-3.5 w-3.5" /> Retry</button>
            </div>
          ) : view.total === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-500">
              No campaign tokens {scope === 'all' ? 'yet' : 'for this campaign yet'}.
            </div>
          ) : (
            <div className={`space-y-4 transition-opacity ${statsLoading ? 'opacity-60' : ''}`}>
              <div className="grid gap-4 lg:grid-cols-5">
                {/* status donut */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
                  <h3 className="text-sm font-semibold text-slate-800">Token status</h3>
                  <div className="mt-4 flex items-center gap-5">
                    <div className="relative h-32 w-32 shrink-0">
                      <svg viewBox="0 0 36 36" className="h-full w-full" role="img" aria-label={`${view.completed} of ${view.total} tokens completed`}>
                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="4.5" />
                        {arcs.map((a) => (
                          <circle key={a.key} cx="18" cy="18" r="15.9155" fill="none" stroke={a.color} strokeWidth="4.5" strokeDasharray={a.dash} strokeDashoffset={a.offset} />
                        ))}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold tabular-nums text-slate-900">{view.rate}%</span>
                        <span className="text-[11px] text-slate-500">completed</span>
                      </div>
                    </div>
                    <ul className="min-w-0 flex-1 space-y-2">
                      {segments.map((s) => (
                        <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />{s.label}</span>
                          <span className={`font-semibold tabular-nums ${s.text}`}>{s.value}</span>
                        </li>
                      ))}
                      <li className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-sm">
                        <span className="text-slate-500">Total</span>
                        <span className="font-semibold tabular-nums text-slate-800">{view.total}</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* staff leaderboard */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">Tokens by staff</h3>
                    {leader && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        <FiAward className="h-3.5 w-3.5" /> Leader <span className="max-w-[9rem] truncate font-bold">{leader.name}</span>
                      </span>
                    )}
                  </div>
                  {view.staff.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No tokens have been assigned to staff yet.</p>
                  ) : (
                    <ol className="mt-4 space-y-3">
                      {staffRows.map((r, i) => (
                        <li key={r.id} className="grid grid-cols-[1.25rem_minmax(0,6.5rem)_minmax(0,1fr)_2.5rem] items-center gap-x-3 sm:grid-cols-[1.25rem_minmax(0,8rem)_minmax(0,1fr)_2.5rem]">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${i === 0 && leader ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                          <span className="truncate text-sm font-medium text-slate-800" title={r.name}>{r.name}</span>
                          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${r.completed} completed, ${r.inProgress} in progress, ${r.pending} pending`} title={`${r.completed} completed · ${r.inProgress} in progress · ${r.pending} pending`}>
                            <div className="flex h-full overflow-hidden rounded-full" style={{ width: `${(r.total / maxStaffTotal) * 100}%` }}>
                              <div className="bg-emerald-500" style={{ width: `${r.total ? (r.completed / r.total) * 100 : 0}%` }} />
                              <div className="bg-sky-400" style={{ width: `${r.total ? (r.inProgress / r.total) * 100 : 0}%` }} />
                              <div className="bg-amber-400" style={{ width: `${r.total ? (r.pending / r.total) * 100 : 0}%` }} />
                            </div>
                          </div>
                          <span className="text-right text-sm font-semibold tabular-nums text-slate-700">{r.total}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {(view.staff.length > STAFF_LIMIT || unassigned > 0) && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <span>{unassigned > 0 ? `${unassigned} not assigned to staff yet` : ''}</span>
                      {view.staff.length > STAFF_LIMIT && (
                        <button type="button" onClick={() => setShowAllStaff((v) => !v)} className="font-medium text-navy-700 hover:text-navy-800">
                          {showAllStaff ? `Show top ${STAFF_LIMIT}` : `Show all ${view.staff.length}`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* per-campaign completion (all-campaigns view only) */}
              {scope === 'all' && view.perCampaign.length > 1 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FiLayers className="h-4 w-4 text-slate-400" /> Campaign completion</h3>
                    {view.top && <span className="text-xs text-slate-500">Most active: <span className="font-medium text-slate-700">{view.top.name}</span> ({view.top.total} tokens)</span>}
                  </div>
                  <ul className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
                    {view.perCampaign.map((c) => (
                      <li key={c.id}>
                        <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-medium text-slate-700" title={c.name}>{c.name}</span>
                          <span className="shrink-0 text-xs tabular-nums text-slate-500">{c.completed}/{c.total} · {c.rate}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-navy-500" style={{ width: `${c.rate}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Tokens table */}
        <section aria-labelledby="tokens-heading" className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="tokens-heading" className="text-base font-semibold text-slate-900">
                Tokens <span className="ml-1 text-sm font-normal text-slate-400">{pagination.total}</span>
              </h2>
              <div className="flex items-center gap-2">
                {hasFilters && <button type="button" onClick={clearFilters} className="text-sm font-medium text-slate-500 hover:text-navy-700">Clear filters</button>}
                <button
                  type="button"
                  onClick={() => setExpandedRows(allExpanded ? new Set() : new Set(tokens.map((t) => t.tokenCode)))}
                  disabled={tokens.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {allExpanded ? <><FiChevronsUp className="h-4 w-4" /> Collapse all</> : <><FiChevronsDown className="h-4 w-4" /> Expand all</>}
                </button>
              </div>
            </div>

            <div className="relative mb-3">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search token ID, customer, phone, campaign or staff..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search tokens"
                className={`${inputCls} pl-9`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <label className="text-xs text-slate-500">From
                <input type="date" value={dateFrom} max={dateTo || undefined} onChange={filter(setDateFrom)} className={`${inputCls} mt-1`} />
              </label>
              <label className="text-xs text-slate-500">To
                <input type="date" value={dateTo} min={dateFrom || undefined} onChange={filter(setDateTo)} className={`${inputCls} mt-1`} />
              </label>
              <label className="text-xs text-slate-500">Campaign
                <select value={campaignFilter} onChange={filter(setCampaignFilter)} className={`${inputCls} mt-1`}>
                  <option value="all">{allLabel}</option>
                  {scopeCampaigns.length > 1 && scopeCampaigns.map((c) => <option key={c.campaign_id} value={c.campaign_id}>{campaignLabel(c)}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-500">Staff
                <select value={staffFilter} onChange={filter(setStaffFilter)} className={`${inputCls} mt-1`}>
                  <option value="all">All staff</option>
                  {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-500">Status
                <select value={statusFilter} onChange={filter(setStatusFilter)} className={`${inputCls} mt-1`}>
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processed">Processed</option>
                  <option value="completed">Completed</option>
                  <option value="in-progress">In progress</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>
          </div>

          <div className="relative overflow-x-auto">
            <table className="w-full md:min-w-[640px]">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Token</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="hidden px-4 py-3 md:table-cell">Campaign</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Staff</th>
                  <th className="hidden px-4 py-3 md:table-cell">Status</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Created</th>
                  <th className="hidden px-4 py-3 text-right md:table-cell">Action</th>
                  <th className="w-8 px-2 py-3"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableLoading && tokens.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan="8" className="px-4 py-3"><div className="h-6 animate-pulse rounded bg-slate-100" /></td></tr>
                  ))
                ) : tableError && tokens.length === 0 ? (
                  <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-rose-600">
                    Could not load tokens.{' '}
                    <button type="button" onClick={loadTokens} className="font-medium underline">Retry</button>
                  </td></tr>
                ) : tokens.length === 0 ? (
                  <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-500">No tokens found</td></tr>
                ) : (
                  tokens.map((token) => {
                    const open = expandedRows.has(token.tokenCode);
                    const cancelled = token.status === 'cancelled';
                    return (
                      <React.Fragment key={token.tokenCode}>
                        <tr className={`transition-colors hover:bg-slate-50 ${tableLoading ? 'opacity-60' : ''}`}>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-slate-800">{token.tokenCode}</td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-slate-900">{token.customerName}</div>
                            <div className="text-xs text-slate-500">{token.phone}</div>
                            {/* phones: status and actions live under the customer so nothing scrolls off-screen */}
                            <div className="mt-1.5 md:hidden"><StatusBadge status={token.status} /></div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
                              {cancelled ? (
                                <span className="text-xs text-slate-400">Cancelled</span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleServiceAction(token.trackingId, token.tokenCode)}
                                    className="rounded-lg bg-navy-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-navy-800"
                                  >
                                    {token.trackingId ? 'View service' : 'Start service'}
                                  </button>
                                  {mode === 'live' && (
                                  <button
                                    type="button"
                                    onClick={() => { setCancelTarget({ tokenCode: token.tokenCode, customerName: token.customerName }); setCancelReason(''); }}
                                    className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                                  >
                                    Cancel
                                  </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-sm text-slate-600 md:table-cell">{token.campaignName}</td>
                          <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-slate-600 lg:table-cell">
                            <span className="inline-flex items-center gap-1.5"><FiUser className="h-3 w-3 text-slate-400" />{token.staffName || 'Unassigned'}</span>
                          </td>
                          <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell"><StatusBadge status={token.status} /></td>
                          <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-slate-500 lg:table-cell">{formatDate(token.created_at)}</td>
                          <td className="hidden whitespace-nowrap px-4 py-3 text-right md:table-cell">
                            {cancelled ? (
                              <span className="text-sm text-slate-400">Cancelled</span>
                            ) : (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleServiceAction(token.trackingId, token.tokenCode)}
                                  className="rounded-lg bg-navy-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800"
                                >
                                  {token.trackingId ? 'View service' : 'Start service'}
                                </button>
                                {mode === 'live' && (
                                <button
                                  type="button"
                                  onClick={() => { setCancelTarget({ tokenCode: token.tokenCode, customerName: token.customerName }); setCancelReason(''); }}
                                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                                >
                                  Cancel
                                </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              onClick={() => toggleRow(token.tokenCode)}
                              aria-expanded={open}
                              aria-label={open ? 'Hide details' : 'Show details'}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                              {open ? <FiChevronDown /> : <FiChevronRight />}
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-50/70">
                            <td colSpan="8" className="px-4 py-4">
                              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
                                <div className="md:hidden"><dt className="text-xs text-slate-500">Campaign</dt><dd className="text-slate-800">{token.campaignName || '-'}</dd></div>
                                <div className="lg:hidden"><dt className="text-xs text-slate-500">Staff</dt><dd className="text-slate-800">{token.staffName || 'Unassigned'}</dd></div>
                                <div className="lg:hidden"><dt className="text-xs text-slate-500">Created</dt><dd className="text-slate-800">{formatDate(token.created_at)}</dd></div>
                                <div><dt className="text-xs text-slate-500">Service</dt><dd className="text-slate-800">{token.serviceName || '-'}</dd></div>
                                <div><dt className="text-xs text-slate-500">Subcategory</dt><dd className="text-slate-800">{token.subcategoryName || '-'}</dd></div>
                                <div><dt className="text-xs text-slate-500">Application number</dt><dd className="font-mono text-slate-800">{token.applicationNumber || '-'}</dd></div>
                                <div>
                                  <dt className="text-xs text-slate-500">Progress</dt>
                                  <dd className="text-slate-800">
                                    {token.progress !== undefined && token.progress !== null ? (
                                      <span className="flex items-center gap-2">
                                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200"><span className="block h-1.5 rounded-full bg-navy-500" style={{ width: `${Math.min(100, Number(token.progress) || 0)}%` }} /></span>
                                        {token.progress}%
                                      </span>
                                    ) : '-'}
                                  </dd>
                                </div>
                              </dl>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Previous</button>
              <span className="text-sm text-slate-500">Page {page} of {pagination.pages}</span>
              <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
          )}
        </section>

          </>
        )}

        {/* Cancel dialog */}
        {cancelTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
            onMouseDown={(e) => { if (e.target === e.currentTarget) closeCancel(); }}
          >
            <div role="alertdialog" aria-modal="true" aria-label="Cancel token" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-semibold text-slate-900">Cancel this token?</h3>
              <p className="mt-2 text-sm text-slate-600">
                Token <span className="font-mono font-semibold">{cancelTarget.tokenCode}</span> for <span className="font-medium">{cancelTarget.customerName}</span> will be cancelled.
              </p>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Reason <span className="font-normal text-slate-400">(optional)</span>
                <textarea
                  autoFocus
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  className={`${inputCls} mt-1.5`}
                  placeholder="e.g., customer request, duplicate entry..."
                />
              </label>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={closeCancel} disabled={cancelling} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Keep token</button>
                <button type="button" onClick={handleCancelConfirm} disabled={cancelling} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60">
                  {cancelling ? 'Cancelling...' : 'Cancel token'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignTokenManagementStaff;