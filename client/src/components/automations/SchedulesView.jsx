// src/components/automations/SchedulesView.jsx
// Messenger → Schedules: every scheduled reminder / auto-task in the centre.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  FiClock, FiSearch, FiRefreshCw, FiSend, FiX, FiEdit2, FiCheck, FiRotateCcw,
  FiAlertCircle, FiCalendar, FiUser, FiPhone, FiUserCheck, FiZap,
} from 'react-icons/fi';
import { TypeIcon } from './AutomationBuilder';
import ServiceLinkChip from './ServiceLinkChip';
import { formatWhen, toLocalInput } from './automationUtils';
import {
  listSchedules, cancelAutomation, runAutomationNow, rescheduleAutomation,
} from '/src/services/automationService';

const PAGE_SIZE = 50;
const AUTO_REFRESH_MS = 60 * 1000;

const TABS = [
  { id: 'upcoming',  label: 'Upcoming' },
  { id: 'failed',    label: 'Failed' },
  { id: 'done',      label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all',       label: 'All' },
];

const STATUS = {
  pending:    { label: 'Scheduled', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  processing: { label: 'Sending…',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  done:       { label: 'Done',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed:     { label: 'Failed',    cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  cancelled:  { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const btnCls =
  'inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition disabled:opacity-50';

const isWA = (a) => a.action_type === 'whatsapp_template';
const labelOf = (a) => a.payload?.label || a.template_key || a.payload?.task_title || 'Scheduled action';

// "Today" / "Tomorrow" / "Wed, 14 Oct" in the browser's (IST) time
function dayLabel(date) {
  const d = new Date(date);
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(d) - start(new Date())) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: diff > 300 || diff < -300 ? 'numeric' : undefined });
}

const timeOnly = (date) =>
  new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

/* ================================================================= */

export default function SchedulesView({ currentUser = {}, centresMap = {} }) {
  const isSuperadmin = currentUser.role === 'superadmin';

  const [tab, setTab] = useState('upcoming');
  const [type, setType] = useState('');
  const [mine, setMine] = useState(false);
  const [centreId, setCentreId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ upcoming: 0, today: 0, failed: 0, done_7d: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState({ id: null, value: '' });

  const requestId = useRef(0);

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = useMemo(() => {
    const p = { status: tab, limit: PAGE_SIZE };
    if (type) p.type = type;
    if (mine) p.mine = 'true';
    if (search) p.search = search;
    if (isSuperadmin && centreId) p.centre_id = centreId;
    return p;
  }, [tab, type, mine, search, centreId, isSuperadmin]);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++requestId.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await listSchedules({ ...params, offset: 0 });
        if (id !== requestId.current) return; // a newer request already answered
        setItems(data.items || []);
        setHasMore(Boolean(data.hasMore));
        setCounts(data.counts || {});
      } catch (e) {
        if (id !== requestId.current) return;
        setError(e.response?.data?.error || 'Failed to load schedules');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [params]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Keep it fresh: every minute, and when the tab regains focus (not while editing a time)
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && !editing.id) load({ silent: true });
    };
    const timer = setInterval(refresh, AUTO_REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load, editing.id]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await listSchedules({ ...params, offset: items.length });
      setItems((prev) => [...prev, ...(data.items || [])]);
      setHasMore(Boolean(data.hasMore));
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  };

  const act = async (id, fn, successMsg) => {
    setBusyId(id);
    try {
      const res = await fn();
      toast.success(res?.message || successMsg);
      await load({ silent: true });
    } catch (e) {
      toast.error(e.response?.data?.error || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  // Group by day (upcoming: by run time; history: by when it happened)
  const groups = useMemo(() => {
    const keyDate = (a) =>
      tab === 'upcoming' ? a.run_at : a.executed_at || a.cancelled_at || a.updated_at || a.run_at;
    const map = new Map();
    for (const a of items) {
      const label = dayLabel(keyDate(a));
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(a);
    }
    return [...map.entries()];
  }, [items, tab]);

  const centreOptions = Object.entries(centresMap || {});

  /* ---------------------------------------------------------------- */

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2.5 rounded-xl">
              <FiZap className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Schedules</h2>
              <p className="text-sm text-gray-500">WhatsApp reminders and auto-tasks the system will run</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Stat cards (click to filter) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Upcoming" value={counts.upcoming} tone="indigo" icon={FiClock}
            active={tab === 'upcoming'} onClick={() => setTab('upcoming')} />
          <StatCard label="Due today" value={counts.today} tone="amber" icon={FiCalendar}
            active={false} onClick={() => setTab('upcoming')} />
          <StatCard label="Failed" value={counts.failed} tone="rose" icon={FiAlertCircle}
            active={tab === 'failed'} onClick={() => setTab('failed')} />
          <StatCard label="Done (7 days)" value={counts.done_7d} tone="emerald" icon={FiCheck}
            active={tab === 'done'} onClick={() => setTab('done')} />
        </div>

        {/* Tabs + filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex overflow-x-auto border-b border-gray-200">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {t.label}
                {t.id === 'failed' && counts.failed > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                    {counts.failed}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search customer, phone or reminder"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="">All types</option>
              <option value="whatsapp_template">WhatsApp to customer</option>
              <option value="staff_task">Task for staff</option>
            </select>

            {isSuperadmin && centreOptions.length > 0 && (
              <select
                value={centreId}
                onChange={(e) => setCentreId(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="">All centres</option>
                {centreOptions.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            )}

            <label className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white cursor-pointer select-none">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="rounded text-indigo-600" />
              Only mine
            </label>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
            <FiAlertCircle className="mx-auto h-8 w-8 text-rose-500 mb-2" />
            <p className="text-rose-700 font-medium">{error}</p>
            <button type="button" onClick={() => load()}
              className="mt-3 px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700">
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState tab={tab} filtered={Boolean(type || mine || search || centreId)} />
        ) : (
          <div className="space-y-5">
            {groups.map(([day, rows]) => (
              <div key={day}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wide ${day === 'Today' ? 'text-indigo-700' : 'text-gray-500'}`}>
                    {day}
                  </span>
                  <span className="text-xs text-gray-400">({rows.length})</span>
                  <span className="flex-1 h-px bg-gray-200" />
                </div>

                <div className="space-y-2">
                  {rows.map((a) => (
                    <ScheduleRow
                      key={a.id}
                      a={a}
                      tab={tab}
                      showCentre={isSuperadmin && !centreId}
                      busy={busyId === a.id}
                      editing={editing}
                      setEditing={setEditing}
                      act={act}
                    />
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="flex justify-center">
                <button type="button" onClick={loadMore} disabled={loadingMore}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================= */

function ScheduleRow({ a, tab, showCentre, busy, editing, setEditing, act }) {
  const st = STATUS[a.status] || STATUS.pending;
  const whatsapp = isWA(a);
  const phone = a.customer_phone || a.entry_phone;
  const statusText =
    a.status === 'done' ? (whatsapp ? 'Sent' : 'Task created') : st.label;

  const when =
    a.status === 'done' && a.executed_at ? a.executed_at
    : a.status === 'cancelled' && a.cancelled_at ? a.cancelled_at
    : a.run_at;

  const isOverdue = a.status === 'pending' && new Date(a.run_at) < new Date(Date.now() - 2 * 60 * 1000);

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-3 sm:p-4 ${a.status === 'failed' ? 'border-rose-200' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        {/* Time */}
        <div className="w-16 shrink-0 text-center">
          <div className="text-sm font-bold text-gray-900">{timeOnly(when)}</div>
          {tab !== 'upcoming' && <div className="text-[10px] text-gray-400">{dayLabel(when)}</div>}
        </div>

        <TypeIcon actionType={a.action_type} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{labelOf(a)}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${st.cls}`}>{statusText}</span>
            {isOverdue && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-200">
                Waiting to run
              </span>
            )}
            {showCentre && a.centre_name && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{a.centre_name}</span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
            {a.customer_name && (
              <span className="inline-flex items-center gap-1"><FiUser className="h-3 w-3 text-gray-400" />{a.customer_name}</span>
            )}
            {whatsapp && phone && (
              <span className="inline-flex items-center gap-1"><FiPhone className="h-3 w-3 text-gray-400" />{phone}</span>
            )}
            {a.service_entry_id && <ServiceLinkChip item={a} />}
            {!whatsapp && a.assignee_name && (
              <span className="inline-flex items-center gap-1"><FiUserCheck className="h-3 w-3 text-gray-400" />{a.assignee_name}</span>
            )}
          </div>

          <div className="mt-1 text-[11px] text-gray-400">
            {a.status === 'pending' || a.status === 'processing'
              ? `Runs ${formatWhen(new Date(a.run_at))}`
              : `Scheduled for ${formatWhen(new Date(a.run_at))}`}
            {a.created_by_name && ` · by ${a.created_by_name}`}
            {a.task_id && ` · Task #${a.task_id}${a.task_status ? ` (${a.task_status})` : ''}`}
          </div>

          {a.last_error && ['failed', 'pending', 'cancelled'].includes(a.status) && (
            <div className={`mt-1 text-[11px] flex gap-1 ${a.status === 'failed' ? 'text-rose-600' : 'text-gray-500'}`}>
              <FiAlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              {a.status === 'pending' ? `Retrying: ${a.last_error}` : a.last_error}
            </div>
          )}

          {editing.id === a.id && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="datetime-local"
                value={editing.value}
                min={toLocalInput(new Date())}
                onChange={(e) => setEditing({ id: a.id, value: e.target.value })}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md"
              />
              <button
                type="button"
                disabled={busy || !editing.value}
                onClick={() =>
                  act(a.id, () => rescheduleAutomation(a.id, editing.value), 'Rescheduled').then(() =>
                    setEditing({ id: null, value: '' })
                  )
                }
                className={`${btnCls} border-indigo-200 text-indigo-700 hover:bg-indigo-50`}
              >
                <FiCheck className="h-3 w-3" /> Save
              </button>
              <button type="button" onClick={() => setEditing({ id: null, value: '' })}
                className="text-gray-400 hover:text-gray-600 p-1">
                <FiX className="h-3 w-3" />
              </button>
            </div>
          )}

          {['pending', 'failed'].includes(a.status) && editing.id !== a.id && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {a.status === 'pending' && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (whatsapp && !window.confirm(`Send "${labelOf(a)}" to ${a.customer_name || 'the customer'} now?`)) return;
                      act(a.id, () => runAutomationNow(a.id), 'Queued');
                    }}
                    className={`${btnCls} border-emerald-200 text-emerald-700 hover:bg-emerald-50`}
                  >
                    <FiSend className="h-3 w-3" /> {whatsapp ? 'Send now' : 'Create now'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEditing({ id: a.id, value: toLocalInput(new Date(a.run_at)) })}
                    className={`${btnCls} border-gray-200 text-gray-600 hover:bg-gray-50`}
                  >
                    <FiEdit2 className="h-3 w-3" /> Change time
                  </button>
                </>
              )}
              {a.status === 'failed' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (whatsapp && !window.confirm('Retry sending? Check the customer chat first to avoid sending it twice.')) return;
                    act(a.id, () => runAutomationNow(a.id), 'Queued for retry');
                  }}
                  className={`${btnCls} border-indigo-200 text-indigo-700 hover:bg-indigo-50`}
                >
                  <FiRotateCcw className="h-3 w-3" /> Retry
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`${a.status === 'failed' ? 'Dismiss' : 'Cancel'} "${labelOf(a)}"?`)) return;
                  act(a.id, () => cancelAutomation(a.id), a.status === 'failed' ? 'Dismissed' : 'Cancelled');
                }}
                className={`${btnCls} border-rose-200 text-rose-600 hover:bg-rose-50`}
              >
                <FiX className="h-3 w-3" /> {a.status === 'failed' ? 'Dismiss' : 'Cancel'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================= */

const TONES = {
  indigo:  { box: 'bg-indigo-50 text-indigo-600',   ring: 'ring-indigo-500' },
  amber:   { box: 'bg-amber-50 text-amber-600',     ring: 'ring-amber-500' },
  rose:    { box: 'bg-rose-50 text-rose-600',       ring: 'ring-rose-500' },
  emerald: { box: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-500' },
};

function StatCard({ label, value = 0, tone, icon: Icon, active, onClick }) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white rounded-xl border border-gray-200 shadow-sm p-3 hover:shadow transition ${active ? `ring-2 ${t.ring}` : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        <span className={`p-1.5 rounded-lg ${t.box}`}><Icon className="h-3.5 w-3.5" /></span>
      </div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value || 0}</div>
    </button>
  );
}

function EmptyState({ tab, filtered }) {
  const text = filtered
    ? 'Nothing matches these filters.'
    : {
        upcoming: 'No reminders are scheduled. Add one from a service entry → Reminders tab.',
        failed: 'No failed reminders — everything went through.',
        done: 'Nothing has run yet.',
        cancelled: 'No cancelled reminders.',
        all: 'No schedules yet.',
      }[tab];

  return (
    <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
      <FiClock className="mx-auto h-10 w-10 text-gray-300 mb-3" />
      <p className="text-gray-600 font-medium">{text}</p>
    </div>
  );
}